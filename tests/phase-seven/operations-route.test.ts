import assert from "node:assert/strict";
import test from "node:test";
import {
  GET as getOperations,
  operationsRouteDeps,
} from "@/app/api/orgs/[orgSlug]/operations/route";
import {
  getRolePermissions,
  type OrganizationRole,
} from "@/lib/server/permissions";
import { restoreMutableExports, readJson } from "@/tests/helpers/test-utils";

const originalOperationsRouteDeps = { ...operationsRouteDeps };

test.afterEach(() => {
  restoreMutableExports(operationsRouteDeps, originalOperationsRouteDeps);
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
      userId: "user_ops",
      organization: {
        id: "org_ops",
        name: "Acme",
        slug: "acme",
        logo_url: null,
        created_at: "2026-03-23T00:00:00.000Z",
        updated_at: "2026-03-23T00:00:00.000Z",
      },
      membership: {
        membershipId: "membership_ops",
        organizationId: "org_ops",
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

function createDashboardData() {
  return {
    generatedAt: "2026-03-23T00:00:00.000Z",
    lookbackMinutes: 60,
    metrics: {
      runs: {
        total: 2,
        pending: 0,
        running: 1,
        success: 0,
        failed: 1,
        retrying: 0,
        cancelled: 0,
        topFailureCodes: [{ failureCode: "action_failure", count: 1 }],
      },
      topFailureCodes: [{ failureCode: "action_failure", count: 1 }],
      webhooks: {
        lookbackMinutes: 60,
        accepted: 3,
        rejected: 1,
        duplicate: 0,
        rateLimited: 0,
      },
      audit: {
        total: 4,
        uniqueActorCount: 2,
        securityEventCount: 1,
        topActions: [{ action: "workflow.run_retried", count: 2 }],
        coverage: {
          requiredActions: [],
          observedActions: [],
          missingActions: [],
          coveredCount: 0,
          totalRequired: 0,
        },
      },
    },
    alerts: [],
    queue: {
      readyBacklog: 1,
      delayedBacklog: 2,
      totalBacklog: 3,
      staleRunningCount: 0,
      retryBacklogCount: 1,
    },
    retention: {
      auditLogDays: 365,
      executionLogDays: 90,
      ingestionEventDays: 30,
      dryRunCommand: "npm run retention:prune:dry-run",
      applyCommand: "npm run retention:prune",
    },
    checklist: [],
  };
}

test("GET /api/orgs/[orgSlug]/operations rejects invalid query payloads", async () => {
  operationsRouteDeps.auth = (async () => createSession("user_ops")) as never;
  operationsRouteDeps.createRequestLogger = () => createLogger() as never;
  operationsRouteDeps.operationsDashboardQuerySchema = {
    safeParse: () => ({ success: false }),
  } as never;

  const response = await getOperations(
    new Request("https://example.com/api/orgs/acme/operations?emitAlerts=maybe"),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Invalid operations query");
});

test("GET /api/orgs/[orgSlug]/operations enforces role checks", async () => {
  operationsRouteDeps.auth = (async () => createSession("user_ops")) as never;
  operationsRouteDeps.createRequestLogger = () => createLogger() as never;
  operationsRouteDeps.getApiOrgAccess = async () => createOrgAccess("viewer");

  const response = await getOperations(
    new Request("https://example.com/api/orgs/acme/operations"),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Forbidden");
});

test("GET /api/orgs/[orgSlug]/operations returns dashboard data for operators", async () => {
  let receivedEmitAlerts = false;

  operationsRouteDeps.auth = (async () => createSession("user_ops")) as never;
  operationsRouteDeps.createRequestLogger = () => createLogger() as never;
  operationsRouteDeps.getApiOrgAccess = async () => createOrgAccess("operator");
  operationsRouteDeps.getOperationsDashboardData = async (params) => {
    receivedEmitAlerts = params.emitAlerts ?? false;
    return createDashboardData();
  };

  const response = await getOperations(
    new Request("https://example.com/api/orgs/acme/operations?emitAlerts=true"),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const payload = await readJson<{ queue: { totalBacklog: number } }>(response);

  assert.equal(response.status, 200);
  assert.equal(receivedEmitAlerts, true);
  assert.equal(payload.queue.totalBacklog, 3);
});
