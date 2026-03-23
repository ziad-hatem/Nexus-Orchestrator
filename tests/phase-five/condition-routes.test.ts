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
  restoreMutableExports(workflowPublishRouteDeps, originalWorkflowPublishRouteDeps);
  restoreMutableExports(manualTriggerRouteDeps, originalManualTriggerRouteDeps);
  restoreMutableExports(executionDetailRouteDeps, originalExecutionDetailRouteDeps);
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

const invalidConditionIssue: ValidationIssue = {
  path: "config.conditions.condition_1.resolver.path",
  code: "invalid_condition_resolver_path",
  message:
    "Condition field paths may only use letters, numbers, dots, dashes, and underscores.",
  severity: "error",
};

test("PATCH workflow draft returns validation issues for invalid condition configs and enforces contracts", async () => {
  workflowDraftRouteDeps.auth = (async () => createSession("user_route")) as never;
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

  workflowDraftRouteDeps.getApiOrgAccess = async () => createOrgAccess("viewer");
  const forbiddenResponse = await patchWorkflowDraft(
    new Request("https://example.com/api/orgs/acme/workflows/WFL-1001/draft", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          conditions: [
            {
              id: "condition_1",
              label: "Priority check",
              description: "",
              resolver: { scope: "payload", path: "ticket..priority" },
              operator: "equals",
              value: "high",
              legacyExpression: null,
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
      workflowName: "Priority router",
      workflowStatus: "draft_only",
      draftId: "draft_1",
      versionCount: 0,
      draftUpdatedAt: "2026-03-23T00:00:00.000Z",
      draftUpdatedBy: null,
      validationIssues: [invalidConditionIssue],
      latestPublishedSnapshot: null,
      isArchived: false,
      draft: {
        metadata: {
          name: "Priority router",
          description: "",
          category: "Support",
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
          conditions: [
            {
              id: "condition_1",
              label: "Priority check",
              description: "",
              resolver: { scope: "payload", path: "ticket..priority" },
              operator: "equals",
              value: "high",
              legacyExpression: null,
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
    "invalid_condition_resolver_path",
  );
});

test("POST workflow publish returns 201 for valid publishes and 409 with issues for invalid conditions", async () => {
  workflowPublishRouteDeps.auth = (async () => createSession("user_route")) as never;
  workflowPublishRouteDeps.createRequestLogger = () => createLogger() as never;
  workflowPublishRouteDeps.handleRouteError = createRouteErrorResponse as never;
  workflowPublishRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("workflow_editor");

  let receivedNotes = "";
  workflowPublishRouteDeps.publishWorkflow = async ({ notes }) => {
    receivedNotes = notes ?? "";
    return {
      versionId: "version_1",
      workflowId: "WFL-1001",
      workflowName: "Priority router",
      versionNumber: 1,
      metadata: {
        name: "Priority router",
        description: "",
        category: "Support",
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
      notes: notes ?? "",
      validationIssues: [],
      publishedAt: "2026-03-23T00:00:00.000Z",
      publishedBy: null,
      validationIssueCount: 0,
      isCurrent: true,
    } as never;
  };

  const successResponse = await postWorkflowPublish(
    new Request("https://example.com/api/orgs/acme/workflows/WFL-1001/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Ready for production" }),
    }),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1001" }) },
  );

  assert.equal(successResponse.status, 201);
  assert.equal(receivedNotes, "Ready for production");

  workflowPublishRouteDeps.publishWorkflow = async () => {
    throw new WorkflowValidationError([invalidConditionIssue]);
  };

  const conflictResponse = await postWorkflowPublish(
    new Request("https://example.com/api/orgs/acme/workflows/WFL-1001/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "" }),
    }),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1001" }) },
  );
  const conflictPayload = await readJson<{
    error: string;
    issues: ValidationIssue[];
  }>(conflictResponse);

  assert.equal(conflictResponse.status, 409);
  assert.equal(conflictPayload.error, "Workflow validation failed");
  assert.equal(
    conflictPayload.issues[0]?.code,
    "invalid_condition_resolver_path",
  );
});

test("manual trigger route accepts nested condition payloads and forwards idempotency keys", async () => {
  let receivedPayload: unknown = null;
  let receivedIdempotencyKey: string | null | undefined;

  manualTriggerRouteDeps.auth = (async () => createSession("user_route")) as never;
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
            ticket: {
              priority: "high",
              customer: {
                tier: "vip",
              },
            },
          },
          idempotencyKey: "cond-run-1",
        }),
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1001" }) },
  );
  const payload = await readJson<{ run: { runId: string } }>(response);

  assert.equal(response.status, 201);
  assert.equal(payload.run.runId, "RUN-1001");
  assert.deepEqual(receivedPayload, {
    ticket: {
      priority: "high",
      customer: {
        tier: "vip",
      },
    },
  });
  assert.equal(receivedIdempotencyKey, "cond-run-1");
});

test("execution detail route returns condition-step payloads and preserves 404 mapping", async () => {
  executionDetailRouteDeps.auth = (async () => createSession("user_route")) as never;
  executionDetailRouteDeps.createRequestLogger = () => createLogger() as never;
  executionDetailRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("viewer");
  executionDetailRouteDeps.getWorkflowRunDetail = async () =>
    ({
      runId: "RUN-1001",
      workflowId: "WFL-1001",
      workflowName: "Priority router",
      workflowCategory: "Support",
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
          stepId: "step_condition",
          nodeId: "condition_1",
          nodeType: "condition",
          nodeLabel: "Priority check",
          sequenceNumber: 2,
          attemptNumber: 1,
          branchTaken: null,
          status: "success",
          correlationId: "corr_1",
          inputPayload: {
            authorization: "[REDACTED]",
          },
          outputPayload: {
            matched: false,
            resolverScope: "payload",
            resolverPath: "ticket.priority",
            operator: "equals",
            expectedValue: "urgent",
            resolvedValue: "normal",
            terminationReason: "condition_not_met",
            nextNodeId: null,
          },
          errorCode: null,
          errorMessage: null,
          logs: [
            {
              at: "2026-03-23T00:00:01.000Z",
              level: "info",
              message: "Condition did not match. Downstream actions were skipped.",
              data: {
                expectedValue: "urgent",
                resolvedValue: "normal",
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
      outputPayload: { terminationReason: string | null };
      logs: Array<{ message: string }>;
    }>;
  }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.payload.apiKey, "[REDACTED]");
  assert.equal(
    payload.steps[0]?.outputPayload.terminationReason,
    "condition_not_met",
  );
  assert.equal(
    payload.steps[0]?.logs[0]?.message,
    "Condition did not match. Downstream actions were skipped.",
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
