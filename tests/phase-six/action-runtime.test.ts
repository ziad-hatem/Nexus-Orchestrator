import assert from "node:assert/strict";
import test from "node:test";
import { emailActionDeps } from "@/lib/server/actions/email";
import { recordActionDeps } from "@/lib/server/actions/record";
import { taskActionDeps } from "@/lib/server/actions/task";
import { webhookActionDeps } from "@/lib/server/actions/webhook";
import {
  executionServiceDeps,
  processExecutionQueueJob,
} from "@/lib/server/executions/service";
import type {
  ExecutionQueueJob,
  WorkflowRunAttemptRow,
  WorkflowRunRow,
  WorkflowRunStepRow,
} from "@/lib/server/executions/types";
import type { WorkflowVersionRow } from "@/lib/server/workflows/repository";
import type { WorkflowDraftDocument } from "@/lib/server/workflows/types";
import {
  buildWorkflowCanvas,
  createEmptyWorkflowDraftDocument,
  createWorkflowActionDefinition,
} from "@/lib/server/workflows/types";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalExecutionServiceDeps = { ...executionServiceDeps };
const originalWebhookActionDeps = { ...webhookActionDeps };
const originalEmailActionDeps = { ...emailActionDeps };
const originalTaskActionDeps = { ...taskActionDeps };
const originalRecordActionDeps = { ...recordActionDeps };

test.afterEach(() => {
  restoreMutableExports(executionServiceDeps, originalExecutionServiceDeps);
  restoreMutableExports(webhookActionDeps, originalWebhookActionDeps);
  restoreMutableExports(emailActionDeps, originalEmailActionDeps);
  restoreMutableExports(taskActionDeps, originalTaskActionDeps);
  restoreMutableExports(recordActionDeps, originalRecordActionDeps);
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
      priority: "7",
      assignee: "agent@example.com",
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

function createActionDraft(
  actionType: "send_webhook" | "send_email" | "create_task" | "update_record_field",
): WorkflowDraftDocument {
  const base = createEmptyWorkflowDraftDocument({
    name: "Action runner",
    category: "Operations",
    triggerType: "manual",
  });
  const action = createWorkflowActionDefinition(actionType);

  switch (actionType) {
    case "send_webhook":
      action.label = "Notify partner";
      action.config = {
        url: "https://hooks.example.test/{{ payload.ticketId }}",
        method: "POST",
        headers: {
          "X-Source": "{{ context.sourceLabel }}",
        },
        body: '{"ticketId":"{{ payload.ticketId }}","priority":"{{ payload.priority }}"}',
      };
      break;
    case "send_email":
      action.label = "Send email";
      action.config = {
        to: "{{ payload.recipient }}",
        subject: "Ticket {{ payload.ticketId }}",
        body: "Priority {{ payload.priority }}",
        replyTo: "{{ context.replyTo }}",
      };
      break;
    case "create_task":
      action.label = "Create task";
      action.config = {
        title: "Follow up {{ payload.ticketId }}",
        description: "Priority {{ payload.priority }}",
        assigneeEmail: "{{ payload.assignee }}",
        dueAt: "{{ payload.dueAt }}",
      };
      break;
    case "update_record_field":
      action.label = "Update record";
      action.config = {
        recordType: "ticket",
        recordKey: "{{ payload.ticketId }}",
        field: "priority",
        valueType: "number",
        valueTemplate: "{{ payload.priority }}",
      };
      break;
  }

  const config = {
    ...base.config,
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

function installRuntimeBaseDeps(
  version: WorkflowVersionRow,
  runOverrides: Partial<WorkflowRunRow> = {},
) {
  installExecutionServiceNoops();
  executionServiceDeps.claimWorkflowRunForExecution = async () =>
    createRunRow({
      status: "running",
      attempt_count: 1,
      workflow_version_id: version.id,
      started_at: "2026-03-23T00:00:01.000Z",
      last_heartbeat_at: "2026-03-23T00:00:01.000Z",
      ...runOverrides,
    });
  executionServiceDeps.getWorkflowRunAttemptRow = async () => null;
  executionServiceDeps.createWorkflowRunAttemptRow = async (params) =>
    createAttemptRow({
      attempt_number: params.attemptNumber,
      launch_reason: params.launchReason,
      workflow_version_id: params.workflowVersionId,
      status: params.status ?? "scheduled",
      requested_by_user_id: params.requestedByUserId ?? null,
      request_note: params.requestNote ?? null,
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
      ...runOverrides,
    });
}

function installStepPersistence(stepUpdates: Array<{ stepId: string; patch: Record<string, unknown> }>) {
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
      node_id: params.stepId === "step_1" ? "trigger_1" : "action_1",
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
}

function buildQueueJob(): ExecutionQueueJob {
  return {
    runDbId: "run_db_1",
    organizationId: "org_1",
    runKey: "RUN-1001",
    correlationId: "corr_1",
    enqueuedAt: "2026-03-23T00:00:00.000Z",
    reason: "trigger",
  };
}

test("processExecutionQueueJob executes published webhook actions and persists the step output", async () => {
  const draft = createActionDraft("send_webhook");
  const version = createWorkflowVersionRow(draft);
  const stepUpdates: Array<{ stepId: string; patch: Record<string, unknown> }> = [];
  const terminalStatuses: string[] = [];

  installRuntimeBaseDeps(version);
  installStepPersistence(stepUpdates);
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

  webhookActionDeps.createTimeoutSignal = () => new AbortController().signal;
  webhookActionDeps.fetch = (async () => new Response("accepted", { status: 202 })) as never;

  await processExecutionQueueJob(buildQueueJob());

  const actionPatch = stepUpdates.find((entry) => entry.stepId === "step_2")?.patch;
  assert.deepEqual(terminalStatuses, ["success"]);
  assert.equal(actionPatch?.status, "success");
  assert.equal(
    (actionPatch?.output_payload as Record<string, unknown>).actionType,
    "send_webhook",
  );
  assert.equal(
    (actionPatch?.output_payload as Record<string, unknown>).status,
    202,
  );
});

test("processExecutionQueueJob executes published email actions against the bound version", async () => {
  const draft = createActionDraft("send_email");
  const version = createWorkflowVersionRow(draft, {
    id: "version_email_1",
    version_number: 7,
  });
  const stepUpdates: Array<{ stepId: string; patch: Record<string, unknown> }> = [];

  installRuntimeBaseDeps(version, {
    workflow_version_id: "version_email_1",
    trigger_source: "internal_event",
    source_context: {
      sourceLabel: "internal_event",
      replyTo: "support@example.com",
      eventKey: "ticket.created",
    },
    payload: {
      recipient: "ops@example.com",
      ticketId: "T-100",
      priority: "high",
    },
  });
  installStepPersistence(stepUpdates);
  executionServiceDeps.completeWorkflowRunAttempt = async (params) =>
    createAttemptRow({
      status: params.status,
      attempt_number: params.attemptNumber,
      workflow_version_id: version.id,
    });
  executionServiceDeps.markWorkflowRunSuccess = async () =>
    createRunRow({
      status: "success",
      attempt_count: 1,
      workflow_version_id: version.id,
      completed_at: "2026-03-23T00:00:03.000Z",
      trigger_source: "internal_event",
    });

  emailActionDeps.getRequiredEnv = () => "resend_test_key";
  emailActionDeps.createResendClient = () =>
    ({
      emails: {
        send: async () => ({
          data: { id: "msg_123" },
          error: null,
        }),
      },
    }) as never;

  await processExecutionQueueJob(buildQueueJob());

  const actionPatch = stepUpdates.find((entry) => entry.stepId === "step_2")?.patch;
  assert.equal(
    (actionPatch?.output_payload as Record<string, unknown>).providerMessageId,
    "msg_123",
  );
  assert.equal(
    (actionPatch?.output_payload as Record<string, unknown>).recipient,
    "ops@example.com",
  );
});

test("processExecutionQueueJob executes create task actions and persists tenant-scoped outcomes", async () => {
  const draft = createActionDraft("create_task");
  const version = createWorkflowVersionRow(draft);
  const stepUpdates: Array<{ stepId: string; patch: Record<string, unknown> }> = [];
  let createdTaskInput: Record<string, unknown> | undefined;

  installRuntimeBaseDeps(version, {
    trigger_source: "webhook",
    source_context: {
      sourceLabel: "webhook",
      requestPath: "/hooks/acme/tasks",
    },
    payload: {
      ticketId: "T-100",
      priority: "high",
      assignee: "agent@example.com",
      dueAt: "2026-03-24T12:00:00.000Z",
    },
  });
  installStepPersistence(stepUpdates);
  executionServiceDeps.completeWorkflowRunAttempt = async (params) =>
    createAttemptRow({
      status: params.status,
      attempt_number: params.attemptNumber,
    });
  executionServiceDeps.markWorkflowRunSuccess = async () =>
    createRunRow({
      status: "success",
      attempt_count: 1,
      workflow_version_id: version.id,
      completed_at: "2026-03-23T00:00:03.000Z",
      trigger_source: "webhook",
    });

  taskActionDeps.resolveActiveAssigneeByEmail = async () => ({
    userId: "user_1",
    email: "agent@example.com",
  });
  taskActionDeps.createWorkflowTaskRow = async (params) => {
    createdTaskInput = params as unknown as Record<string, unknown>;
    return {
      id: "task_1",
      organization_id: params.organizationId,
      workflow_id: params.workflowId,
      workflow_version_id: params.workflowVersionId,
      run_id: params.runId,
      step_id: params.stepId,
      title: params.title,
      description: params.description ?? null,
      status: "open",
      assignee_user_id: "user_1",
      assignee_email: "agent@example.com",
      due_at: params.dueAt ?? null,
      created_at: "2026-03-23T00:00:00.000Z",
      updated_at: "2026-03-23T00:00:00.000Z",
    };
  };

  await processExecutionQueueJob(buildQueueJob());

  const actionPatch = stepUpdates.find((entry) => entry.stepId === "step_2")?.patch;
  assert.equal(createdTaskInput?.organizationId, "org_1");
  assert.equal(createdTaskInput?.runId, "run_db_1");
  assert.equal(
    (actionPatch?.output_payload as Record<string, unknown>).taskId,
    "task_1",
  );
});

test("processExecutionQueueJob executes record updates and persists the bound run identifiers", async () => {
  const draft = createActionDraft("update_record_field");
  const version = createWorkflowVersionRow(draft);
  const stepUpdates: Array<{ stepId: string; patch: Record<string, unknown> }> = [];
  let upsertInput: Record<string, unknown> | undefined;

  installRuntimeBaseDeps(version, {
    payload: {
      ticketId: "T-100",
      priority: "7",
    },
  });
  installStepPersistence(stepUpdates);
  executionServiceDeps.completeWorkflowRunAttempt = async (params) =>
    createAttemptRow({
      status: params.status,
      attempt_number: params.attemptNumber,
    });
  executionServiceDeps.markWorkflowRunSuccess = async () =>
    createRunRow({
      status: "success",
      attempt_count: 1,
      workflow_version_id: version.id,
      completed_at: "2026-03-23T00:00:03.000Z",
    });

  recordActionDeps.upsertWorkflowRecordField = async (params) => {
    upsertInput = params as unknown as Record<string, unknown>;
    return {
      id: "record_1",
      organization_id: params.organizationId,
      record_type: params.recordType,
      record_key: params.recordKey,
      fields: {
        [params.field]: params.value,
      },
      created_by_workflow_id: params.workflowId,
      created_by_workflow_version_id: params.workflowVersionId,
      created_by_run_id: params.runId,
      created_by_step_id: params.stepId,
      updated_by_workflow_id: params.workflowId,
      updated_by_workflow_version_id: params.workflowVersionId,
      updated_by_run_id: params.runId,
      updated_by_step_id: params.stepId,
      created_at: "2026-03-23T00:00:00.000Z",
      updated_at: "2026-03-23T00:00:00.000Z",
    };
  };

  await processExecutionQueueJob(buildQueueJob());

  const actionPatch = stepUpdates.find((entry) => entry.stepId === "step_2")?.patch;
  assert.equal(upsertInput?.organizationId, "org_1");
  assert.equal(upsertInput?.runId, "run_db_1");
  assert.equal(upsertInput?.value, 7);
  assert.equal(
    (actionPatch?.output_payload as Record<string, unknown>).recordId,
    "record_1",
  );
});

test("processExecutionQueueJob schedules retry when webhook actions fail with a retryable error", async () => {
  const draft = createActionDraft("send_webhook");
  const version = createWorkflowVersionRow(draft, {
    id: "version_retry_1",
    version_number: 4,
  });
  const stepUpdates: Array<{ stepId: string; patch: Record<string, unknown> }> = [];
  const scheduledJobs: ExecutionQueueJob[] = [];
  let retryAttemptNumber = 0;

  installRuntimeBaseDeps(version, {
    workflow_version_id: version.id,
    max_attempts: 3,
  });
  installStepPersistence(stepUpdates);
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
      workflow_version_id: version.id,
      next_retry_at: "2026-03-23T00:00:35.000Z",
      failure_code: "send_webhook_server_error",
      failure_message: "Webhook action failed with status 503.",
    });
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
  executionServiceDeps.scheduleExecutionJob = async ({ job }) => {
    scheduledJobs.push(job);
  };

  webhookActionDeps.createTimeoutSignal = () => new AbortController().signal;
  webhookActionDeps.fetch = (async () => new Response("server down", { status: 503 })) as never;

  await processExecutionQueueJob(buildQueueJob());

  const actionPatch = stepUpdates.find((entry) => entry.stepId === "step_2")?.patch;
  assert.equal(actionPatch?.status, "failed");
  assert.equal(retryAttemptNumber, 2);
  assert.equal(scheduledJobs.length, 1);
  assert.equal(scheduledJobs[0]?.reason, "retry");
});
