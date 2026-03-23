import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelWorkflowRun,
  executionServiceDeps,
  processExecutionQueueJob,
} from "@/lib/server/executions/service";
import type {
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

type CapturedAttemptRecord = {
  attemptNumber: number;
  launchReason: string;
  requestedByUserId: string | null | undefined;
  requestNote: string | null | undefined;
  backoffSeconds: number | null | undefined;
};

type CapturedCompletionRecord = {
  attemptNumber: number;
  status: string;
};

type CapturedRetrySchedule = {
  attemptNumber: number;
  launchReason: string;
  backoffSeconds: number | null | undefined;
};

type CapturedScheduledJob = {
  reason: string;
  availableAt: Date;
};

function createRunRow(overrides: Partial<WorkflowRunRow> = {}): WorkflowRunRow {
  return {
    id: "run_db_1",
    organization_id: "org_1",
    workflow_id: "workflow_db_1",
    workflow_version_id: "version_db_1",
    binding_id: "binding_1",
    run_key: "RUN-1001",
    correlation_id: "corr_1",
    status: "running",
    trigger_source: "manual",
    source_context: {
      sourceLabel: "manual",
      actorUserId: "user_1",
      requestIp: "198.51.100.20",
    },
    payload: {
      ticketId: "T-100",
    },
    idempotency_key: "idem_1",
    created_by_event_id: "event_1",
    attempt_count: 1,
    max_attempts: 3,
    started_at: "2026-03-23T00:00:01.000Z",
    completed_at: null,
    cancel_requested_at: null,
    cancelled_at: null,
    last_heartbeat_at: "2026-03-23T00:00:01.000Z",
    next_retry_at: null,
    last_retry_at: null,
    failure_code: null,
    failure_message: null,
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:01.000Z",
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
    started_at: "2026-03-23T00:00:01.000Z",
    completed_at: "2026-03-23T00:00:02.000Z",
    created_at: "2026-03-23T00:00:01.000Z",
    updated_at: "2026-03-23T00:00:02.000Z",
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
    published_by: "user_publish",
    created_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
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
  executionServiceDeps.touchWorkflowRunHeartbeat = async () => undefined;
}

test("cancelWorkflowRun backfills a missing retry attempt before immediate cancellation", async () => {
  let createdAttempt: CapturedAttemptRecord | null = null;
  let completedAttempt: CapturedCompletionRecord | null = null;

  executionServiceDeps.getWorkflowRunRowByPublicId = async () =>
    createRunRow({
      status: "retrying",
      attempt_count: 1,
      next_retry_at: "2026-03-23T00:01:00.000Z",
    });
  executionServiceDeps.getWorkflowRunAttemptRow = async () => null;
  executionServiceDeps.createWorkflowRunAttemptRow = async (params) => {
    createdAttempt = {
      attemptNumber: params.attemptNumber,
      launchReason: params.launchReason,
      requestedByUserId: params.requestedByUserId ?? null,
      requestNote: params.requestNote ?? null,
      backoffSeconds: params.backoffSeconds ?? null,
    };
    return createAttemptRow({
      attempt_number: params.attemptNumber,
      launch_reason: params.launchReason,
      requested_by_user_id: params.requestedByUserId ?? null,
      request_note: params.requestNote ?? null,
      backoff_seconds: params.backoffSeconds ?? null,
    });
  };
  executionServiceDeps.cancelWorkflowRunImmediately = async () =>
    createRunRow({
      status: "cancelled",
      attempt_count: 1,
      cancel_requested_at: "2026-03-23T00:00:03.000Z",
      cancelled_at: "2026-03-23T00:00:03.000Z",
      completed_at: "2026-03-23T00:00:03.000Z",
      failure_code: "cancelled_by_user",
      failure_message: "Stop the retry",
    });
  executionServiceDeps.completeWorkflowRunAttempt = async (params) => {
    completedAttempt = {
      attemptNumber: params.attemptNumber,
      status: params.status,
    };
    return createAttemptRow({
      attempt_number: params.attemptNumber,
      status: params.status,
      failure_code: params.failureCode ?? null,
      failure_message: params.failureMessage ?? null,
    });
  };
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
  executionServiceDeps.getExecutionRetryDelaysSeconds = () => [45, 90, 180];

  const result = await cancelWorkflowRun({
    organizationId: "org_1",
    runId: "RUN-1001",
    actorUserId: "user_admin",
    reason: "Stop the retry",
  });

  assert.ok(createdAttempt);
  assert.ok(completedAttempt);
  const recordedAttempt = createdAttempt as CapturedAttemptRecord;
  const recordedCompletion = completedAttempt as CapturedCompletionRecord;
  assert.equal(result.mode, "immediate");
  assert.equal(recordedAttempt.attemptNumber, 2);
  assert.equal(recordedAttempt.launchReason, "automatic_retry");
  assert.equal(recordedAttempt.requestedByUserId, "user_admin");
  assert.equal(recordedAttempt.requestNote, "Stop the retry");
  assert.equal(recordedAttempt.backoffSeconds, 45);
  assert.equal(recordedCompletion.attemptNumber, 2);
  assert.equal(recordedCompletion.status, "cancelled");
});

test("processExecutionQueueJob records scheduled retry attempts with backoff history", async () => {
  const draft = createTerminalActionDraft();
  const version = createWorkflowVersionRow(draft, {
    id: "version_retry_1",
    version_number: 4,
  });
  let scheduledRetryAttempt: CapturedRetrySchedule | null = null;
  let scheduledJob: CapturedScheduledJob | null = null;

  installExecutionServiceNoops();
  executionServiceDeps.getExecutionRetryDelaysSeconds = () => [30, 120];
  executionServiceDeps.claimWorkflowRunForExecution = async () =>
    createRunRow({
      status: "running",
      attempt_count: 1,
      workflow_version_id: "version_retry_1",
      max_attempts: 3,
    });
  executionServiceDeps.getWorkflowRunAttemptRow = async ({ attemptNumber }) =>
    attemptNumber === 1 ? createAttemptRow({ attempt_number: 1 }) : null;
  executionServiceDeps.createWorkflowRunAttemptRow = async (params) => {
    if (params.attemptNumber === 2) {
      scheduledRetryAttempt = {
        attemptNumber: params.attemptNumber,
        launchReason: params.launchReason,
        backoffSeconds: params.backoffSeconds ?? null,
      };
    }

    return createAttemptRow({
      attempt_number: params.attemptNumber,
      launch_reason: params.launchReason,
      backoff_seconds: params.backoffSeconds ?? null,
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
      attempt_number: params.attemptNumber,
      status: params.status,
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
  executionServiceDeps.scheduleExecutionJob = async ({ job, availableAt }) => {
    scheduledJob = {
      reason: job.reason,
      availableAt,
    };
  };

  await processExecutionQueueJob({
    runDbId: "run_db_1",
    organizationId: "org_1",
    runKey: "RUN-1001",
    correlationId: "corr_1",
    enqueuedAt: "2026-03-23T00:00:00.000Z",
    reason: "trigger",
  });

  assert.ok(scheduledRetryAttempt);
  assert.ok(scheduledJob);
  const recordedRetryAttempt = scheduledRetryAttempt as CapturedRetrySchedule;
  const recordedScheduledJob = scheduledJob as CapturedScheduledJob;
  assert.equal(recordedRetryAttempt.attemptNumber, 2);
  assert.equal(recordedRetryAttempt.launchReason, "automatic_retry");
  assert.equal(recordedRetryAttempt.backoffSeconds, 30);
  assert.equal(recordedScheduledJob.reason, "retry");
  assert.ok(recordedScheduledJob.availableAt instanceof Date);
});

test("processExecutionQueueJob honours cooperative cancellation between steps", async () => {
  const draft = createTerminalActionDraft();
  const version = createWorkflowVersionRow(draft);
  const startedNodeIds: string[] = [];
  const completedStatuses: string[] = [];
  let cancellationMessage = "";
  let runLookupCount = 0;

  installExecutionServiceNoops();
  executionServiceDeps.claimWorkflowRunForExecution = async () =>
    createRunRow({
      status: "running",
      attempt_count: 1,
    });
  executionServiceDeps.getWorkflowRunAttemptRow = async () =>
    createAttemptRow({ attempt_number: 1 });
  executionServiceDeps.markWorkflowRunAttemptRunning = async () =>
    createAttemptRow({ status: "running" });
  executionServiceDeps.getWorkflowVersionRowById = async () => version;
  executionServiceDeps.createWorkflowRunStepRow = async (params) => {
    startedNodeIds.push(params.nodeId);
    return createStepRow({
      id: `step_${params.sequenceNumber}`,
      node_id: params.nodeId,
      node_type: params.nodeType,
      node_label: params.nodeLabel,
      sequence_number: params.sequenceNumber,
      attempt_number: params.attemptNumber,
      status: params.status,
      node_snapshot: params.nodeSnapshot,
    });
  };
  executionServiceDeps.updateWorkflowRunStepRow = async (params) =>
    createStepRow({
      id: params.stepId,
      status: params.patch.status as WorkflowRunStepRow["status"],
    });
  executionServiceDeps.getWorkflowRunRowByDbId = async () => {
    runLookupCount += 1;
    return createRunRow({
      status: "running",
      attempt_count: 1,
      cancel_requested_at:
        runLookupCount >= 2 ? "2026-03-23T00:00:03.000Z" : null,
    });
  };
  executionServiceDeps.executeWorkflowActionNode = async () => {
    assert.fail("Action execution should not start after cooperative cancellation");
  };
  executionServiceDeps.completeWorkflowRunAttempt = async (params) => {
    completedStatuses.push(params.status);
    return createAttemptRow({
      attempt_number: params.attemptNumber,
      status: params.status,
      failure_code: params.failureCode ?? null,
      failure_message: params.failureMessage ?? null,
    });
  };
  executionServiceDeps.markWorkflowRunCancelledFromWorker = async (params) => {
    cancellationMessage = params.failureMessage;
    return createRunRow({
      status: "cancelled",
      attempt_count: 1,
      cancelled_at: "2026-03-23T00:00:03.000Z",
      completed_at: "2026-03-23T00:00:03.000Z",
      failure_code: "cancelled_by_user",
      failure_message: params.failureMessage,
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

  assert.equal(startedNodeIds.length, 1);
  assert.equal(completedStatuses[0], "cancelled");
  assert.match(cancellationMessage, /cancellation was requested/i);
});
