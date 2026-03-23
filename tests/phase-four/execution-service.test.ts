import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelWorkflowRun,
  enqueueWorkflowRunForExecution,
  executionServiceDeps,
  getWorkflowRunDetail,
  listWorkflowRunSummaries,
  processExecutionQueueJob,
  retryWorkflowRun,
  WorkflowExecutionConflictError,
  WorkflowExecutionNotFoundError,
} from "@/lib/server/executions/service";
import type {
  ExecutionQueueJob,
  WorkflowRunAttemptRow,
  WorkflowRunRow,
  WorkflowRunStepRow,
} from "@/lib/server/executions/types";
import type { WorkflowVersionRow } from "@/lib/server/workflows/repository";
import {
  buildWorkflowCanvas,
  createEmptyWorkflowDraftDocument,
  createWorkflowActionDefinition,
  type WorkflowDraftDocument,
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
      ticketId: "T-100",
    },
    idempotency_key: "idem_1",
    created_by_event_id: "event_1",
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

function createTerminalActionDraft(): WorkflowDraftDocument {
  const base = createEmptyWorkflowDraftDocument({
    name: "Incident triage",
    description: "Routes incidents",
    category: "Operations",
    triggerType: "manual",
  });
  const action = createWorkflowActionDefinition("send_email");
  action.label = "Notify team";
  action.config = {
    to: "ops@example.com",
    subject: "Workflow update",
    body: "Workflow completed",
    replyTo: "",
  };

  return {
    ...base,
    config: {
      ...base.config,
      actions: [action],
    },
    canvas: buildWorkflowCanvas({
      ...base.config,
      actions: [action],
    }),
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

test("enqueueWorkflowRunForExecution only dispatches pending and retrying runs", async () => {
  const queuedJobs: ExecutionQueueJob[] = [];

  executionServiceDeps.enqueueExecutionJob = async (job) => {
    queuedJobs.push(job);
  };

  await enqueueWorkflowRunForExecution({ run: createRunRow({ status: "pending" }) });
  await enqueueWorkflowRunForExecution({
    run: createRunRow({ status: "retrying" }),
    reason: "retry",
  });
  await enqueueWorkflowRunForExecution({ run: createRunRow({ status: "success" }) });

  assert.equal(queuedJobs.length, 2);
  assert.equal(queuedJobs[0]?.reason, "trigger");
  assert.equal(queuedJobs[1]?.reason, "retry");
  assert.equal(queuedJobs[0]?.runKey, "RUN-1001");
});

test("listWorkflowRunSummaries filters by workflow and status and returns aggregate counts", async () => {
  executionServiceDeps.listWorkflowRunRowsByOrganization = async () => [
    createRunRow({
      id: "run_db_1",
      run_key: "RUN-1001",
      workflow_id: "workflow_db_1",
      workflow_version_id: "version_db_1",
      status: "failed",
      failure_code: "action_failure",
      failure_message: "Email failed",
    }),
    createRunRow({
      id: "run_db_2",
      run_key: "RUN-1002",
      workflow_id: "workflow_db_2",
      workflow_version_id: "version_db_2",
      status: "running",
      trigger_source: "webhook",
      payload: {},
    }),
  ];
  executionServiceDeps.listWorkflowRowsByIds = async () => [
    {
      id: "workflow_db_1",
      workflow_key: "WFL-1001",
      name: "Incident triage",
      status: "published",
      category: "Operations",
      latest_published_version_number: 1,
    },
    {
      id: "workflow_db_2",
      workflow_key: "WFL-1002",
      name: "Webhook intake",
      status: "published",
      category: "Support",
      latest_published_version_number: 2,
    },
  ] as never;
  executionServiceDeps.listWorkflowVersionRowsByIds = async () => [
    { id: "version_db_1", workflow_id: "workflow_db_1", version_number: 1 },
    { id: "version_db_2", workflow_id: "workflow_db_2", version_number: 2 },
  ] as never;

  const result = await listWorkflowRunSummaries({
    organizationId: "org_1",
    filters: {
      workflowId: "WFL-1001",
      status: "failed",
      page: 1,
      pageSize: 10,
    },
  });

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.runId, "RUN-1001");
  assert.equal(result.summary.failed, 1);
  assert.equal(result.summary.total, 1);
});

test("getWorkflowRunDetail returns the bound published version and actor-backed attempt history", async () => {
  const draft = createTerminalActionDraft();
  const version = createWorkflowVersionRow(draft, { version_number: 7 });

  executionServiceDeps.getWorkflowRunRowByPublicId = async () =>
    createRunRow({
      status: "failed",
      workflow_version_id: "version_db_7",
      failure_code: "action_failure",
      failure_message: "Email failed",
      attempt_count: 1,
      started_at: "2026-03-23T00:00:05.000Z",
      completed_at: "2026-03-23T00:00:07.000Z",
    });
  executionServiceDeps.listWorkflowRowsByIds = async () =>
    [
      {
        id: "workflow_db_1",
        workflow_key: "WFL-1001",
        name: "Incident triage",
        status: "published",
        category: "Operations",
        latest_published_version_number: 8,
      },
    ] as never;
  executionServiceDeps.listWorkflowVersionRowsByIds = async () =>
    [{ id: "version_db_7", workflow_id: "workflow_db_1", version_number: 7 }] as never;
  executionServiceDeps.getWorkflowVersionRowById = async () =>
    version;
  executionServiceDeps.listWorkflowRunStepRows = async () => [
    createStepRow({
      node_id: draft.config.trigger?.id ?? "trigger_1",
      node_label: "Manual trigger",
      node_snapshot: { type: "trigger" },
    }),
  ];
  executionServiceDeps.listWorkflowRunAttemptRows = async () => [
    createAttemptRow({
      requested_by_user_id: "user_1",
      request_note: "Manual retry",
      status: "failed",
      failure_code: "action_failure",
      failure_message: "Email failed",
      started_at: "2026-03-23T00:00:05.000Z",
      completed_at: "2026-03-23T00:00:07.000Z",
    }),
  ];
  executionServiceDeps.getWorkflowIngestionOriginById = async () => ({
    id: "event_1",
    status: "accepted",
    source_context: { eventKey: null },
    triggered_by_user_id: "user_1",
    created_at: "2026-03-23T00:00:00.000Z",
  });
  executionServiceDeps.listWorkflowActorsByIds = async () => [
    {
      id: "user_1",
      name: "Operator One",
      email: "ops@example.com",
    },
  ] as never;

  const detail = await getWorkflowRunDetail({
    organizationId: "org_1",
    runId: "RUN-1001",
  });

  assert.equal(detail.workflowVersionNumber, 7);
  assert.equal(detail.workflowName, "Incident triage");
  assert.equal(detail.attempts[0]?.requestedBy?.name, "Operator One");
  assert.equal(detail.triggerActor?.email, "ops@example.com");
  assert.notEqual((detail.payload as { apiKey?: string }).apiKey, "secret-token");
});

test("cancelWorkflowRun cancels pending runs immediately and writes an audit event", async () => {
  let completedAttemptStatus = "";
  let auditAction = "";

  executionServiceDeps.getWorkflowRunRowByPublicId = async () =>
    createRunRow({
      status: "pending",
      attempt_count: 0,
    });
  executionServiceDeps.cancelWorkflowRunImmediately = async () =>
    createRunRow({
      status: "cancelled",
      cancel_requested_at: "2026-03-23T00:00:01.000Z",
      cancelled_at: "2026-03-23T00:00:01.000Z",
      completed_at: "2026-03-23T00:00:01.000Z",
      failure_code: "cancelled_by_user",
    });
  executionServiceDeps.getWorkflowRunAttemptRow = async () =>
    createAttemptRow({ attempt_number: 1, status: "scheduled" });
  executionServiceDeps.completeWorkflowRunAttempt = async (params) => {
    completedAttemptStatus = params.status;
    return createAttemptRow({ status: params.status });
  };
  executionServiceDeps.writeAuditLog = async (params) => {
    auditAction = params.action;
  };
  executionServiceDeps.listWorkflowRowsByIds = async () =>
    [
      {
        id: "workflow_db_1",
        workflow_key: "WFL-1001",
        name: "Incident triage",
        status: "published",
        category: "Operations",
        latest_published_version_number: 1,
      },
    ] as never;
  executionServiceDeps.listWorkflowVersionRowsByIds = async () =>
    [{ id: "version_db_1", workflow_id: "workflow_db_1", version_number: 1 }] as never;

  const result = await cancelWorkflowRun({
    organizationId: "org_1",
    runId: "RUN-1001",
    actorUserId: "user_2",
    reason: "Stop it",
  });

  assert.equal(result.mode, "immediate");
  assert.equal(result.run.status, "cancelled");
  assert.equal(completedAttemptStatus, "cancelled");
  assert.equal(auditAction, "workflow.run_cancel_requested");
});

test("cancelWorkflowRun requests cooperative cancellation for running runs", async () => {
  executionServiceDeps.getWorkflowRunRowByPublicId = async () =>
    createRunRow({
      status: "running",
      attempt_count: 1,
      started_at: "2026-03-23T00:00:01.000Z",
      last_heartbeat_at: "2026-03-23T00:00:02.000Z",
    });
  executionServiceDeps.requestWorkflowRunCancellation = async () =>
    createRunRow({
      status: "running",
      attempt_count: 1,
      cancel_requested_at: "2026-03-23T00:00:03.000Z",
      started_at: "2026-03-23T00:00:01.000Z",
      last_heartbeat_at: "2026-03-23T00:00:02.000Z",
    });
  executionServiceDeps.writeAuditLog = async () => undefined;
  executionServiceDeps.listWorkflowRowsByIds = async () =>
    [
      {
        id: "workflow_db_1",
        workflow_key: "WFL-1001",
        name: "Incident triage",
        status: "published",
        category: "Operations",
        latest_published_version_number: 1,
      },
    ] as never;
  executionServiceDeps.listWorkflowVersionRowsByIds = async () =>
    [{ id: "version_db_1", workflow_id: "workflow_db_1", version_number: 1 }] as never;

  const result = await cancelWorkflowRun({
    organizationId: "org_1",
    runId: "RUN-1001",
    actorUserId: "user_2",
  });

  assert.equal(result.mode, "cooperative");
  assert.equal(result.run.cancelEligible, true);
});

test("retryWorkflowRun only requeues failed or cancelled runs", async () => {
  executionServiceDeps.getWorkflowRunRowByPublicId = async () =>
    createRunRow({
      status: "running",
    });

  await assert.rejects(
    () =>
      retryWorkflowRun({
        organizationId: "org_1",
        runId: "RUN-1001",
        actorUserId: "user_2",
      }),
    (error: unknown) => error instanceof WorkflowExecutionConflictError,
  );
});

test("retryWorkflowRun queues a manual retry attempt and writes an audit event", async () => {
  let queuedReason = "";
  let attemptLaunchReason = "";
  let auditAction = "";

  executionServiceDeps.getWorkflowRunRowByPublicId = async () =>
    createRunRow({
      status: "failed",
      attempt_count: 1,
      failure_code: "action_failure",
      failure_message: "Email failed",
      completed_at: "2026-03-23T00:00:09.000Z",
    });
  executionServiceDeps.queueWorkflowRunForManualRetry = async () =>
    createRunRow({
      status: "pending",
      attempt_count: 1,
    });
  executionServiceDeps.createWorkflowRunAttemptRow = async (params) => {
    attemptLaunchReason = params.launchReason;
    return createAttemptRow({
      attempt_number: params.attemptNumber,
      launch_reason: params.launchReason,
      requested_by_user_id: params.requestedByUserId ?? null,
      request_note: params.requestNote ?? null,
      status: params.status ?? "scheduled",
    });
  };
  executionServiceDeps.enqueueExecutionJob = async (job) => {
    queuedReason = job.reason;
  };
  executionServiceDeps.writeAuditLog = async (params) => {
    auditAction = params.action;
  };
  executionServiceDeps.listWorkflowRowsByIds = async () =>
    [
      {
        id: "workflow_db_1",
        workflow_key: "WFL-1001",
        name: "Incident triage",
        status: "published",
        category: "Operations",
        latest_published_version_number: 1,
      },
    ] as never;
  executionServiceDeps.listWorkflowVersionRowsByIds = async () =>
    [{ id: "version_db_1", workflow_id: "workflow_db_1", version_number: 1 }] as never;

  const result = await retryWorkflowRun({
    organizationId: "org_1",
    runId: "RUN-1001",
    actorUserId: "user_2",
    reason: "Try again",
  });

  assert.equal(result.mode, "manual_retry");
  assert.equal(result.attemptNumber, 2);
  assert.equal(attemptLaunchReason, "manual_retry");
  assert.equal(queuedReason, "manual_retry");
  assert.equal(auditAction, "workflow.run_retried");
});

test("processExecutionQueueJob drives a bound version to success and records ordered steps", async () => {
  const draft = createTerminalActionDraft();
  const version = createWorkflowVersionRow(draft);
  const triggerNodeId = draft.config.trigger?.id ?? "trigger_1";
  const actionNodeId = draft.config.actions[0]?.id ?? "action_1";
  const stepStarts: Array<{ nodeId: string; sequenceNumber: number }> = [];
  const stepFinishes: Array<{ stepId: string; status: string }> = [];
  const terminalStatuses: string[] = [];

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
    });
  executionServiceDeps.markWorkflowRunAttemptRunning = async () =>
    createAttemptRow({ status: "running", started_at: "2026-03-23T00:00:02.000Z" });
  executionServiceDeps.getWorkflowVersionRowById = async () => version;
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
    stepFinishes.push({
      stepId: params.stepId,
      status: String(params.patch.status),
    });
    return createStepRow({
      id: params.stepId,
      status: params.patch.status as WorkflowRunStepRow["status"],
      output_payload: params.patch.output_payload ?? {},
    });
  };
  executionServiceDeps.getWorkflowRunRowByDbId = async () =>
    createRunRow({
      status: "running",
      attempt_count: 1,
    });
  executionServiceDeps.executeWorkflowActionNode = async () => ({
    classification: "success",
    output: { providerMessageId: "msg_1" },
    logs: [],
  });
  executionServiceDeps.completeWorkflowRunAttempt = async (params) => {
    terminalStatuses.push(params.status);
    return createAttemptRow({ status: params.status, attempt_number: params.attemptNumber });
  };
  executionServiceDeps.markWorkflowRunSuccess = async () =>
    createRunRow({
      status: "success",
      attempt_count: 1,
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
    { nodeId: actionNodeId, sequenceNumber: 2 },
  ]);
  assert.deepEqual(stepFinishes, [
    { stepId: "step_1", status: "success" },
    { stepId: "step_2", status: "success" },
  ]);
  assert.deepEqual(terminalStatuses, ["success"]);
});

test("processExecutionQueueJob schedules retryable failures and keeps the same version binding", async () => {
  const draft = createTerminalActionDraft();
  const version = createWorkflowVersionRow(draft, {
    id: "version_retry_1",
    version_number: 4,
  });
  const scheduledJobs: ExecutionQueueJob[] = [];
  let retryAttemptNumber = 0;

  installExecutionServiceNoops();
  executionServiceDeps.claimWorkflowRunForExecution = async () =>
    createRunRow({
      status: "running",
      attempt_count: 1,
      workflow_version_id: "version_retry_1",
      max_attempts: 3,
      started_at: "2026-03-23T00:00:01.000Z",
      last_heartbeat_at: "2026-03-23T00:00:01.000Z",
    });
  executionServiceDeps.getWorkflowRunAttemptRow = async () => null;
  executionServiceDeps.createWorkflowRunAttemptRow = async (params) => {
    if (params.launchReason === "automatic_retry") {
      retryAttemptNumber = params.attemptNumber;
    }

    return createAttemptRow({
      attempt_number: params.attemptNumber,
      workflow_version_id: params.workflowVersionId,
      launch_reason: params.launchReason,
      status: params.status ?? "scheduled",
    });
  };
  executionServiceDeps.markWorkflowRunAttemptRunning = async () =>
    createAttemptRow({ status: "running" });
  executionServiceDeps.getWorkflowVersionRowById = async () => version;
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
    });
  executionServiceDeps.updateWorkflowRunStepRow = async (params) =>
    createStepRow({
      id: params.stepId,
      status: params.patch.status as WorkflowRunStepRow["status"],
    });
  executionServiceDeps.getWorkflowRunRowByDbId = async () =>
    createRunRow({
      status: "running",
      attempt_count: 1,
      workflow_version_id: "version_retry_1",
    });
  executionServiceDeps.executeWorkflowActionNode = async () => ({
    classification: "retryable_failure",
    output: {},
    logs: [],
    errorCode: "provider_timeout",
    errorMessage: "Provider timed out",
  });
  executionServiceDeps.completeWorkflowRunAttempt = async (params) =>
    createAttemptRow({
      status: params.status,
      attempt_number: params.attemptNumber,
      failure_code: params.failureCode ?? null,
      failure_message: params.failureMessage ?? null,
    });
  executionServiceDeps.markWorkflowRunRetrying = async () =>
    createRunRow({
      status: "retrying",
      attempt_count: 1,
      workflow_version_id: "version_retry_1",
      next_retry_at: "2026-03-23T00:00:35.000Z",
      failure_code: "provider_timeout",
      failure_message: "Provider timed out",
    });
  executionServiceDeps.scheduleExecutionJob = async ({ job }) => {
    scheduledJobs.push(job);
  };

  await processExecutionQueueJob({
    runDbId: "run_db_1",
    organizationId: "org_1",
    runKey: "RUN-1001",
    correlationId: "corr_1",
    enqueuedAt: "2026-03-23T00:00:00.000Z",
    reason: "trigger",
  });

  assert.equal(retryAttemptNumber, 2);
  assert.equal(scheduledJobs.length, 1);
  assert.equal(scheduledJobs[0]?.reason, "retry");
});

test("processExecutionQueueJob fails cleanly when the bound workflow version is missing", async () => {
  let failureCode = "";

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
    });
  executionServiceDeps.markWorkflowRunAttemptRunning = async () =>
    createAttemptRow({ status: "running" });
  executionServiceDeps.getWorkflowVersionRowById = async () => null;
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

  assert.equal(failureCode, "missing_workflow_version");
});

test("processExecutionQueueJob no-ops when the run has already been claimed", async () => {
  installExecutionServiceNoops();
  executionServiceDeps.claimWorkflowRunForExecution = async () => null;

  await processExecutionQueueJob({
    runDbId: "run_db_1",
    organizationId: "org_1",
    runKey: "RUN-1001",
    correlationId: "corr_1",
    enqueuedAt: "2026-03-23T00:00:00.000Z",
    reason: "trigger",
  });

  assert.ok(true);
});

test("getWorkflowRunDetail throws when the run is missing", async () => {
  executionServiceDeps.getWorkflowRunRowByPublicId = async () => null;

  await assert.rejects(
    () =>
      getWorkflowRunDetail({
        organizationId: "org_1",
        runId: "RUN-404",
      }),
    (error: unknown) => error instanceof WorkflowExecutionNotFoundError,
  );
});
