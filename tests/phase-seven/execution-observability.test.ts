import assert from "node:assert/strict";
import test from "node:test";
import { getRedactionPlaceholder } from "@/lib/observability/redaction";
import {
  executionServiceDeps,
  getWorkflowRunDetail,
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
const REDACTION_PLACEHOLDER = getRedactionPlaceholder();

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
    status: "failed",
    trigger_source: "manual",
    source_context: {
      sourceLabel: "manual",
      actorUserId: "user_trigger",
      requestIp: "198.51.100.20",
      rawBody: '{"token":"super-secret"}',
    },
    payload: {
      apiKey: "secret-token",
      ticketId: "T-100",
    },
    idempotency_key: "idem_1",
    created_by_event_id: "event_1",
    attempt_count: 2,
    max_attempts: 3,
    started_at: "2026-03-23T00:00:05.000Z",
    completed_at: "2026-03-23T00:00:07.000Z",
    cancel_requested_at: null,
    cancelled_at: null,
    last_heartbeat_at: "2026-03-23T00:00:06.000Z",
    next_retry_at: "2026-03-23T00:01:00.000Z",
    last_retry_at: "2026-03-23T00:00:07.000Z",
    failure_code: "action_failure",
    failure_message: "Email failed",
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:07.000Z",
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
    status: "failed",
    failure_code: "action_failure",
    failure_message: "Email failed",
    started_at: "2026-03-23T00:00:01.000Z",
    completed_at: "2026-03-23T00:00:03.000Z",
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:03.000Z",
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
    node_type: "action",
    node_label: "Send email",
    node_snapshot: {},
    sequence_number: 1,
    attempt_number: 1,
    branch_taken: null,
    status: "failed",
    correlation_id: "corr_1",
    input_payload: {
      requestBodyPreview: '{"password":"nope"}',
      safe: "visible",
    },
    output_payload: {
      responsePreview: '{"apiKey":"still-nope"}',
      safe: true,
    },
    error_code: "action_failure",
    error_message: "Email failed",
    logs: [
      {
        at: "2026-03-23T00:00:02.000Z",
        level: "info",
        message: "Provider preview",
        data: {
          requestBodyPreview: '{"token":"hidden"}',
          safe: "ok",
        },
      },
    ],
    started_at: "2026-03-23T00:00:01.000Z",
    completed_at: "2026-03-23T00:00:03.000Z",
    created_at: "2026-03-23T00:00:01.000Z",
    updated_at: "2026-03-23T00:00:03.000Z",
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
    to: "nexus@example.com",
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
    version_number: 3,
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

test("getWorkflowRunDetail returns redacted payloads, step logs, and persisted attempt history", async () => {
  const draft = createTerminalActionDraft();
  const version = createWorkflowVersionRow(draft, { version_number: 7 });

  executionServiceDeps.getWorkflowRunRowByPublicId = async () => createRunRow();
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
    [
      { id: "version_db_1", workflow_id: "workflow_db_1", version_number: 7 },
    ] as never;
  executionServiceDeps.getWorkflowVersionRowById = async () => version;
  executionServiceDeps.listWorkflowRunStepRows = async () => [
    createStepRow(),
    createStepRow({
      id: "step_2",
      attempt_number: 2,
      sequence_number: 2,
      status: "success",
      error_code: null,
      error_message: null,
    }),
  ];
  executionServiceDeps.listWorkflowRunAttemptRows = async () => [
    createAttemptRow(),
    createAttemptRow({
      id: "attempt_2",
      attempt_number: 2,
      launch_reason: "manual_retry",
      requested_by_user_id: "user_retry",
      request_note: "Retry from the workspace",
      status: "failed",
    }),
  ];
  executionServiceDeps.getWorkflowIngestionOriginById = async () => ({
    id: "event_1",
    status: "accepted",
    source_context: { eventKey: null },
    triggered_by_user_id: "user_trigger",
    created_at: "2026-03-23T00:00:00.000Z",
  });
  executionServiceDeps.listWorkflowActorsByIds = async () =>
    [
      {
        id: "user_trigger",
        name: "Trigger User",
        email: "trigger@example.com",
      },
      {
        id: "user_retry",
        name: "Retry User",
        email: "retry@example.com",
      },
    ] as never;

  const detail = await getWorkflowRunDetail({
    organizationId: "org_1",
    runId: "RUN-1001",
  });

  assert.equal(detail.workflowVersionNumber, 7);
  assert.equal(detail.attempts.length, 2);
  assert.equal(detail.attempts[1]?.requestedBy?.email, "retry@example.com");
  assert.equal(detail.triggerActor?.name, "Trigger User");
  assert.equal(
    (detail.payload as { apiKey?: string }).apiKey,
    REDACTION_PLACEHOLDER,
  );
  assert.equal(detail.sourceContext.rawBody, REDACTION_PLACEHOLDER);
  assert.equal(
    detail.steps[0]?.inputPayload.requestBodyPreview,
    REDACTION_PLACEHOLDER,
  );
  assert.equal(
    detail.steps[0]?.outputPayload.responsePreview,
    REDACTION_PLACEHOLDER,
  );
  assert.equal(
    (
      detail.steps[0]?.logs[0] as {
        data?: { requestBodyPreview?: string; safe?: string };
      }
    )?.data?.requestBodyPreview,
    REDACTION_PLACEHOLDER,
  );
  assert.equal(
    (
      detail.steps[0]?.logs[0] as {
        data?: { requestBodyPreview?: string; safe?: string };
      }
    )?.data?.safe,
    "ok",
  );
});

test("getWorkflowRunDetail builds fallback attempt history when attempt rows are missing", async () => {
  const draft = createTerminalActionDraft();
  const version = createWorkflowVersionRow(draft, { version_number: 4 });

  executionServiceDeps.getWorkflowRunRowByPublicId = async () =>
    createRunRow({
      status: "retrying",
      attempt_count: 2,
      completed_at: null,
      next_retry_at: "2026-03-23T00:02:00.000Z",
      failure_code: "provider_timeout",
      failure_message: "Provider timed out",
    });
  executionServiceDeps.listWorkflowRowsByIds = async () =>
    [
      {
        id: "workflow_db_1",
        workflow_key: "WFL-1001",
        name: "Incident triage",
        status: "published",
        category: "Operations",
        latest_published_version_number: 4,
      },
    ] as never;
  executionServiceDeps.listWorkflowVersionRowsByIds = async () =>
    [
      { id: "version_db_1", workflow_id: "workflow_db_1", version_number: 4 },
    ] as never;
  executionServiceDeps.getWorkflowVersionRowById = async () => version;
  executionServiceDeps.listWorkflowRunStepRows = async () => [
    createStepRow({
      attempt_number: 1,
      sequence_number: 1,
      status: "failed",
    }),
  ];
  executionServiceDeps.listWorkflowRunAttemptRows = async () => [];
  executionServiceDeps.getWorkflowIngestionOriginById = async () => null;
  executionServiceDeps.listWorkflowActorsByIds = async () => [];

  const detail = await getWorkflowRunDetail({
    organizationId: "org_1",
    runId: "RUN-1001",
  });

  assert.equal(detail.attempts.length, 2);
  assert.equal(detail.attempts[0]?.status, "failed");
  assert.equal(detail.attempts[1]?.status, "scheduled");
  assert.equal(detail.attempts[1]?.failureCode, "provider_timeout");
});
