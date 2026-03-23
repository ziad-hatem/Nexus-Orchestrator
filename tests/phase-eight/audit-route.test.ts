import assert from "node:assert/strict";
import test from "node:test";
import {
  GET as getAuditLogs,
  auditRouteDeps,
} from "@/app/api/orgs/[orgSlug]/audit/route";
import {
  getRolePermissions,
  type OrganizationRole,
} from "@/lib/server/permissions";
import { restoreMutableExports, readJson } from "@/tests/helpers/test-utils";

const originalAuditRouteDeps = { ...auditRouteDeps };

test.afterEach(() => {
  restoreMutableExports(auditRouteDeps, originalAuditRouteDeps);
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
      userId: "user_audit",
      organization: {
        id: "org_audit",
        name: "Acme",
        slug: "acme",
        logo_url: null,
        created_at: "2026-03-23T00:00:00.000Z",
        updated_at: "2026-03-23T00:00:00.000Z",
      },
      membership: {
        membershipId: "membership_audit",
        organizationId: "org_audit",
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

test("GET /api/orgs/[orgSlug]/audit validates filter payloads", async () => {
  auditRouteDeps.auth = (async () => createSession("user_audit")) as never;
  auditRouteDeps.createRequestLogger = () => createLogger() as never;
  auditRouteDeps.getApiOrgAccess = async () => createOrgAccess("org_admin");

  const response = await getAuditLogs(
    new Request("https://example.com/api/orgs/acme/audit?page=0&pageSize=200"),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 400);
  assert.match(payload.error, /(too small|page|50)/i);
});

test("GET /api/orgs/[orgSlug]/audit enforces role and tenant access", async () => {
  auditRouteDeps.auth = (async () => createSession("user_audit")) as never;
  auditRouteDeps.createRequestLogger = () => createLogger() as never;
  auditRouteDeps.getApiOrgAccess = async () => createOrgAccess("viewer");

  const forbiddenResponse = await getAuditLogs(
    new Request("https://example.com/api/orgs/acme/audit"),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const forbiddenPayload = await readJson<{ error: string }>(forbiddenResponse);

  assert.equal(forbiddenResponse.status, 403);
  assert.equal(forbiddenPayload.error, "Forbidden");

  auditRouteDeps.getApiOrgAccess = async () =>
    ({
      ok: false,
      status: 404,
      error: "Organization not found",
    }) as never;

  const missingResponse = await getAuditLogs(
    new Request("https://example.com/api/orgs/missing/audit"),
    { params: Promise.resolve({ orgSlug: "missing" }) },
  );

  assert.equal(missingResponse.status, 404);
});

test("GET /api/orgs/[orgSlug]/audit returns logs, filters, and coverage summary", async () => {
  auditRouteDeps.auth = (async () => createSession("user_audit")) as never;
  auditRouteDeps.createRequestLogger = () => createLogger() as never;
  auditRouteDeps.getApiOrgAccess = async () => createOrgAccess("org_admin");
  auditRouteDeps.listAuditLogs = async () => ({
    logs: [
      {
        id: "log_1",
        organization_id: "org_audit",
        actor_user_id: "user_audit",
        action: "workflow.webhook_secret_regenerated",
        entity_type: "workflow",
        entity_id: "WFL-1",
        metadata: {
          secretLastFour: "1234",
        },
        ip_address: "203.0.113.42",
        user_agent: "qa-suite",
        created_at: "2026-03-23T00:00:00.000Z",
        actor: {
          id: "user_audit",
          name: "Admin User",
          email: "admin@example.com",
        },
      },
    ],
    total: 1,
    summary: {
      total: 1,
      uniqueActorCount: 1,
      securityEventCount: 1,
      topActions: [{ action: "workflow.webhook_secret_regenerated", count: 1 }],
      coverage: {
        requiredActions: ["workflow.webhook_secret_regenerated"],
        observedActions: ["workflow.webhook_secret_regenerated"],
        missingActions: [],
        coveredCount: 1,
        totalRequired: 1,
      },
    },
    availableActions: ["workflow.webhook_secret_regenerated"],
  });

  const response = await getAuditLogs(
    new Request(
      "https://example.com/api/orgs/acme/audit?action=workflow.webhook_secret_regenerated&page=1&pageSize=20",
    ),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const payload = await readJson<{
    total: number;
    page: number;
    pageSize: number;
    summary: { coverage: { coveredCount: number } };
  }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.total, 1);
  assert.equal(payload.page, 1);
  assert.equal(payload.pageSize, 20);
  assert.equal(payload.summary.coverage.coveredCount, 1);
});
