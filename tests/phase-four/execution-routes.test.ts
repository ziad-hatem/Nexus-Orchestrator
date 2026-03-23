import assert from "node:assert/strict";
import test from "node:test";
import {
  GET as getExecutions,
  executionsRouteDeps,
} from "@/app/api/orgs/[orgSlug]/executions/route";
import {
  GET as getExecutionDetail,
  executionDetailRouteDeps,
} from "@/app/api/orgs/[orgSlug]/executions/[runId]/route";
import {
  POST as postExecutionCancel,
  executionCancelRouteDeps,
} from "@/app/api/orgs/[orgSlug]/executions/[runId]/cancel/route";
import {
  POST as postExecutionRetry,
  executionRetryRouteDeps,
} from "@/app/api/orgs/[orgSlug]/executions/[runId]/retry/route";
import {
  getRolePermissions,
  type OrganizationRole,
} from "@/lib/server/permissions";
import {
  WorkflowExecutionConflictError,
  WorkflowExecutionNotFoundError,
} from "@/lib/server/executions/service";
import { restoreMutableExports, readJson } from "@/tests/helpers/test-utils";

const originalExecutionsRouteDeps = { ...executionsRouteDeps };
const originalExecutionDetailRouteDeps = { ...executionDetailRouteDeps };
const originalExecutionCancelRouteDeps = { ...executionCancelRouteDeps };
const originalExecutionRetryRouteDeps = { ...executionRetryRouteDeps };

test.afterEach(() => {
  restoreMutableExports(executionsRouteDeps, originalExecutionsRouteDeps);
  restoreMutableExports(
    executionDetailRouteDeps,
    originalExecutionDetailRouteDeps,
  );
  restoreMutableExports(
    executionCancelRouteDeps,
    originalExecutionCancelRouteDeps,
  );
  restoreMutableExports(
    executionRetryRouteDeps,
    originalExecutionRetryRouteDeps,
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

test("GET /api/orgs/[orgSlug]/executions returns filtered execution lists for viewers", async () => {
  let receivedFilters: unknown = null;

  executionsRouteDeps.auth = (async () => createSession("user_route")) as never;
  executionsRouteDeps.createRequestLogger = () => createLogger() as never;
  executionsRouteDeps.getApiOrgAccess = async () => createOrgAccess("viewer");
  executionsRouteDeps.listWorkflowRunSummaries = async ({ filters }) => {
    receivedFilters = filters;
    return {
      items: [
        {
          runId: "RUN-1001",
          workflowId: "WFL-1001",
          workflowName: "Incident triage",
          workflowCategory: "Operations",
          workflowStatus: "published",
          workflowVersionNumber: 1,
          triggerSource: "manual",
          status: "failed",
          correlationId: "corr_1",
          attemptCount: 1,
          maxAttempts: 3,
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
          createdAt: "2026-03-23T00:00:00.000Z",
          lastHeartbeatAt: null,
          nextRetryAt: null,
          lastRetryAt: null,
          failureCode: "action_failure",
          failureMessage: "Email failed",
          idempotencyKey: null,
          retryEligible: true,
          cancelEligible: false,
        },
      ],
      total: 1,
      page: 2,
      pageSize: 1,
      summary: {
        total: 1,
        pending: 0,
        running: 0,
        success: 0,
        failed: 1,
        retrying: 0,
        cancelled: 0,
        topFailureCodes: [{ failureCode: "action_failure", count: 1 }],
      },
    };
  };

  const response = await getExecutions(
    new Request(
      "https://example.com/api/orgs/acme/executions?query=RUN-1001&status=failed&page=2&pageSize=1",
    ),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const payload = await readJson<{ total: number; page: number }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.total, 1);
  assert.equal(payload.page, 2);
  const filters = receivedFilters as { query?: string; status?: string };
  assert.equal(filters.query, "RUN-1001");
  assert.equal(filters.status, "failed");
});

test("GET /api/orgs/[orgSlug]/executions/[runId] maps missing runs to 404", async () => {
  executionDetailRouteDeps.auth = (async () => createSession("user_route")) as never;
  executionDetailRouteDeps.createRequestLogger = () => createLogger() as never;
  executionDetailRouteDeps.getApiOrgAccess = async () => createOrgAccess("viewer");
  executionDetailRouteDeps.getWorkflowRunDetail = async () => {
    throw new WorkflowExecutionNotFoundError();
  };
  executionDetailRouteDeps.handleRouteError = createRouteErrorResponse as never;

  const response = await getExecutionDetail(
    new Request("https://example.com/api/orgs/acme/executions/RUN-404"),
    { params: Promise.resolve({ orgSlug: "acme", runId: "RUN-404" }) },
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 404);
  assert.equal(payload.error, "Workflow run not found.");
});

test("cancel route rejects malformed JSON and enforces role checks", async () => {
  executionCancelRouteDeps.auth = (async () => createSession("user_route")) as never;
  executionCancelRouteDeps.createRequestLogger = () => createLogger() as never;

  const malformedResponse = await postExecutionCancel(
    new Request("https://example.com/api/orgs/acme/executions/RUN-1001/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
    { params: Promise.resolve({ orgSlug: "acme", runId: "RUN-1001" }) },
  );
  assert.equal(malformedResponse.status, 400);

  executionCancelRouteDeps.getApiOrgAccess = async () => createOrgAccess("viewer");

  const forbiddenResponse = await postExecutionCancel(
    new Request("https://example.com/api/orgs/acme/executions/RUN-1001/cancel", {
      method: "POST",
    }),
    { params: Promise.resolve({ orgSlug: "acme", runId: "RUN-1001" }) },
  );
  assert.equal(forbiddenResponse.status, 403);
});

test("cancel route maps conflicts and successful cancellations", async () => {
  executionCancelRouteDeps.auth = (async () => createSession("user_route")) as never;
  executionCancelRouteDeps.createRequestLogger = () => createLogger() as never;
  executionCancelRouteDeps.getApiOrgAccess = async () => createOrgAccess("operator");
  executionCancelRouteDeps.handleRouteError = createRouteErrorResponse as never;
  executionCancelRouteDeps.cancelWorkflowRun = async () => {
    throw new WorkflowExecutionConflictError("Terminal runs cannot be cancelled.");
  };

  const conflictResponse = await postExecutionCancel(
    new Request("https://example.com/api/orgs/acme/executions/RUN-1001/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Stop it" }),
    }),
    { params: Promise.resolve({ orgSlug: "acme", runId: "RUN-1001" }) },
  );
  assert.equal(conflictResponse.status, 409);

  executionCancelRouteDeps.cancelWorkflowRun = async () =>
    ({
      accepted: true,
      mode: "immediate",
      run: {
        runId: "RUN-1001",
        status: "cancelled",
      },
    }) as never;

  const successResponse = await postExecutionCancel(
    new Request("https://example.com/api/orgs/acme/executions/RUN-1001/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Stop it" }),
    }),
    { params: Promise.resolve({ orgSlug: "acme", runId: "RUN-1001" }) },
  );
  const successPayload = await readJson<{ mode: string }>(successResponse);

  assert.equal(successResponse.status, 200);
  assert.equal(successPayload.mode, "immediate");
});

test("retry route rejects malformed JSON and maps not-found, conflict, and success", async () => {
  executionRetryRouteDeps.auth = (async () => createSession("user_route")) as never;
  executionRetryRouteDeps.createRequestLogger = () => createLogger() as never;
  executionRetryRouteDeps.handleRouteError = createRouteErrorResponse as never;

  const malformedResponse = await postExecutionRetry(
    new Request("https://example.com/api/orgs/acme/executions/RUN-1001/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
    { params: Promise.resolve({ orgSlug: "acme", runId: "RUN-1001" }) },
  );
  assert.equal(malformedResponse.status, 400);

  executionRetryRouteDeps.getApiOrgAccess = async () => createOrgAccess("workflow_editor");
  executionRetryRouteDeps.retryWorkflowRun = async () => {
    throw new WorkflowExecutionNotFoundError();
  };

  const notFoundResponse = await postExecutionRetry(
    new Request("https://example.com/api/orgs/acme/executions/RUN-404/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Retry it" }),
    }),
    { params: Promise.resolve({ orgSlug: "acme", runId: "RUN-404" }) },
  );
  assert.equal(notFoundResponse.status, 404);

  executionRetryRouteDeps.retryWorkflowRun = async () => {
    throw new WorkflowExecutionConflictError(
      "Only failed or cancelled runs can be retried.",
    );
  };

  const conflictResponse = await postExecutionRetry(
    new Request("https://example.com/api/orgs/acme/executions/RUN-1001/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Retry it" }),
    }),
    { params: Promise.resolve({ orgSlug: "acme", runId: "RUN-1001" }) },
  );
  assert.equal(conflictResponse.status, 409);

  executionRetryRouteDeps.retryWorkflowRun = async () =>
    ({
      accepted: true,
      mode: "manual_retry",
      attemptNumber: 2,
      run: {
        runId: "RUN-1001",
        status: "pending",
      },
    }) as never;

  const successResponse = await postExecutionRetry(
    new Request("https://example.com/api/orgs/acme/executions/RUN-1001/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Retry it" }),
    }),
    { params: Promise.resolve({ orgSlug: "acme", runId: "RUN-1001" }) },
  );
  const successPayload = await readJson<{ mode: string; attemptNumber: number }>(
    successResponse,
  );

  assert.equal(successResponse.status, 200);
  assert.equal(successPayload.mode, "manual_retry");
  assert.equal(successPayload.attemptNumber, 2);
});
