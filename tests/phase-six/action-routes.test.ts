import assert from "node:assert/strict";
import test from "node:test";
import {
  PATCH as patchWorkflowDraft,
  workflowDraftRouteDeps,
} from "@/app/api/orgs/[orgSlug]/workflows/[workflowId]/draft/route";
import {
  POST as postWorkflowPublish,
  workflowPublishRouteDeps,
} from "@/app/api/orgs/[orgSlug]/workflows/[workflowId]/publish/route";
import {
  POST as postManualTrigger,
  manualTriggerRouteDeps,
} from "@/app/api/orgs/[orgSlug]/workflows/[workflowId]/trigger/manual/route";
import {
  GET as getExecutionDetail,
  executionDetailRouteDeps,
} from "@/app/api/orgs/[orgSlug]/executions/[runId]/route";
import {
  getRolePermissions,
  type OrganizationRole,
} from "@/lib/server/permissions";
import type { ValidationIssue } from "@/lib/server/workflows/types";
import { WorkflowValidationError } from "@/lib/server/workflows/service";
import { WorkflowExecutionNotFoundError } from "@/lib/server/executions/service";
import { restoreMutableExports, readJson } from "@/tests/helpers/test-utils";

const originalWorkflowDraftRouteDeps = { ...workflowDraftRouteDeps };
const originalWorkflowPublishRouteDeps = { ...workflowPublishRouteDeps };
const originalManualTriggerRouteDeps = { ...manualTriggerRouteDeps };
const originalExecutionDetailRouteDeps = { ...executionDetailRouteDeps };

test.afterEach(() => {
  restoreMutableExports(workflowDraftRouteDeps, originalWorkflowDraftRouteDeps);
  restoreMutableExports(
    workflowPublishRouteDeps,
    originalWorkflowPublishRouteDeps,
  );
  restoreMutableExports(manualTriggerRouteDeps, originalManualTriggerRouteDeps);
  restoreMutableExports(
    executionDetailRouteDeps,
    originalExecutionDetailRouteDeps,
  );
});

function createLogger() {
  return {
    info() {},
    warn() {},
    error() {},
  };
}

function createSession(userId: string) {
  return {
    user: { id: userId },
    expires: "2099-01-01T00:00:00.000Z",
  };
}

function createOrgAccess(role: OrganizationRole) {
  return {
    ok: true as const,
    context: {
      userId: "user_route",
      organization: {
        id: "org_route",
        name: "Acme",
        slug: "acme",
        logo_url: null,
        created_at: "2026-03-23T00:00:00.000Z",
        updated_at: "2026-03-23T00:00:00.000Z",
      },
      membership: {
        membershipId: "membership_route",
        organizationId: "org_route",
        organizationName: "Acme",
        organizationSlug: "acme",
        organizationLogoUrl: null,
        role,
        status: "active" as const,
        joinedAt: "2026-03-23T00:00:00.000Z",
        createdAt: "2026-03-23T00:00:00.000Z",
      },
      permissions: getRolePermissions(role),
    },
  };
}

function createRouteErrorResponse(
  error: unknown,
  options: {
    status?: number;
    publicMessage?: string;
    fallbackMessage: string;
  },
) {
  return Response.json(
    {
      error:
        options.publicMessage ??
        (error instanceof Error ? error.message : options.fallbackMessage),
    },
    { status: options.status ?? 500 },
  );
}

const invalidActionIssue: ValidationIssue = {
  path: "config.actions.action_1.config.field",
  code: "unsafe_update_record_field",
  message:
    "Update record actions must use a static safe field key containing only letters, numbers, underscores, or dashes.",
  severity: "error",
};

test("PATCH workflow draft persists invalid action configs and returns validation issues", async () => {
  workflowDraftRouteDeps.auth = (async () =>
    createSession("user_route")) as never;
  workflowDraftRouteDeps.createRequestLogger = () => createLogger() as never;

  const malformedResponse = await patchWorkflowDraft(
    new Request("https://example.com/api/orgs/acme/workflows/WFL-1001/draft", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1001" }) },
  );
  assert.equal(malformedResponse.status, 400);

  workflowDraftRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("viewer");
  const forbiddenResponse = await patchWorkflowDraft(
    new Request("https://example.com/api/orgs/acme/workflows/WFL-1001/draft", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          actions: [
            {
              id: "action_1",
              label: "Update record",
              description: "",
              type: "update_record_field",
              config: {
                recordType: "ticket",
                recordKey: "{{ payload.ticketId }}",
                field: "__proto__",
                valueType: "string",
                valueTemplate: "{{ payload.priority }}",
              },
              legacySourceType: null,
              legacyIssue: null,
            },
          ],
        },
      }),
    }),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1001" }) },
  );
  assert.equal(forbiddenResponse.status, 403);

  workflowDraftRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("workflow_editor");
  workflowDraftRouteDeps.updateWorkflowDraft = async () =>
    ({
      workflowId: "WFL-1001",
      workflowName: "Action runner",
      workflowStatus: "draft_only",
      draftId: "draft_1",
      versionCount: 0,
      draftUpdatedAt: "2026-03-23T00:00:00.000Z",
      draftUpdatedBy: null,
      validationIssues: [invalidActionIssue],
      latestPublishedSnapshot: null,
      isArchived: false,
      draft: {
        metadata: {
          name: "Action runner",
          description: "",
          category: "Operations",
          tags: [],
        },
        config: {
          trigger: {
            id: "trigger_1",
            type: "manual",
            label: "Manual trigger",
            description: "",
            config: {},
          },
          conditions: [],
          actions: [],
        },
        canvas: {
          nodes: [],
          edges: [],
        },
      },
    }) as never;

  const response = await patchWorkflowDraft(
    new Request("https://example.com/api/orgs/acme/workflows/WFL-1001/draft", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          actions: [
            {
              id: "action_1",
              label: "Update record",
              description: "",
              type: "update_record_field",
              config: {
                recordType: "ticket",
                recordKey: "{{ payload.ticketId }}",
                field: "__proto__",
                valueType: "string",
                valueTemplate: "{{ payload.priority }}",
              },
              legacySourceType: null,
              legacyIssue: null,
            },
          ],
        },
      }),
    }),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1001" }) },
  );
  const payload = await readJson<{
    draft: { validationIssues: ValidationIssue[] };
  }>(response);

  assert.equal(response.status, 200);
  assert.equal(
    payload.draft.validationIssues[0]?.code,
    "unsafe_update_record_field",
  );
});

test("POST workflow publish returns 201 for valid publishes and 409 with action issues for invalid configs", async () => {
  workflowPublishRouteDeps.auth = (async () =>
    createSession("user_route")) as never;
  workflowPublishRouteDeps.createRequestLogger = () => createLogger() as never;
  workflowPublishRouteDeps.handleRouteError = createRouteErrorResponse as never;
  workflowPublishRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("workflow_editor");

  workflowPublishRouteDeps.publishWorkflow = async () =>
    ({
      versionId: "version_1",
      workflowId: "WFL-1001",
      workflowName: "Action runner",
      versionNumber: 1,
      metadata: {
        name: "Action runner",
        description: "",
        category: "Operations",
        tags: [],
      },
      config: {
        trigger: null,
        conditions: [],
        actions: [],
      },
      canvas: {
        nodes: [],
        edges: [],
      },
      notes: "Release note",
      validationIssues: [],
      publishedAt: "2026-03-23T00:00:00.000Z",
      publishedBy: null,
      validationIssueCount: 0,
      isCurrent: true,
    }) as never;

  const successResponse = await postWorkflowPublish(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1001/publish",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Release note" }),
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1001" }) },
  );
  assert.equal(successResponse.status, 201);

  workflowPublishRouteDeps.publishWorkflow = async () => {
    throw new WorkflowValidationError([invalidActionIssue]);
  };

  const conflictResponse = await postWorkflowPublish(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1001/publish",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "" }),
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1001" }) },
  );
  const conflictPayload = await readJson<{
    error: string;
    issues: ValidationIssue[];
  }>(conflictResponse);

  assert.equal(conflictResponse.status, 409);
  assert.equal(conflictPayload.error, "Workflow validation failed");
  assert.equal(conflictPayload.issues[0]?.code, "unsafe_update_record_field");
});

test("manual trigger route forwards nested payloads and idempotency keys for action workflows", async () => {
  let receivedPayload: unknown = null;
  let receivedIdempotencyKey: string | null | undefined;

  manualTriggerRouteDeps.auth = (async () =>
    createSession("user_route")) as never;
  manualTriggerRouteDeps.createRequestLogger = () => createLogger() as never;
  manualTriggerRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("workflow_editor");
  manualTriggerRouteDeps.executeManualTrigger = async (params) => {
    receivedPayload = params.payload;
    receivedIdempotencyKey = params.idempotencyKey;
    return {
      event: { id: "event_1" },
      run: { runId: "RUN-1001" },
    } as never;
  };

  const response = await postManualTrigger(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1001/trigger/manual",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            ticketId: "T-100",
            priority: 7,
            tags: ["vip", "escalated"],
          },
          idempotencyKey: "action-run-1",
        }),
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1001" }) },
  );
  const payload = await readJson<{ run: { runId: string } }>(response);

  assert.equal(response.status, 201);
  assert.equal(payload.run.runId, "RUN-1001");
  assert.deepEqual(receivedPayload, {
    ticketId: "T-100",
    priority: 7,
    tags: ["vip", "escalated"],
  });
  assert.equal(receivedIdempotencyKey, "action-run-1");
});

test("execution detail route returns action outcomes and preserves 404 mapping", async () => {
  executionDetailRouteDeps.auth = (async () =>
    createSession("user_route")) as never;
  executionDetailRouteDeps.createRequestLogger = () => createLogger() as never;
  executionDetailRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("viewer");
  executionDetailRouteDeps.getWorkflowRunDetail = async () =>
    ({
      runId: "RUN-1001",
      workflowId: "WFL-1001",
      workflowName: "Action runner",
      workflowCategory: "Operations",
      workflowStatus: "published",
      workflowVersionNumber: 1,
      triggerSource: "manual",
      status: "success",
      correlationId: "corr_1",
      attemptCount: 1,
      maxAttempts: 3,
      startedAt: "2026-03-23T00:00:00.000Z",
      completedAt: "2026-03-23T00:00:01.000Z",
      cancelledAt: null,
      createdAt: "2026-03-23T00:00:00.000Z",
      lastHeartbeatAt: null,
      nextRetryAt: null,
      lastRetryAt: null,
      failureCode: null,
      failureMessage: null,
      idempotencyKey: null,
      retryEligible: false,
      cancelEligible: false,
      sourceContext: {
        sourceLabel: "manual",
      },
      payload: {
        apiKey: "[REDACTED]",
      },
      createdByEventId: null,
      cancelRequestedAt: null,
      attempts: [],
      versionValidationIssues: [],
      recentEvent: null,
      steps: [
        {
          stepId: "step_action",
          nodeId: "action_1",
          nodeType: "action",
          nodeLabel: "Send email",
          sequenceNumber: 2,
          attemptNumber: 1,
          branchTaken: null,
          status: "success",
          correlationId: "corr_1",
          inputPayload: {
            authorization: "[REDACTED]",
          },
          outputPayload: {
            actionType: "send_email",
            recipient: "nexus@example.com",
            subject: "Ticket T-100",
            providerMessageId: "msg_123",
            replyTo: "support@example.com",
          },
          errorCode: null,
          errorMessage: null,
          logs: [
            {
              at: "2026-03-23T00:00:01.000Z",
              level: "info",
              message: "Sending email action through Resend.",
              data: {
                to: "nexus@example.com",
              },
            },
          ],
          startedAt: "2026-03-23T00:00:00.000Z",
          completedAt: "2026-03-23T00:00:01.000Z",
        },
      ],
      triggerActor: null,
    }) as never;

  const response = await getExecutionDetail(
    new Request("https://example.com/api/orgs/acme/executions/RUN-1001"),
    { params: Promise.resolve({ orgSlug: "acme", runId: "RUN-1001" }) },
  );
  const payload = await readJson<{
    payload: { apiKey: string };
    steps: Array<{
      outputPayload: { actionType: string; providerMessageId: string | null };
      logs: Array<{ message: string }>;
    }>;
  }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.payload.apiKey, "[REDACTED]");
  assert.equal(payload.steps[0]?.outputPayload.actionType, "send_email");
  assert.equal(payload.steps[0]?.outputPayload.providerMessageId, "msg_123");
  assert.equal(
    payload.steps[0]?.logs[0]?.message,
    "Sending email action through Resend.",
  );

  executionDetailRouteDeps.getWorkflowRunDetail = async () => {
    throw new WorkflowExecutionNotFoundError();
  };

  const missingResponse = await getExecutionDetail(
    new Request("https://example.com/api/orgs/acme/executions/RUN-404"),
    { params: Promise.resolve({ orgSlug: "acme", runId: "RUN-404" }) },
  );

  assert.equal(missingResponse.status, 404);
});
