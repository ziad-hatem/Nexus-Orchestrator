import assert from "node:assert/strict";
import test from "node:test";
import { getRedactionPlaceholder } from "@/lib/observability/redaction";
import { ConditionEvaluationError } from "@/lib/server/conditions/evaluator";
import {
  executionServiceDeps,
  getWorkflowRunDetail,
  processExecutionQueueJob,
} from "@/lib/server/executions/service";
import type {
  WorkflowRunAttemptRow,
  WorkflowRunRow,
  WorkflowRunStepRow,
} from "@/lib/server/executions/types";
import type { WorkflowVersionRow } from "@/lib/server/workflows/repository";
import type {
  WorkflowConditionConfig,
  WorkflowDraftDocument,
  WorkflowSourceContext,
} from "@/lib/server/workflows/types";
import {
  buildWorkflowCanvas,
  createEmptyWorkflowDraftDocument,
  createWorkflowActionDefinition,
  createWorkflowConditionDefinition,
} from "@/lib/server/workflows/types";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalExecutionServiceDeps = { ...executionServiceDeps };

test.afterEach(() => {
  restoreMutableExports(executionServiceDeps, originalExecutionServiceDeps);
});

function createRunRow(overrides: Partial<WorkflowRunRow> = {}): WorkflowRunRow {
  return {
    id: "run_db_1",
    organization_id: "org_1",
    workflow_id: "workflow_db_1",
    workflow_version_id: "version_db_1",
    binding_id: "binding_1",
    run_key: "RUN-1001",
    correlation_id: "corr_1",
    status: "pending",
    trigger_source: "manual",
    source_context: {
      sourceLabel: "manual",
      actorUserId: "user_1",
      requestIp: "198.51.100.20",
    },
    payload: {
      apiKey: "secret-token",
      ticket: {
        priority: "high",
      },
    },
    idempotency_key: "idem_1",
    created_by_event_id: null,
    attempt_count: 0,
    max_attempts: 3,
    started_at: null,
    completed_at: null,
    cancel_requested_at: null,
    cancelled_at: null,
    last_heartbeat_at: null,
    next_retry_at: null,
    last_retry_at: null,
    failure_code: null,
    failure_message: null,
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createAttemptRow(
  overrides: Partial<WorkflowRunAttemptRow> = {},
): WorkflowRunAttemptRow {
  return {
    id: "attempt_1",
    run_id: "run_db_1",
    organization_id: "org_1",
    workflow_id: "workflow_db_1",
    workflow_version_id: "version_db_1",
    attempt_number: 1,
    launch_reason: "initial",
    requested_by_user_id: null,
    request_note: null,
    scheduled_for: "2026-03-23T00:00:00.000Z",
    backoff_seconds: 0,
    status: "scheduled",
    failure_code: null,
    failure_message: null,
    started_at: null,
    completed_at: null,
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createStepRow(
  overrides: Partial<WorkflowRunStepRow> = {},
): WorkflowRunStepRow {
  return {
    id: "step_1",
    run_id: "run_db_1",
    organization_id: "org_1",
    workflow_id: "workflow_db_1",
    workflow_version_id: "version_db_1",
    node_id: "node_1",
    node_type: "trigger",
    node_label: "Trigger",
    node_snapshot: {},
    sequence_number: 1,
    attempt_number: 1,
    branch_taken: null,
    status: "success",
    correlation_id: "corr_1",
    input_payload: {},
    output_payload: {},
    error_code: null,
    error_message: null,
    logs: [],
    started_at: "2026-03-23T00:00:00.000Z",
    completed_at: "2026-03-23T00:00:01.000Z",
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:01.000Z",
    ...overrides,
  };
}

function createWorkflowVersionRow(
  draft: WorkflowDraftDocument,
  overrides: Partial<WorkflowVersionRow> = {},
): WorkflowVersionRow {
  return {
    id: "version_db_1",
    workflow_id: "workflow_db_1",
    organization_id: "org_1",
    version_number: 1,
    metadata: draft.metadata,
    config: draft.config,
    canvas: draft.canvas,
    validation_issues: [],
    publish_notes: null,
    published_by: "user_1",
    created_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createEmailAction() {
  const action = createWorkflowActionDefinition("send_email");
  action.label = "Notify team";
  action.config = {
    to: "ops@example.com",
    subject: "Ticket update",
    body: "Workflow processed",
    replyTo: "",
  };
  return action;
}

function createCondition(
  overrides: Partial<WorkflowConditionConfig> = {},
): WorkflowConditionConfig {
  const base = createWorkflowConditionDefinition();
  const resolver = {
    scope: "payload" as const,
    path: "ticket.priority",
    ...(overrides.resolver ?? {}),
  };
  return {
    ...base,
    label: "Priority check",
    operator: "equals",
    value: "high",
    ...overrides,
    resolver,
  };
}

function createConditionActionDraft(
  conditionOverrides: Partial<WorkflowConditionConfig> = {},
): WorkflowDraftDocument {
  const base = createEmptyWorkflowDraftDocument({
    name: "Priority router",
    category: "Support",
    triggerType: "manual",
  });
  const condition = createCondition(conditionOverrides);
  const action = createEmailAction();
  const config = {
    ...base.config,
    conditions: [condition],
    actions: [action],
  };

  return {
    ...base,
    config,
    canvas: buildWorkflowCanvas(config),
  };
}

function installExecutionServiceNoops() {
  executionServiceDeps.createChildLogger = () => ({}) as never;
  executionServiceDeps.writeLog = () => undefined;
  executionServiceDeps.incrementWindowCounter = async () => ({
    key: "metric",
    current: 1,
    windowSeconds: 60,
  });
  executionServiceDeps.evaluateOperationalAlerts = () => [];
  executionServiceDeps.emitOperationalAlert = () => null;
  executionServiceDeps.getOperationsAlertLookbackMinutes = () => 5;
}

function installRuntimeBaseDeps(version: WorkflowVersionRow) {
  installExecutionServiceNoops();
  executionServiceDeps.claimWorkflowRunForExecution = async () =>
    createRunRow({
      status: "running",
      attempt_count: 1,
      started_at: "2026-03-23T00:00:01.000Z",
      last_heartbeat_at: "2026-03-23T00:00:01.000Z",
    });
  executionServiceDeps.getWorkflowRunAttemptRow = async () => null;
  executionServiceDeps.createWorkflowRunAttemptRow = async (params) =>
    createAttemptRow({
      attempt_number: params.attemptNumber,
      launch_reason: params.launchReason,
      status: params.status ?? "scheduled",
      workflow_version_id: params.workflowVersionId,
    });
  executionServiceDeps.markWorkflowRunAttemptRunning = async () =>
    createAttemptRow({
      status: "running",
      started_at: "2026-03-23T00:00:02.000Z",
    });
  executionServiceDeps.getWorkflowVersionRowById = async () => version;
  executionServiceDeps.getWorkflowRunRowByDbId = async () =>
    createRunRow({
      status: "running",
      attempt_count: 1,
      workflow_version_id: version.id,
    });
}

test("processExecutionQueueJob evaluates matching conditions, logs the result, and executes actions", async () => {
  const draft = createConditionActionDraft();
  const version = createWorkflowVersionRow(draft);
  const triggerNodeId = draft.config.trigger?.id ?? "trigger_1";
  const conditionNodeId = draft.config.conditions[0]?.id ?? "condition_1";
  const actionNodeId = draft.config.actions[0]?.id ?? "action_1";
  const stepStarts: Array<{ nodeId: string; sequenceNumber: number }> = [];
  const stepUpdates: Array<{ stepId: string; patch: Record<string, unknown> }> = [];
  const terminalStatuses: string[] = [];
  let actionExecutions = 0;

  installRuntimeBaseDeps(version);
  executionServiceDeps.createWorkflowRunStepRow = async (params) => {
    stepStarts.push({
      nodeId: params.nodeId,
      sequenceNumber: params.sequenceNumber,
    });
    return createStepRow({
      id: `step_${stepStarts.length}`,
      node_id: params.nodeId,
      node_type: params.nodeType,
      node_label: params.nodeLabel,
      sequence_number: params.sequenceNumber,
      attempt_number: params.attemptNumber,
      status: params.status,
      node_snapshot: params.nodeSnapshot,
      input_payload: params.inputPayload,
    });
  };
  executionServiceDeps.updateWorkflowRunStepRow = async (params) => {
    const patch = params.patch as Record<string, unknown>;
    stepUpdates.push({
      stepId: params.stepId,
      patch,
    });
    return createStepRow({
      id: params.stepId,
      status: params.patch.status as WorkflowRunStepRow["status"],
      output_payload: params.patch.output_payload ?? {},
      error_code:
        typeof params.patch.error_code === "string"
          ? params.patch.error_code
          : null,
      error_message:
        typeof params.patch.error_message === "string"
          ? params.patch.error_message
          : null,
      logs: params.patch.logs ?? [],
    });
  };
  executionServiceDeps.executeWorkflowActionNode = async () => {
    actionExecutions += 1;
    return {
      classification: "success",
      output: { providerMessageId: "msg_1" },
      logs: [],
    };
  };
  executionServiceDeps.completeWorkflowRunAttempt = async (params) => {
    terminalStatuses.push(params.status);
    return createAttemptRow({
      status: params.status,
      attempt_number: params.attemptNumber,
    });
  };
  executionServiceDeps.markWorkflowRunSuccess = async () =>
    createRunRow({
      status: "success",
      attempt_count: 1,
      workflow_version_id: version.id,
      completed_at: "2026-03-23T00:00:03.000Z",
    });

  await processExecutionQueueJob({
    runDbId: "run_db_1",
    organizationId: "org_1",
    runKey: "RUN-1001",
    correlationId: "corr_1",
    enqueuedAt: "2026-03-23T00:00:00.000Z",
    reason: "trigger",
  });

  assert.deepEqual(stepStarts, [
    { nodeId: triggerNodeId, sequenceNumber: 1 },
    { nodeId: conditionNodeId, sequenceNumber: 2 },
    { nodeId: actionNodeId, sequenceNumber: 3 },
  ]);
  assert.equal(actionExecutions, 1);
  assert.deepEqual(terminalStatuses, ["success"]);

  const conditionPatch = stepUpdates.find((entry) => entry.stepId === "step_2")?.patch;
  assert.equal(conditionPatch?.status, "success");
  assert.deepEqual(conditionPatch?.output_payload, {
    matched: true,
    resolverScope: "payload",
    resolverPath: "ticket.priority",
    operator: "equals",
    expectedValue: "high",
    resolvedValue: "high",
    terminationReason: null,
    nextNodeId: actionNodeId,
  });
  const logs = conditionPatch?.logs as Array<Record<string, unknown>>;
  assert.equal(logs[0]?.message, "Condition matched and execution continued.");
});

test("processExecutionQueueJob skips actions when conditions do not match across trigger sources", async () => {
  const draft = createConditionActionDraft({
    value: "urgent",
  });
  const version = createWorkflowVersionRow(draft);
  const triggerNodeId = draft.config.trigger?.id ?? "trigger_1";
  const conditionNodeId = draft.config.conditions[0]?.id ?? "condition_1";

  for (const [source, sourceContext] of [
    [
      "manual",
      {
        sourceLabel: "manual",
        actorUserId: "user_1",
        requestIp: "198.51.100.20",
      },
    ],
    [
      "webhook",
      {
        sourceLabel: "webhook",
        requestPath: "/hooks/acme/support",
        requestMethod: "POST",
        deliveryId: "delivery_1",
      },
    ],
    [
      "internal_event",
      {
        sourceLabel: "internal_event",
        eventKey: "ticket.created",
        requestId: "evt_1",
      },
    ],
  ] as const) {
    const stepStarts: Array<{ nodeId: string; sequenceNumber: number }> = [];
    const stepUpdates: Array<{ stepId: string; patch: Record<string, unknown> }> = [];
    const terminalStatuses: string[] = [];
    let actionExecutions = 0;

    installRuntimeBaseDeps(version);
    executionServiceDeps.claimWorkflowRunForExecution = async () =>
      createRunRow({
        status: "running",
        attempt_count: 1,
        workflow_version_id: version.id,
        trigger_source: source,
        source_context: sourceContext as WorkflowSourceContext,
        payload: {
          ticket: {
            priority: "normal",
          },
        },
      });
    executionServiceDeps.getWorkflowRunRowByDbId = async () =>
      createRunRow({
        status: "running",
        attempt_count: 1,
        workflow_version_id: version.id,
        trigger_source: source,
        source_context: sourceContext as WorkflowSourceContext,
        payload: {
          ticket: {
            priority: "normal",
          },
        },
      });
    executionServiceDeps.createWorkflowRunStepRow = async (params) => {
      stepStarts.push({
        nodeId: params.nodeId,
        sequenceNumber: params.sequenceNumber,
      });
      return createStepRow({
        id: `step_${stepStarts.length}`,
        node_id: params.nodeId,
        node_type: params.nodeType,
        node_label: params.nodeLabel,
        sequence_number: params.sequenceNumber,
        attempt_number: params.attemptNumber,
        status: params.status,
        node_snapshot: params.nodeSnapshot,
        input_payload: params.inputPayload,
      });
    };
    executionServiceDeps.updateWorkflowRunStepRow = async (params) => {
      const patch = params.patch as Record<string, unknown>;
      stepUpdates.push({
        stepId: params.stepId,
        patch,
      });
      return createStepRow({
        id: params.stepId,
        status: params.patch.status as WorkflowRunStepRow["status"],
        output_payload: params.patch.output_payload ?? {},
        logs: params.patch.logs ?? [],
      });
    };
    executionServiceDeps.executeWorkflowActionNode = async () => {
      actionExecutions += 1;
      return {
        classification: "success",
        output: {},
        logs: [],
      };
    };
    executionServiceDeps.completeWorkflowRunAttempt = async (params) => {
      terminalStatuses.push(params.status);
      return createAttemptRow({
        status: params.status,
        attempt_number: params.attemptNumber,
      });
    };
    executionServiceDeps.markWorkflowRunSuccess = async () =>
      createRunRow({
        status: "success",
        attempt_count: 1,
        workflow_version_id: version.id,
        trigger_source: source,
        source_context: sourceContext as WorkflowSourceContext,
        payload: {
          ticket: {
            priority: "normal",
          },
        },
      });

    await processExecutionQueueJob({
      runDbId: "run_db_1",
      organizationId: "org_1",
      runKey: "RUN-1001",
      correlationId: "corr_1",
      enqueuedAt: "2026-03-23T00:00:00.000Z",
      reason: "trigger",
    });

    assert.deepEqual(stepStarts, [
      { nodeId: triggerNodeId, sequenceNumber: 1 },
      { nodeId: conditionNodeId, sequenceNumber: 2 },
    ]);
    assert.equal(actionExecutions, 0, source);
    assert.deepEqual(terminalStatuses, ["success"]);

    const conditionPatch = stepUpdates.find((entry) => entry.stepId === "step_2")?.patch;
    assert.deepEqual(conditionPatch?.output_payload, {
      matched: false,
      resolverScope: "payload",
      resolverPath: "ticket.priority",
      operator: "equals",
      expectedValue: "urgent",
      resolvedValue: "normal",
      terminationReason: "condition_not_met",
      nextNodeId: null,
    });
    const logs = conditionPatch?.logs as Array<Record<string, unknown>>;
    assert.equal(logs[0]?.message, "Condition did not match. Downstream actions were skipped.");
  }
});

test("processExecutionQueueJob fails runs when the bound version contains an invalid condition graph", async () => {
  const draft = createConditionActionDraft();
  const brokenVersion = createWorkflowVersionRow({
    ...draft,
    config: {
      ...draft.config,
      conditions: [],
    },
  });
  let failureCode = "";

  installRuntimeBaseDeps(brokenVersion);
  executionServiceDeps.createWorkflowRunStepRow = async () => {
    throw new Error("Invalid published versions should fail before step creation");
  };
  executionServiceDeps.updateWorkflowRunStepRow = async (params) =>
    createStepRow({
      id: params.stepId,
      status: params.patch.status as WorkflowRunStepRow["status"],
    });
  executionServiceDeps.completeWorkflowRunAttempt = async (params) =>
    createAttemptRow({
      status: params.status,
      attempt_number: params.attemptNumber,
      failure_code: params.failureCode ?? null,
      failure_message: params.failureMessage ?? null,
    });
  executionServiceDeps.markWorkflowRunFailed = async (params) => {
    failureCode = params.failureCode;
    return createRunRow({
      status: "failed",
      workflow_version_id: brokenVersion.id,
      failure_code: params.failureCode,
      failure_message: params.failureMessage,
      attempt_count: 1,
    });
  };

  await processExecutionQueueJob({
    runDbId: "run_db_1",
    organizationId: "org_1",
    runKey: "RUN-1001",
    correlationId: "corr_1",
    enqueuedAt: "2026-03-23T00:00:00.000Z",
    reason: "trigger",
  });

  assert.equal(failureCode, "invalid_published_version");
});

test("processExecutionQueueJob records condition evaluation failures at the step level", async () => {
  const draft = createConditionActionDraft({
    resolver: {
      scope: "payload",
      path: "ticket.priority",
    },
    operator: "greater_than",
    value: 10,
  });
  const version = createWorkflowVersionRow(draft);
  const stepUpdates: Array<{ stepId: string; patch: Record<string, unknown> }> = [];
  let failureCode = "";

  installRuntimeBaseDeps(version);
  executionServiceDeps.createWorkflowRunStepRow = async (params) =>
    createStepRow({
      id: `step_${params.sequenceNumber}`,
      node_id: params.nodeId,
      node_type: params.nodeType,
      node_label: params.nodeLabel,
      sequence_number: params.sequenceNumber,
      attempt_number: params.attemptNumber,
      status: params.status,
      node_snapshot: params.nodeSnapshot,
      input_payload: params.inputPayload,
    });
  executionServiceDeps.updateWorkflowRunStepRow = async (params) => {
    const patch = params.patch as Record<string, unknown>;
    stepUpdates.push({
      stepId: params.stepId,
      patch,
    });
    return createStepRow({
      id: params.stepId,
      status: params.patch.status as WorkflowRunStepRow["status"],
      output_payload: params.patch.output_payload ?? {},
      error_code:
        typeof params.patch.error_code === "string"
          ? params.patch.error_code
          : null,
      error_message:
        typeof params.patch.error_message === "string"
          ? params.patch.error_message
          : null,
      logs: params.patch.logs ?? [],
    });
  };
  executionServiceDeps.evaluateWorkflowCondition = () => {
    throw new ConditionEvaluationError("Forced condition failure");
  };
  executionServiceDeps.completeWorkflowRunAttempt = async (params) =>
    createAttemptRow({
      status: params.status,
      attempt_number: params.attemptNumber,
      failure_code: params.failureCode ?? null,
      failure_message: params.failureMessage ?? null,
    });
  executionServiceDeps.markWorkflowRunFailed = async (params) => {
    failureCode = params.failureCode;
    return createRunRow({
      status: "failed",
      workflow_version_id: version.id,
      failure_code: params.failureCode,
      failure_message: params.failureMessage,
      attempt_count: 1,
    });
  };
  executionServiceDeps.executeWorkflowActionNode = async () => {
    throw new Error("Action execution should not be reached");
  };

  await processExecutionQueueJob({
    runDbId: "run_db_1",
    organizationId: "org_1",
    runKey: "RUN-1001",
    correlationId: "corr_1",
    enqueuedAt: "2026-03-23T00:00:00.000Z",
    reason: "trigger",
  });

  const conditionPatch = stepUpdates.find((entry) => entry.stepId === "step_2")?.patch;
  assert.equal(conditionPatch?.status, "failed");
  assert.equal(conditionPatch?.error_code, "condition_evaluation_failed");
  assert.equal(conditionPatch?.error_message, "Forced condition failure");
  assert.equal(failureCode, "condition_evaluation_failed");
});

test("getWorkflowRunDetail returns condition logs and redacts sensitive payload fields", async () => {
  const draft = createConditionActionDraft({
    value: "urgent",
  });
  const version = createWorkflowVersionRow(draft);

  executionServiceDeps.getWorkflowRunRowByPublicId = async () =>
    createRunRow({
      status: "success",
      workflow_version_id: version.id,
      payload: {
        apiKey: "secret-token",
        ticket: {
          priority: "normal",
        },
      },
      source_context: {
        sourceLabel: "manual",
        actorUserId: "user_1",
        requestIp: "198.51.100.20",
      },
    });
  executionServiceDeps.listWorkflowRowsByIds = async () =>
    [
      {
        id: "workflow_db_1",
        workflow_key: "WFL-1001",
        name: "Priority router",
        status: "published",
        category: "Support",
        latest_published_version_number: 1,
      },
    ] as never;
  executionServiceDeps.listWorkflowVersionRowsByIds = async () =>
    [version] as never;
  executionServiceDeps.getWorkflowVersionRowById = async () => version;
  executionServiceDeps.listWorkflowRunStepRows = async () => [
    createStepRow({
      id: "step_condition",
      node_id: draft.config.conditions[0]?.id ?? "condition_1",
      node_type: "condition",
      node_label: draft.config.conditions[0]?.label ?? "Priority check",
      sequence_number: 2,
      input_payload: {
        authorization: "Bearer secret",
        ticket: {
          priority: "normal",
        },
      },
      output_payload: {
        matched: false,
        resolverScope: "payload",
        resolverPath: "ticket.priority",
        operator: "equals",
        expectedValue: "urgent",
        resolvedValue: "normal",
        terminationReason: "condition_not_met",
        nextNodeId: null,
      },
      logs: [
        {
          at: "2026-03-23T00:00:02.000Z",
          level: "info",
          message: "Condition did not match. Downstream actions were skipped.",
          data: {
            resolvedValue: "normal",
            expectedValue: "urgent",
            token: "secret-token",
          },
        },
      ],
    }),
  ];
  executionServiceDeps.listWorkflowRunAttemptRows = async () => [];
  executionServiceDeps.listWorkflowActorsByIds = async () => [];

  const detail = await getWorkflowRunDetail({
    organizationId: "org_1",
    runId: "RUN-1001",
  });

  assert.equal(detail.payload.apiKey, getRedactionPlaceholder());
  assert.equal(
    detail.steps[0]?.inputPayload.authorization,
    getRedactionPlaceholder(),
  );
  const logData = detail.steps[0]?.logs[0]?.data as Record<string, unknown>;
  assert.equal(logData.token, getRedactionPlaceholder());
  assert.equal(
    detail.steps[0]?.logs[0]?.message,
    "Condition did not match. Downstream actions were skipped.",
  );
  assert.deepEqual(detail.steps[0]?.outputPayload, {
    matched: false,
    resolverScope: "payload",
    resolverPath: "ticket.priority",
    operator: "equals",
    expectedValue: "urgent",
    resolvedValue: "normal",
    terminationReason: "condition_not_met",
    nextNodeId: null,
  });
});
