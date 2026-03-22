import { writeAuditLog } from "@/lib/server/audit-log";
import { evaluateConditionExpression } from "@/lib/server/executions/condition-dsl";
import { executeWorkflowActionNode } from "@/lib/server/executions/executors";
import {
  cancelWorkflowRunImmediately,
  claimWorkflowRunForExecution,
  createWorkflowRunStepRow,
  getWorkflowIngestionOriginById,
  getWorkflowRunRowByDbId,
  getWorkflowRunRowByPublicId,
  listWorkflowRunRowsByOrganization,
  listWorkflowRunStepRows,
  markWorkflowRunCancelledFromWorker,
  markWorkflowRunFailed,
  markWorkflowRunRetrying,
  markWorkflowRunSuccess,
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
  WorkflowRunDetail,
  WorkflowRunRow,
  WorkflowRunSummary,
} from "@/lib/server/executions/types";
import { createChildLogger, writeLog } from "@/lib/observability/logger";
import {
  listWorkflowRowsByIds,
  listWorkflowVersionRowsByIds,
} from "@/lib/server/triggers/repository";
import {
  getWorkflowVersionRowById,
  listWorkflowActorsByIds,
} from "@/lib/server/workflows/repository";
import {
  isWorkflowConditionBranchKey,
  normalizeValidationIssues,
  normalizeWorkflowDraftDocument,
  type WorkflowActionConfig,
  type WorkflowCanvasNode,
  type WorkflowCanvasEdge,
  type WorkflowConditionBranchKey,
  type WorkflowConditionConfig,
  type WorkflowDraftDocument,
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

function buildQueueJob(run: WorkflowRunRow, reason: "trigger" | "retry"): ExecutionQueueJob {
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
    failureCode: params.run.failure_code,
    failureMessage: params.run.failure_message,
    idempotencyKey: params.run.idempotency_key,
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
          expression: params.condition.expression,
          config: params.condition.config,
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
    inputPayload: toRecord(params.run.payload),
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
      output_payload: params.output ?? {},
      error_code: params.errorCode ?? null,
      error_message: params.errorMessage ?? null,
      logs: params.logs ?? [],
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

async function isCancellationRequested(runDbId: string): Promise<boolean> {
  const run = await getWorkflowRunRowByDbId(runDbId);
  return Boolean(run?.cancel_requested_at);
}

async function executeRunAttempt(params: {
  run: WorkflowRunRow;
  draft: WorkflowDraftDocument;
}): Promise<
  | { kind: "success" }
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

      let branchTaken: WorkflowConditionBranchKey;
      let resolvedValue: unknown;
      try {
        const evaluation = evaluateConditionExpression({
          expression: condition.expression,
          payload: toRecord(params.run.payload),
          context: mapSourceContext(params.run.source_context),
        });
        branchTaken = evaluation.passed ? "true" : "false";
        resolvedValue = evaluation.resolvedValue;
      } catch (error: unknown) {
        const message =
          error instanceof Error
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

      const nextEdge = (edgesBySource.get(activeNode.id) ?? []).find(
        (edge) => edge.branchKey === branchTaken,
      );
      if (!nextEdge) {
        await finishStep({
          stepId: step.id,
          status: "failed",
          errorCode: "missing_condition_branch",
          errorMessage: `Condition branch ${branchTaken} is not connected.`,
        });
        return {
          kind: "fatal_failure",
          failureCode: "missing_condition_branch",
          failureMessage: `Condition branch ${branchTaken} is not connected.`,
        };
      }

      await finishStep({
        stepId: step.id,
        status: "success",
        output: {
          branchTaken,
          resolvedValue,
          nextNodeId: nextEdge.target,
        },
      });
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
      const result = await executeWorkflowActionNode({
        action,
        context: {
          run: params.run,
          correlationId: params.run.correlation_id,
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
  reason?: "trigger" | "retry";
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
    if (query && ![item.runId, item.workflowId, item.workflowName, item.correlationId, item.status, item.triggerSource].join(" ").toLowerCase().includes(query)) return false;
    return true;
  });

  const total = filtered.length;
  const start = (params.filters.page - 1) * params.filters.pageSize;
  return {
    items: filtered.slice(start, start + params.filters.pageSize),
    total,
    page: params.filters.page,
    pageSize: params.filters.pageSize,
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

  const [workflowRows, versionRows, version, steps, originEvent] = await Promise.all([
    listWorkflowRowsByIds([run.workflow_id]),
    listWorkflowVersionRowsByIds([run.workflow_version_id]),
    getWorkflowVersionRowById(run.workflow_version_id),
    listWorkflowRunStepRows(run.id),
    run.created_by_event_id ? getWorkflowIngestionOriginById(run.created_by_event_id) : Promise.resolve(null),
  ]);
  const workflowRow = workflowRows[0];
  const versionRow = versionRows[0];
  if (!workflowRow || !versionRow || !version) {
    throw new WorkflowExecutionNotFoundError();
  }

  const sourceContext = mapSourceContext(run.source_context);
  const actorIds = [originEvent?.triggered_by_user_id, sourceContext.actorUserId].filter(
    (value): value is string => Boolean(value),
  );
  const actorMap = new Map(
    (await listWorkflowActorsByIds(actorIds)).map((actor) => [actor.id, actor]),
  );
  const [summary] = await hydrateRunSummaries([run]);
  if (!summary) {
    throw new WorkflowExecutionNotFoundError();
  }

  return {
    ...summary,
    sourceContext,
    payload: toRecord(run.payload),
    createdByEventId: run.created_by_event_id,
    cancelRequestedAt: run.cancel_requested_at,
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
      inputPayload: toRecord(row.input_payload),
      outputPayload: toRecord(row.output_payload),
      errorCode: row.error_code,
      errorMessage: row.error_message,
      logs: normalizeLogs(row.logs),
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

export async function processExecutionQueueJob(job: ExecutionQueueJob): Promise<void> {
  const claimedRun = await claimWorkflowRunForExecution(job.runDbId);
  if (!claimedRun) {
    return;
  }

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
      await markWorkflowRunSuccess(claimedRun.id);
      writeLog(logger, "info", "Workflow run completed successfully", {});
      return;
    }

    if (result.kind === "cancelled") {
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
      const updated = await markWorkflowRunRetrying({
        runDbId: claimedRun.id,
        failureCode: result.failureCode,
        failureMessage: result.failureMessage,
      });
      if (updated) {
        await scheduleExecutionJob({
          job: buildQueueJob(updated, "retry"),
          availableAt: new Date(Date.now() + getRetryDelaySeconds(updated.attempt_count) * 1000),
        });
      }
      writeLog(logger, "warn", "Workflow run scheduled for retry", {
        failureCode: result.failureCode,
        attemptCount: claimedRun.attempt_count,
        maxAttempts: claimedRun.max_attempts,
      });
      return;
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
