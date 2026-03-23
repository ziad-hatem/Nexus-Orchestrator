import { writeAuditLog } from "@/lib/server/audit-log";
import { executeWorkflowActionNode } from "@/lib/server/executions/executors";
import {
  cancelWorkflowRunImmediately,
  claimWorkflowRunForExecution,
  completeWorkflowRunAttempt,
  createWorkflowRunAttemptRow,
  createWorkflowRunStepRow,
  getWorkflowIngestionOriginById,
  getWorkflowRunAttemptRow,
  getWorkflowRunRowByDbId,
  getWorkflowRunRowByPublicId,
  listWorkflowRunAttemptRows,
  listWorkflowRunRowsByOrganization,
  listWorkflowRunStepRows,
  markWorkflowRunCancelledFromWorker,
  markWorkflowRunFailed,
  markWorkflowRunAttemptRunning,
  markWorkflowRunRetrying,
  markWorkflowRunSuccess,
  queueWorkflowRunForManualRetry,
  requestWorkflowRunCancellation,
  touchWorkflowRunHeartbeat,
  updateWorkflowRunStepRow,
} from "@/lib/server/executions/repository";
import {
  enqueueExecutionJob,
  getExecutionRetryDelaysSeconds,
  getExecutionWorkerHeartbeatIntervalMs,
  scheduleExecutionJob,
} from "@/lib/server/executions/queue";
import type {
  ExecutionQueueJob,
  RunCancellationResult,
  RunRetryResult,
  WorkflowConditionStepLogData,
  WorkflowConditionStepOutput,
  WorkflowRunAttemptRecord,
  WorkflowRunDetail,
  WorkflowRunFailureSummary,
  WorkflowRunListSummary,
  WorkflowRunRow,
  WorkflowRunSummary,
} from "@/lib/server/executions/types";
import { createChildLogger, writeLog } from "@/lib/observability/logger";
import {
  redactRecord,
  redactSensitiveData,
  redactUnknownArray,
} from "@/lib/observability/redaction";
import {
  emitOperationalAlert,
  evaluateOperationalAlerts,
  getOperationsAlertLookbackMinutes,
} from "@/lib/observability/alerts";
import {
  ConditionEvaluationError,
  evaluateWorkflowCondition,
} from "@/lib/server/conditions/evaluator";
import {
  listWorkflowRowsByIds,
  listWorkflowVersionRowsByIds,
} from "@/lib/server/triggers/repository";
import {
  getWorkflowVersionRowById,
  listWorkflowActorsByIds,
} from "@/lib/server/workflows/repository";
import { incrementWindowCounter } from "@/lib/server/triggers/rate-limit";
import {
  isWorkflowConditionBranchKey,
  normalizeValidationIssues,
  normalizeWorkflowDraftDocument,
  type WorkflowActionConfig,
  type WorkflowCanvasNode,
  type WorkflowCanvasEdge,
  type WorkflowConditionConfig,
  type WorkflowDraftDocument,
  type WorkflowRunAttemptLaunchReason,
  type WorkflowRunStatus,
  type WorkflowSourceContext,
} from "@/lib/server/workflows/types";
import { validateWorkflowDraftDocument } from "@/lib/server/workflows/validation";

export class WorkflowExecutionNotFoundError extends Error {
  constructor() {
    super("Workflow run not found.");
  }
}

export class WorkflowExecutionConflictError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function normalizeLogs(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object" && !Array.isArray(item)),
      )
    : [];
}

function sanitizeLogRecords(
  value: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return redactUnknownArray(value.map((item) => ({ ...item })));
}

function mapSourceContext(value: unknown): WorkflowSourceContext {
  const record = toRecord(value);
  return {
    sourceLabel:
      typeof record.sourceLabel === "string" ? record.sourceLabel : "unknown",
    eventKey:
      typeof record.eventKey === "string" ? (record.eventKey as never) : null,
    requestPath:
      typeof record.requestPath === "string" ? record.requestPath : null,
    requestMethod:
      typeof record.requestMethod === "string" ? record.requestMethod : null,
    requestId: typeof record.requestId === "string" ? record.requestId : null,
    requestIp: typeof record.requestIp === "string" ? record.requestIp : null,
    requestUserAgent:
      typeof record.requestUserAgent === "string"
        ? record.requestUserAgent
        : null,
    timestamp: typeof record.timestamp === "string" ? record.timestamp : null,
    actorUserId:
      typeof record.actorUserId === "string" ? record.actorUserId : null,
    deliveryId:
      typeof record.deliveryId === "string" ? record.deliveryId : null,
    apiKeyVerified:
      typeof record.apiKeyVerified === "boolean"
        ? record.apiKeyVerified
        : null,
    rawBody: typeof record.rawBody === "string" ? record.rawBody : null,
  };
}

function mapQueueReasonToLaunchReason(
  reason: ExecutionQueueJob["reason"],
): WorkflowRunAttemptLaunchReason {
  if (reason === "manual_retry") {
    return "manual_retry";
  }

  if (reason === "retry") {
    return "automatic_retry";
  }

  return "initial";
}

function isRetryEligible(status: WorkflowRunStatus): boolean {
  return status === "failed" || status === "cancelled";
}

function isCancelEligible(status: WorkflowRunStatus): boolean {
  return !["success", "failed", "cancelled"].includes(status);
}

function buildQueueJob(
  run: WorkflowRunRow,
  reason: ExecutionQueueJob["reason"],
): ExecutionQueueJob {
  return {
    runDbId: run.id,
    organizationId: run.organization_id,
    runKey: run.run_key,
    correlationId: run.correlation_id,
    enqueuedAt: new Date().toISOString(),
    reason,
  };
}

function mapRunSummary(params: {
  run: WorkflowRunRow;
  workflowLookup: { workflow_key: string; name: string; status: string; category?: string | null };
  versionNumber: number;
}): WorkflowRunSummary {
  return {
    runId: params.run.run_key,
    workflowId: params.workflowLookup.workflow_key,
    workflowName: params.workflowLookup.name,
    workflowCategory: params.workflowLookup.category ?? "Operations",
    workflowStatus: params.workflowLookup.status,
    workflowVersionNumber: params.versionNumber,
    triggerSource: params.run.trigger_source,
    status: params.run.status,
    correlationId: params.run.correlation_id,
    attemptCount: params.run.attempt_count,
    maxAttempts: params.run.max_attempts,
    startedAt: params.run.started_at,
    completedAt: params.run.completed_at,
    cancelledAt: params.run.cancelled_at,
    createdAt: params.run.created_at,
    lastHeartbeatAt: params.run.last_heartbeat_at,
    nextRetryAt: params.run.next_retry_at,
    lastRetryAt: params.run.last_retry_at,
    failureCode: params.run.failure_code,
    failureMessage: params.run.failure_message,
    idempotencyKey: params.run.idempotency_key,
    retryEligible: isRetryEligible(params.run.status),
    cancelEligible: isCancelEligible(params.run.status),
  };
}

function buildRunListSummary(items: WorkflowRunSummary[]): WorkflowRunListSummary {
  const counts: Record<WorkflowRunStatus, number> = {
    pending: 0,
    running: 0,
    success: 0,
    failed: 0,
    retrying: 0,
    cancelled: 0,
  };
  const failureCounts = new Map<string, number>();

  for (const item of items) {
    counts[item.status] += 1;
    if (item.failureCode) {
      failureCounts.set(item.failureCode, (failureCounts.get(item.failureCode) ?? 0) + 1);
    }
  }

  const topFailureCodes: WorkflowRunFailureSummary[] = Array.from(failureCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([failureCode, count]) => ({
      failureCode,
      count,
    }));

  return {
    total: items.length,
    pending: counts.pending,
    running: counts.running,
    success: counts.success,
    failed: counts.failed,
    retrying: counts.retrying,
    cancelled: counts.cancelled,
    topFailureCodes,
  };
}

async function hydrateRunSummaries(
  runs: WorkflowRunRow[],
): Promise<WorkflowRunSummary[]> {
  const [workflowLookups, versionLookups] = await Promise.all([
    listWorkflowRowsByIds(runs.map((run) => run.workflow_id)),
    listWorkflowVersionRowsByIds(runs.map((run) => run.workflow_version_id)),
  ]);
  const workflowMap = new Map(workflowLookups.map((row) => [row.id, row]));
  const versionMap = new Map(versionLookups.map((row) => [row.id, row]));

  return runs
    .map((run) => {
      const workflowLookup = workflowMap.get(run.workflow_id);
      const version = versionMap.get(run.workflow_version_id);
      if (!workflowLookup || !version) {
        return null;
      }

      return mapRunSummary({
        run,
        workflowLookup,
        versionNumber: version.version_number,
      });
    })
    .filter((candidate): candidate is WorkflowRunSummary => candidate !== null);
}

function mapAttemptRecord(params: {
  attempt: Awaited<ReturnType<typeof listWorkflowRunAttemptRows>>[number];
  actorMap: Map<string, { id: string; name: string | null; email: string | null }>;
}): WorkflowRunAttemptRecord {
  return {
    attemptNumber: params.attempt.attempt_number,
    launchReason: params.attempt.launch_reason,
    requestedBy:
      params.attempt.requested_by_user_id
        ? params.actorMap.get(params.attempt.requested_by_user_id) ?? null
        : null,
    requestNote: params.attempt.request_note,
    scheduledFor: params.attempt.scheduled_for,
    backoffSeconds: params.attempt.backoff_seconds,
    status: params.attempt.status,
    failureCode: params.attempt.failure_code,
    failureMessage: params.attempt.failure_message,
    startedAt: params.attempt.started_at,
    completedAt: params.attempt.completed_at,
  };
}

function buildFallbackAttemptHistory(params: {
  run: WorkflowRunRow;
  steps: Awaited<ReturnType<typeof listWorkflowRunStepRows>>;
}): WorkflowRunAttemptRecord[] {
  const groupedSteps = new Map<number, Awaited<ReturnType<typeof listWorkflowRunStepRows>>>();
  for (const step of params.steps) {
    const group = groupedSteps.get(step.attempt_number) ?? [];
    group.push(step);
    groupedSteps.set(step.attempt_number, group);
  }

  const maxAttempt = Math.max(
    params.run.attempt_count,
    ...Array.from(groupedSteps.keys()),
    0,
  );

  return Array.from({ length: maxAttempt }, (_, index) => {
    const attemptNumber = index + 1;
    const steps = groupedSteps.get(attemptNumber) ?? [];
    const firstStep = steps[0];
    const lastStep = steps[steps.length - 1];
    const isCurrentAttempt = attemptNumber === params.run.attempt_count;

    let status: WorkflowRunAttemptRecord["status"] = "scheduled";
    if (isCurrentAttempt) {
      if (params.run.status === "pending" || params.run.status === "retrying") {
        status = "scheduled";
      } else if (params.run.status === "running") {
        status = "running";
      } else if (params.run.status === "success") {
        status = "success";
      } else if (params.run.status === "cancelled") {
        status = "cancelled";
      } else {
        status = "failed";
      }
    } else if (steps.length > 0) {
      status = steps.some((step) => step.status === "cancelled") ? "cancelled" : "failed";
    }

    return {
      attemptNumber,
      launchReason: attemptNumber === 1 ? "initial" : "automatic_retry",
      requestedBy: null,
      requestNote: null,
      scheduledFor: firstStep?.started_at ?? params.run.created_at,
      backoffSeconds: null,
      status,
      failureCode: isCurrentAttempt ? params.run.failure_code : null,
      failureMessage: isCurrentAttempt ? params.run.failure_message : null,
      startedAt: firstStep?.started_at ?? null,
      completedAt: lastStep?.completed_at ?? null,
    };
  });
}

function buildNodeSnapshot(params: {
  node: WorkflowCanvasNode;
  condition?: WorkflowConditionConfig | null;
  action?: WorkflowActionConfig | null;
}) {
  return {
    id: params.node.id,
    type: params.node.type,
    label: params.node.label,
    description: params.node.description,
    config: params.node.config,
    condition: params.condition
      ? {
          resolver: params.condition.resolver,
          operator: params.condition.operator,
          value: params.condition.value,
          legacyExpression: params.condition.legacyExpression ?? null,
          legacyIssue: params.condition.legacyIssue ?? null,
        }
      : undefined,
    action: params.action
      ? {
          type: params.action.type,
          config: params.action.config,
        }
      : undefined,
  };
}

async function startStep(params: {
  run: WorkflowRunRow;
  node: WorkflowCanvasNode;
  sequenceNumber: number;
  branchTaken?: string | null;
  nodeSnapshot: Record<string, unknown>;
}) {
  return createWorkflowRunStepRow({
    runId: params.run.id,
    organizationId: params.run.organization_id,
    workflowId: params.run.workflow_id,
    workflowVersionId: params.run.workflow_version_id,
    nodeId: params.node.id,
    nodeType: params.node.type,
    nodeLabel: params.node.label,
    nodeSnapshot: params.nodeSnapshot,
    sequenceNumber: params.sequenceNumber,
    attemptNumber: params.run.attempt_count,
    branchTaken: params.branchTaken ?? null,
    status: "running",
    correlationId: params.run.correlation_id,
    inputPayload: redactRecord(toRecord(params.run.payload)),
    logs: [],
    startedAt: new Date().toISOString(),
  });
}

async function finishStep(params: {
  stepId: string;
  status: "success" | "failed";
  output?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
  logs?: Array<Record<string, unknown>>;
}) {
  await updateWorkflowRunStepRow({
    stepId: params.stepId,
    patch: {
      status: params.status,
      output_payload: redactRecord(params.output ?? {}),
      error_code: params.errorCode ?? null,
      error_message: params.errorMessage ?? null,
      logs: sanitizeLogRecords(params.logs ?? []),
      completed_at: new Date().toISOString(),
    },
  });
}

function createExecutionLogger(run: WorkflowRunRow) {
  return createChildLogger({
    route: "worker.executions.process",
    runId: run.run_key,
    correlationId: run.correlation_id,
    organizationId: run.organization_id,
    workflowDbId: run.workflow_id,
  });
}

function getRetryDelaySeconds(attemptCount: number): number {
  const delays = getExecutionRetryDelaysSeconds();
  const index = Math.max(0, Math.min(delays.length - 1, attemptCount - 1));
  return delays[index] ?? delays[delays.length - 1] ?? 30;
}

async function trackRetryExhaustionAlert(params: {
  organizationId: string;
  workflowId: string;
  runId: string;
  correlationId: string;
  failureCode: string;
}) {
  const current = await incrementWindowCounter({
    key: `wf:metrics:retry_exhausted:${params.organizationId}`,
    windowSeconds: getOperationsAlertLookbackMinutes() * 60,
  });

  const [alert] = evaluateOperationalAlerts({
    queueBacklog: 0,
    staleRunningCount: 0,
    recentWebhookRejections: 0,
    retryExhaustionCount: current.current,
  }).filter((candidate) => candidate.key === "retry_exhaustion");

  if (alert && alert.status !== "ok") {
    emitOperationalAlert({
      alert,
      context: {
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        runId: params.runId,
        correlationId: params.correlationId,
      },
      extras: {
        failureCode: params.failureCode,
      },
    });
  }
}

async function isCancellationRequested(runDbId: string): Promise<boolean> {
  const run = await getWorkflowRunRowByDbId(runDbId);
  return Boolean(run?.cancel_requested_at);
}

async function executeRunAttempt(params: {
  run: WorkflowRunRow;
  draft: WorkflowDraftDocument;
}): Promise<
  | { kind: "success" }
  | { kind: "condition_not_met" }
  | { kind: "cancelled"; failureMessage: string }
  | { kind: "retryable_failure" | "fatal_failure"; failureCode: string; failureMessage: string }
> {
  const nodeMap = new Map(params.draft.canvas.nodes.map((node) => [node.id, node]));
  const edgesBySource = new Map<string, WorkflowCanvasEdge[]>();
  for (const edge of params.draft.canvas.edges) {
    const current: WorkflowCanvasEdge[] = edgesBySource.get(edge.source) ?? [];
    current.push(edge);
    edgesBySource.set(edge.source, current);
  }

  const trigger = params.draft.config.trigger;
  const versionIssues = validateWorkflowDraftDocument(params.draft);
  if (!trigger || versionIssues.length > 0) {
    return {
      kind: "fatal_failure",
      failureCode: "invalid_published_version",
      failureMessage:
        versionIssues[0]?.message ?? "Published workflow version is invalid.",
    };
  }

  const triggerNode = nodeMap.get(trigger.id);
  if (!triggerNode) {
    return {
      kind: "fatal_failure",
      failureCode: "missing_trigger_node",
      failureMessage: "Published workflow is missing its trigger node.",
    };
  }

  let currentNode: WorkflowCanvasNode | null = triggerNode;
  let sequenceNumber = 1;
  const visited = new Set<string>();

  while (currentNode) {
    const activeNode = currentNode;

    if (await isCancellationRequested(params.run.id)) {
      return {
        kind: "cancelled",
        failureMessage: "Run cancellation was requested before the next step started.",
      };
    }

    if (visited.has(activeNode.id)) {
      return {
        kind: "fatal_failure",
        failureCode: "workflow_cycle_detected",
        failureMessage: `Execution loop detected at node ${activeNode.id}.`,
      };
    }
    visited.add(activeNode.id);

    if (activeNode.type === "trigger") {
      const step = await startStep({
        run: params.run,
        node: activeNode,
        sequenceNumber,
        nodeSnapshot: buildNodeSnapshot({ node: activeNode }),
      });
      sequenceNumber += 1;
      const outgoing: WorkflowCanvasEdge[] = edgesBySource.get(activeNode.id) ?? [];
      if (outgoing.length !== 1) {
        await finishStep({
          stepId: step.id,
          status: "failed",
          errorCode: "invalid_trigger_path",
          errorMessage: "Trigger nodes must have exactly one downstream edge.",
        });
        return {
          kind: "fatal_failure",
          failureCode: "invalid_trigger_path",
          failureMessage: "Trigger nodes must have exactly one downstream edge.",
        };
      }

      await finishStep({
        stepId: step.id,
        status: "success",
        output: {
          nextNodeId: outgoing[0]?.target ?? null,
          source: params.run.trigger_source,
        },
      });
      currentNode = nodeMap.get(outgoing[0]!.target) ?? null;
      continue;
    }

    if (activeNode.type === "condition") {
      const condition = params.draft.config.conditions.find((item) => item.id === activeNode.id);
      if (!condition) {
        return {
          kind: "fatal_failure",
          failureCode: "missing_condition_config",
          failureMessage: `Condition ${activeNode.id} is missing its configuration.`,
        };
      }

      const step = await startStep({
        run: params.run,
        node: activeNode,
        sequenceNumber,
        nodeSnapshot: buildNodeSnapshot({ node: activeNode, condition }),
      });
      sequenceNumber += 1;
      const outgoing = edgesBySource.get(activeNode.id) ?? [];
      if (outgoing.length !== 1) {
        await finishStep({
          stepId: step.id,
          status: "failed",
          errorCode: "invalid_condition_path",
          errorMessage: "Condition nodes must have exactly one pass edge.",
        });
        return {
          kind: "fatal_failure",
          failureCode: "invalid_condition_path",
          failureMessage: "Condition nodes must have exactly one pass edge.",
        };
      }

      const payload = toRecord(params.run.payload);
      const sourceContext = mapSourceContext(params.run.source_context);
      let evaluation: ReturnType<typeof evaluateWorkflowCondition>;
      try {
        evaluation = evaluateWorkflowCondition({
          condition,
          payload,
          context: sourceContext,
        });
      } catch (error: unknown) {
        const message =
          error instanceof ConditionEvaluationError || error instanceof Error
            ? error.message
            : "Condition evaluation failed unexpectedly.";
        await finishStep({
          stepId: step.id,
          status: "failed",
          errorCode: "condition_evaluation_failed",
          errorMessage: message,
        });
        return {
          kind: "fatal_failure",
          failureCode: "condition_evaluation_failed",
          failureMessage: message,
        };
      }

      const nextEdge = outgoing[0]!;
      const conditionOutput: WorkflowConditionStepOutput = {
        matched: evaluation.matched,
        resolverScope: evaluation.resolverScope,
        resolverPath: evaluation.resolverPath,
        operator: evaluation.operator,
        expectedValue: evaluation.expectedValue,
        resolvedValue: evaluation.resolvedValue,
        terminationReason: evaluation.matched ? null : "condition_not_met",
        nextNodeId: evaluation.matched ? nextEdge.target : null,
      };
      const conditionLogData: WorkflowConditionStepLogData = {
        matched: conditionOutput.matched,
        resolverScope: conditionOutput.resolverScope,
        resolverPath: conditionOutput.resolverPath,
        operator: conditionOutput.operator,
        expectedValue: conditionOutput.expectedValue,
        resolvedValue: conditionOutput.resolvedValue,
        terminationReason: conditionOutput.terminationReason,
      };

      await finishStep({
        stepId: step.id,
        status: "success",
        output: conditionOutput,
        logs: [
          {
            at: new Date().toISOString(),
            level: "info",
            message: evaluation.matched
              ? "Condition matched and execution continued."
              : "Condition did not match. Downstream actions were skipped.",
            data: conditionLogData,
          },
        ],
      });

      if (!evaluation.matched) {
        return { kind: "condition_not_met" };
      }

      currentNode = nodeMap.get(nextEdge.target) ?? null;
      continue;
    }

    if (activeNode.type === "action") {
      const action = params.draft.config.actions.find((item) => item.id === activeNode.id);
      if (!action) {
        return {
          kind: "fatal_failure",
          failureCode: "missing_action_config",
          failureMessage: `Action ${activeNode.id} is missing its configuration.`,
        };
      }

      const step = await startStep({
        run: params.run,
        node: activeNode,
        sequenceNumber,
        nodeSnapshot: buildNodeSnapshot({ node: activeNode, action }),
      });
      sequenceNumber += 1;
      const payload = toRecord(params.run.payload);
      const sourceContext = mapSourceContext(params.run.source_context);
      const result = await executeWorkflowActionNode({
        action,
        context: {
          run: params.run,
          stepId: step.id,
          correlationId: params.run.correlation_id,
          organizationId: params.run.organization_id,
          workflowId: params.run.workflow_id,
          workflowVersionId: params.run.workflow_version_id,
          payload,
          sourceContext,
        },
      });

      if (result.classification === "success") {
        await finishStep({
          stepId: step.id,
          status: "success",
          output: result.output,
          logs: result.logs,
        });
        return { kind: "success" };
      }

      await finishStep({
        stepId: step.id,
        status: "failed",
        output: result.output,
        errorCode: result.errorCode ?? "action_execution_failed",
        errorMessage: result.errorMessage ?? "Action execution failed.",
        logs: result.logs,
      });
      return {
        kind: result.classification,
        failureCode: result.errorCode ?? "action_execution_failed",
        failureMessage: result.errorMessage ?? "Action execution failed.",
      };
    }

    return {
      kind: "fatal_failure",
      failureCode: "unsupported_node_type",
      failureMessage: `Unsupported node type ${activeNode.type}.`,
    };
  }

  return {
    kind: "fatal_failure",
    failureCode: "missing_terminal_action",
    failureMessage: "Execution ended without reaching a terminal action node.",
  };
}

export async function enqueueWorkflowRunForExecution(params: {
  run: WorkflowRunRow;
  reason?: ExecutionQueueJob["reason"];
}) {
  if (!["pending", "retrying"].includes(params.run.status)) {
    return;
  }

  await enqueueExecutionJob(buildQueueJob(params.run, params.reason ?? "trigger"));
}

export async function listWorkflowRunSummaries(params: {
  organizationId: string;
  filters: {
    query?: string;
    status?: WorkflowRunStatus;
    source?: WorkflowRunRow["trigger_source"];
    workflowId?: string;
    page: number;
    pageSize: number;
  };
}) {
  const summaries = await hydrateRunSummaries(
    await listWorkflowRunRowsByOrganization(params.organizationId),
  );
  const query = params.filters.query?.toLowerCase();
  const filtered = summaries.filter((item) => {
    if (params.filters.status && item.status !== params.filters.status) return false;
    if (params.filters.source && item.triggerSource !== params.filters.source) return false;
    if (params.filters.workflowId && item.workflowId !== params.filters.workflowId) return false;
    if (
      query &&
      ![
        item.runId,
        item.workflowId,
        item.workflowName,
        item.correlationId,
        item.status,
        item.triggerSource,
        item.failureCode ?? "",
        item.failureMessage ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    ) {
      return false;
    }
    return true;
  });

  const total = filtered.length;
  const start = (params.filters.page - 1) * params.filters.pageSize;
  return {
    items: filtered.slice(start, start + params.filters.pageSize),
    total,
    page: params.filters.page,
    pageSize: params.filters.pageSize,
    summary: buildRunListSummary(filtered),
  };
}

export async function getWorkflowRunDetail(params: {
  organizationId: string;
  runId: string;
}): Promise<WorkflowRunDetail> {
  const run = await getWorkflowRunRowByPublicId(params);
  if (!run) {
    throw new WorkflowExecutionNotFoundError();
  }

  const [workflowRows, versionRows, version, steps, attemptRows, originEvent] = await Promise.all([
    listWorkflowRowsByIds([run.workflow_id]),
    listWorkflowVersionRowsByIds([run.workflow_version_id]),
    getWorkflowVersionRowById(run.workflow_version_id),
    listWorkflowRunStepRows(run.id),
    listWorkflowRunAttemptRows(run.id),
    run.created_by_event_id ? getWorkflowIngestionOriginById(run.created_by_event_id) : Promise.resolve(null),
  ]);
  const workflowRow = workflowRows[0];
  const versionRow = versionRows[0];
  if (!workflowRow || !versionRow || !version) {
    throw new WorkflowExecutionNotFoundError();
  }

  const sourceContext = mapSourceContext(run.source_context);
  const actorIds = [
    originEvent?.triggered_by_user_id,
    sourceContext.actorUserId,
    ...attemptRows.map((attempt) => attempt.requested_by_user_id),
  ].filter(
    (value): value is string => Boolean(value),
  );
  const actorMap = new Map(
    (await listWorkflowActorsByIds(actorIds)).map((actor) => [actor.id, actor]),
  );
  const [summary] = await hydrateRunSummaries([run]);
  if (!summary) {
    throw new WorkflowExecutionNotFoundError();
  }

  const attempts =
    attemptRows.length > 0
      ? attemptRows.map((attempt) => mapAttemptRecord({ attempt, actorMap }))
      : buildFallbackAttemptHistory({
          run,
          steps,
        });

  return {
    ...summary,
    sourceContext: redactSensitiveData(sourceContext),
    payload: redactRecord(toRecord(run.payload)),
    createdByEventId: run.created_by_event_id,
    cancelRequestedAt: run.cancel_requested_at,
    attempts,
    versionValidationIssues: normalizeValidationIssues(version.validation_issues),
    recentEvent: originEvent
      ? {
          eventId: originEvent.id,
          status: originEvent.status,
          eventKey: mapSourceContext(originEvent.source_context).eventKey ?? null,
          createdAt: originEvent.created_at,
        }
      : null,
    steps: steps.map((row) => ({
      stepId: row.id,
      nodeId: row.node_id,
      nodeType: row.node_type,
      nodeLabel: row.node_label,
      sequenceNumber: row.sequence_number,
      attemptNumber: row.attempt_number,
      branchTaken: isWorkflowConditionBranchKey(row.branch_taken) ? row.branch_taken : null,
      status: row.status,
      correlationId: row.correlation_id,
      inputPayload: redactRecord(toRecord(row.input_payload)),
      outputPayload: redactRecord(toRecord(row.output_payload)),
      errorCode: row.error_code,
      errorMessage: row.error_message,
      logs: sanitizeLogRecords(normalizeLogs(row.logs)),
      startedAt: row.started_at,
      completedAt: row.completed_at,
    })),
    triggerActor:
      actorMap.get(originEvent?.triggered_by_user_id ?? "") ??
      actorMap.get(sourceContext.actorUserId ?? "") ??
      null,
  };
}

export async function cancelWorkflowRun(params: {
  organizationId: string;
  runId: string;
  actorUserId: string;
  reason?: string;
  request?: Request | null;
}): Promise<RunCancellationResult> {
  const run = await getWorkflowRunRowByPublicId({
    organizationId: params.organizationId,
    runId: params.runId,
  });
  if (!run) {
    throw new WorkflowExecutionNotFoundError();
  }
  if (["success", "failed", "cancelled"].includes(run.status)) {
    throw new WorkflowExecutionConflictError("Terminal runs cannot be cancelled.");
  }

  const failureMessage = params.reason?.trim() || "Run cancellation requested from the workspace.";
  const updated =
    run.status === "running"
      ? await requestWorkflowRunCancellation(run.id)
      : await cancelWorkflowRunImmediately({
          runDbId: run.id,
          expectedStatuses: [run.status],
          failureMessage,
        });

  if (!updated) {
    throw new WorkflowExecutionConflictError("Run state changed before cancellation could be applied.");
  }

  if (run.status !== "running") {
    await completeWorkflowRunAttempt({
      runDbId: run.id,
      attemptNumber: run.attempt_count + 1,
      status: "cancelled",
      failureCode: "cancelled_by_user",
      failureMessage,
    });
  }

  await writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    action: "workflow.run_cancel_requested",
    entityType: "workflow_run",
    entityId: run.run_key,
    metadata: {
      runId: run.run_key,
      workflowDbId: run.workflow_id,
      reason: params.reason?.trim() || null,
      mode: run.status === "running" ? "cooperative" : "immediate",
      correlationId: run.correlation_id,
    },
    request: params.request,
  });

  const [summary] = await hydrateRunSummaries([updated]);
  if (!summary) {
    throw new WorkflowExecutionNotFoundError();
  }

  return {
    run: summary,
    accepted: true,
    mode: run.status === "running" ? "cooperative" : "immediate",
  };
}

export async function retryWorkflowRun(params: {
  organizationId: string;
  runId: string;
  actorUserId: string;
  reason?: string;
  request?: Request | null;
}): Promise<RunRetryResult> {
  const run = await getWorkflowRunRowByPublicId({
    organizationId: params.organizationId,
    runId: params.runId,
  });
  if (!run) {
    throw new WorkflowExecutionNotFoundError();
  }
  if (!isRetryEligible(run.status)) {
    throw new WorkflowExecutionConflictError(
      "Only failed or cancelled runs can be retried.",
    );
  }

  const updated = await queueWorkflowRunForManualRetry({
    runDbId: run.id,
  });
  if (!updated) {
    throw new WorkflowExecutionConflictError(
      "Run state changed before retry could be scheduled.",
    );
  }

  const attemptNumber = updated.attempt_count + 1;
  await createWorkflowRunAttemptRow({
    runId: updated.id,
    organizationId: updated.organization_id,
    workflowId: updated.workflow_id,
    workflowVersionId: updated.workflow_version_id,
    attemptNumber,
    launchReason: "manual_retry",
    requestedByUserId: params.actorUserId,
    requestNote: params.reason?.trim() || null,
    scheduledFor: new Date().toISOString(),
    backoffSeconds: 0,
    status: "scheduled",
  });

  await enqueueWorkflowRunForExecution({
    run: updated,
    reason: "manual_retry",
  });

  await writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    action: "workflow.run_retried",
    entityType: "workflow_run",
    entityId: run.run_key,
    metadata: {
      runId: run.run_key,
      workflowDbId: run.workflow_id,
      reason: params.reason?.trim() || null,
      attemptNumber,
      previousStatus: run.status,
      correlationId: run.correlation_id,
    },
    request: params.request,
  });

  const [summary] = await hydrateRunSummaries([updated]);
  if (!summary) {
    throw new WorkflowExecutionNotFoundError();
  }

  return {
    run: summary,
    accepted: true,
    mode: "manual_retry",
    attemptNumber,
  };
}

async function ensureExecutionAttemptScheduled(params: {
  run: WorkflowRunRow;
  attemptNumber: number;
  reason: ExecutionQueueJob["reason"];
}) {
  const existing = await getWorkflowRunAttemptRow({
    runDbId: params.run.id,
    attemptNumber: params.attemptNumber,
  });
  if (existing) {
    return existing;
  }

  return createWorkflowRunAttemptRow({
    runId: params.run.id,
    organizationId: params.run.organization_id,
    workflowId: params.run.workflow_id,
    workflowVersionId: params.run.workflow_version_id,
    attemptNumber: params.attemptNumber,
    launchReason: mapQueueReasonToLaunchReason(params.reason),
    scheduledFor: new Date().toISOString(),
    backoffSeconds: params.reason === "retry" ? getRetryDelaySeconds(params.attemptNumber - 1) : 0,
    status: "scheduled",
  });
}

export async function processExecutionQueueJob(job: ExecutionQueueJob): Promise<void> {
  const claimedRun = await claimWorkflowRunForExecution(job.runDbId);
  if (!claimedRun) {
    return;
  }
  const attemptNumber = claimedRun.attempt_count;

  await ensureExecutionAttemptScheduled({
    run: claimedRun,
    attemptNumber,
    reason: job.reason,
  });
  await markWorkflowRunAttemptRunning({
    runDbId: claimedRun.id,
    attemptNumber,
  });

  const logger = createExecutionLogger(claimedRun);
  const heartbeat = setInterval(() => {
    void touchWorkflowRunHeartbeat(claimedRun.id).catch((error: unknown) => {
      writeLog(logger, "warn", "Failed to update execution heartbeat", {
        err: error instanceof Error ? error.message : String(error),
      });
    });
  }, getExecutionWorkerHeartbeatIntervalMs());

  try {
    const version = await getWorkflowVersionRowById(claimedRun.workflow_version_id);
    if (!version) {
      await completeWorkflowRunAttempt({
        runDbId: claimedRun.id,
        attemptNumber,
        status: "failed",
        failureCode: "missing_workflow_version",
        failureMessage: "Workflow version binding no longer exists.",
      });
      await markWorkflowRunFailed({
        runDbId: claimedRun.id,
        failureCode: "missing_workflow_version",
        failureMessage: "Workflow version binding no longer exists.",
      });
      return;
    }

    const draft = normalizeWorkflowDraftDocument({
      metadata: version.metadata,
      config: version.config,
      canvas: version.canvas,
    });
    const result = await executeRunAttempt({
      run: claimedRun,
      draft,
    });

    if (result.kind === "success") {
      await completeWorkflowRunAttempt({
        runDbId: claimedRun.id,
        attemptNumber,
        status: "success",
      });
      await markWorkflowRunSuccess(claimedRun.id);
      writeLog(logger, "info", "Workflow run completed successfully", {});
      return;
    }

    if (result.kind === "condition_not_met") {
      await completeWorkflowRunAttempt({
        runDbId: claimedRun.id,
        attemptNumber,
        status: "success",
      });
      await markWorkflowRunSuccess(claimedRun.id);
      writeLog(
        logger,
        "info",
        "Workflow run completed without executing actions because a condition was not met",
        {},
      );
      return;
    }

    if (result.kind === "cancelled") {
      await completeWorkflowRunAttempt({
        runDbId: claimedRun.id,
        attemptNumber,
        status: "cancelled",
        failureCode: "cancelled_by_user",
        failureMessage: result.failureMessage,
      });
      await markWorkflowRunCancelledFromWorker({
        runDbId: claimedRun.id,
        failureMessage: result.failureMessage,
      });
      writeLog(logger, "warn", "Workflow run cancelled cooperatively", {});
      return;
    }

    const shouldRetry =
      result.kind === "retryable_failure" &&
      claimedRun.attempt_count < claimedRun.max_attempts;

    if (shouldRetry) {
      const nextRetryAt = new Date(
        Date.now() + getRetryDelaySeconds(claimedRun.attempt_count) * 1000,
      );
      await completeWorkflowRunAttempt({
        runDbId: claimedRun.id,
        attemptNumber,
        status: "failed",
        failureCode: result.failureCode,
        failureMessage: result.failureMessage,
      });
      const updated = await markWorkflowRunRetrying({
        runDbId: claimedRun.id,
        failureCode: result.failureCode,
        failureMessage: result.failureMessage,
        nextRetryAt: nextRetryAt.toISOString(),
      });
      if (updated) {
        await createWorkflowRunAttemptRow({
          runId: updated.id,
          organizationId: updated.organization_id,
          workflowId: updated.workflow_id,
          workflowVersionId: updated.workflow_version_id,
          attemptNumber: updated.attempt_count + 1,
          launchReason: "automatic_retry",
          scheduledFor: nextRetryAt.toISOString(),
          backoffSeconds: getRetryDelaySeconds(updated.attempt_count),
          status: "scheduled",
        });
        await scheduleExecutionJob({
          job: buildQueueJob(updated, "retry"),
          availableAt: nextRetryAt,
        });
      }
      writeLog(logger, "warn", "Workflow run scheduled for retry", {
        failureCode: result.failureCode,
        attemptCount: claimedRun.attempt_count,
        maxAttempts: claimedRun.max_attempts,
      });
      return;
    }

    await completeWorkflowRunAttempt({
      runDbId: claimedRun.id,
      attemptNumber,
      status: "failed",
      failureCode: result.failureCode,
      failureMessage: result.failureMessage,
    });
    if (result.kind === "retryable_failure") {
      await trackRetryExhaustionAlert({
        organizationId: claimedRun.organization_id,
        workflowId: claimedRun.workflow_id,
        runId: claimedRun.run_key,
        correlationId: claimedRun.correlation_id,
        failureCode: result.failureCode,
      }).catch(() => undefined);
    }
    await markWorkflowRunFailed({
      runDbId: claimedRun.id,
      failureCode: result.failureCode,
      failureMessage: result.failureMessage,
    });
    writeLog(logger, "error", "Workflow run failed", {
      failureCode: result.failureCode,
      failureMessage: result.failureMessage,
    });
  } catch (error: unknown) {
    await completeWorkflowRunAttempt({
      runDbId: claimedRun.id,
      attemptNumber,
      status: "failed",
      failureCode: "unhandled_execution_error",
      failureMessage:
        error instanceof Error ? error.message : "Unhandled execution worker error.",
    }).catch(() => undefined);
    await markWorkflowRunFailed({
      runDbId: claimedRun.id,
      failureCode: "unhandled_execution_error",
      failureMessage:
        error instanceof Error ? error.message : "Unhandled execution worker error.",
    }).catch(() => undefined);
    writeLog(logger, "error", "Unhandled execution worker failure", {
      err: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearInterval(heartbeat);
  }
}
