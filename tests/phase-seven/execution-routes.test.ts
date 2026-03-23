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
import { getRedactionPlaceholder } from "@/lib/observability/redaction";
import {
  getRolePermissions,
  type OrganizationRole,
} from "@/lib/server/permissions";
import { restoreMutableExports, readJson } from "@/tests/helpers/test-utils";

const originalExecutionsRouteDeps = { ...executionsRouteDeps };
const originalExecutionDetailRouteDeps = { ...executionDetailRouteDeps };
const REDACTION_PLACEHOLDER = getRedactionPlaceholder();

test.afterEach(() => {
  restoreMutableExports(executionsRouteDeps, originalExecutionsRouteDeps);
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

test("GET /api/orgs/[orgSlug]/executions rejects invalid filter payloads", async () => {
  executionsRouteDeps.auth = (async () => createSession("user_route")) as never;
  executionsRouteDeps.createRequestLogger = () => createLogger() as never;

  const response = await getExecutions(
    new Request(
      "https://example.com/api/orgs/acme/executions?page=0&pageSize=100",
    ),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 400);
  assert.match(payload.error, /(too small|>=1|page)/i);
});

test("GET /api/orgs/[orgSlug]/executions/[runId] returns observability fields for viewers", async () => {
  executionDetailRouteDeps.auth = (async () => createSession("user_route")) as never;
  executionDetailRouteDeps.createRequestLogger = () => createLogger() as never;
  executionDetailRouteDeps.getApiOrgAccess = async () => createOrgAccess("viewer");
  executionDetailRouteDeps.getWorkflowRunDetail = async () =>
    ({
      runId: "RUN-1001",
      workflowId: "WFL-1001",
      workflowName: "Incident triage",
      workflowCategory: "Operations",
      workflowStatus: "published",
      workflowVersionNumber: 4,
      triggerSource: "manual",
      status: "failed",
      correlationId: "corr_1",
      attemptCount: 2,
      maxAttempts: 3,
      startedAt: "2026-03-23T00:00:05.000Z",
      completedAt: "2026-03-23T00:00:07.000Z",
      cancelledAt: null,
      createdAt: "2026-03-23T00:00:00.000Z",
      lastHeartbeatAt: "2026-03-23T00:00:06.000Z",
      nextRetryAt: "2026-03-23T00:01:00.000Z",
      lastRetryAt: "2026-03-23T00:00:07.000Z",
      failureCode: "action_failure",
      failureMessage: "Email failed",
      idempotencyKey: "idem_1",
      retryEligible: true,
      cancelEligible: false,
      sourceContext: {
        sourceLabel: "manual",
        eventKey: null,
        requestPath: null,
        requestMethod: null,
        requestId: null,
        requestIp: "198.51.100.20",
        requestUserAgent: null,
        timestamp: null,
        actorUserId: "user_route",
        deliveryId: null,
        apiKeyVerified: null,
        rawBody: REDACTION_PLACEHOLDER,
      },
      payload: {
        apiKey: REDACTION_PLACEHOLDER,
      },
      createdByEventId: "event_1",
      cancelRequestedAt: null,
      attempts: [
        {
          attemptNumber: 1,
          launchReason: "initial",
          requestedBy: null,
          requestNote: null,
          scheduledFor: "2026-03-23T00:00:00.000Z",
          backoffSeconds: 0,
          status: "failed",
          failureCode: "action_failure",
          failureMessage: "Email failed",
          startedAt: "2026-03-23T00:00:01.000Z",
          completedAt: "2026-03-23T00:00:03.000Z",
        },
        {
          attemptNumber: 2,
          launchReason: "manual_retry",
          requestedBy: {
            id: "user_route",
            name: "Retry User",
            email: "retry@example.com",
          },
          requestNote: "Retry from the workspace",
          scheduledFor: "2026-03-23T00:00:30.000Z",
          backoffSeconds: 0,
          status: "failed",
          failureCode: "action_failure",
          failureMessage: "Email failed",
          startedAt: "2026-03-23T00:00:31.000Z",
          completedAt: "2026-03-23T00:00:33.000Z",
        },
      ],
      versionValidationIssues: [],
      recentEvent: null,
      steps: [
        {
          stepId: "step_1",
          nodeId: "action_1",
          nodeType: "action",
          nodeLabel: "Send email",
          sequenceNumber: 1,
          attemptNumber: 2,
          branchTaken: null,
          status: "failed",
          correlationId: "corr_1",
          inputPayload: {
            requestBodyPreview: REDACTION_PLACEHOLDER,
          },
          outputPayload: {},
          errorCode: "action_failure",
          errorMessage: "Email failed",
          logs: [
            {
              at: "2026-03-23T00:00:31.000Z",
              level: "info",
              message: "Provider preview",
              data: {
                responsePreview: REDACTION_PLACEHOLDER,
              },
            },
          ],
          startedAt: "2026-03-23T00:00:31.000Z",
          completedAt: "2026-03-23T00:00:33.000Z",
        },
      ],
      triggerActor: {
        id: "user_route",
        name: "Trigger User",
        email: "trigger@example.com",
      },
    }) as never;

  const response = await getExecutionDetail(
    new Request("https://example.com/api/orgs/acme/executions/RUN-1001"),
    { params: Promise.resolve({ orgSlug: "acme", runId: "RUN-1001" }) },
  );
  const payload = await readJson<{
    attempts: Array<{ attemptNumber: number }>;
    sourceContext: { rawBody: string };
    steps: Array<{ logs: Array<{ data?: { responsePreview?: string } }> }>;
  }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.attempts.length, 2);
  assert.equal(payload.sourceContext.rawBody, REDACTION_PLACEHOLDER);
  assert.equal(
    payload.steps[0]?.logs[0]?.data?.responsePreview,
    REDACTION_PLACEHOLDER,
  );
});
