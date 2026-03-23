import assert from "node:assert/strict";
import test from "node:test";
import { getApiOrgAccess, orgAccessDeps, requirePageOrgAccess } from "@/lib/server/org-access";
import { auditLogDeps, writeAuditLog } from "@/lib/server/audit-log";
import { restoreMutableExports } from "@/tests/helpers/test-utils";
import { createSupabaseMock } from "@/tests/helpers/fake-supabase";

const originalOrgAccessDeps = { ...orgAccessDeps };
const originalAuditLogDeps = { ...auditLogDeps };

test.afterEach(() => {
  restoreMutableExports(orgAccessDeps, originalOrgAccessDeps);
  restoreMutableExports(auditLogDeps, originalAuditLogDeps);
});

function createSession(userId: string) {
  return {
    user: { id: userId },
    expires: "2099-01-01T00:00:00.000Z",
  };
}

test("getApiOrgAccess returns 401, 404, 403, and success for tenant access decisions", async () => {
  const unauthenticated = await getApiOrgAccess({
    orgSlug: "org-unauthorized",
    userId: null,
  });
  assert.deepEqual(unauthenticated, {
    ok: false,
    status: 401,
    error: "Unauthorized",
  });

  const monitoringCalls: Array<Record<string, unknown>> = [];
  orgAccessDeps.applyMonitoringContext = (context) => {
    monitoringCalls.push(context as Record<string, unknown>);
  };
  orgAccessDeps.getOrganizationBySlug = async (slug) => {
    if (slug === "missing-org") {
      return null;
    }

    return {
      id: "org_123",
      name: "Acme",
      slug,
      logo_url: null,
      created_at: "2026-03-23T00:00:00.000Z",
      updated_at: "2026-03-23T00:00:00.000Z",
    };
  };
  orgAccessDeps.listUserOrganizations = async (userId) => {
    if (userId === "suspended_user") {
      return [
        {
          membershipId: "membership_suspended",
          organizationId: "org_123",
          organizationName: "Acme",
          organizationSlug: "forbidden-org",
          organizationLogoUrl: null,
          role: "viewer",
          status: "suspended",
          joinedAt: null,
          createdAt: "2026-03-23T00:00:00.000Z",
        },
      ];
    }

    return [
      {
        membershipId: "membership_active",
        organizationId: "org_123",
        organizationName: "Acme",
        organizationSlug: "active-org",
        organizationLogoUrl: null,
        role: "operator",
        status: "active",
        joinedAt: null,
        createdAt: "2026-03-23T00:00:00.000Z",
      },
    ];
  };

  const missing = await getApiOrgAccess({
    orgSlug: "missing-org",
    userId: "user_missing",
  });
  assert.deepEqual(missing, {
    ok: false,
    status: 404,
    error: "Organization not found",
  });

  const forbidden = await getApiOrgAccess({
    orgSlug: "forbidden-org",
    userId: "suspended_user",
  });
  assert.deepEqual(forbidden, {
    ok: false,
    status: 403,
    error: "Forbidden",
  });

  const success = await getApiOrgAccess({
    orgSlug: "active-org",
    userId: "user_active",
  });

  assert.equal(success.ok, true);
  if (success.ok) {
    assert.equal(success.context.membership.role, "operator");
    assert.equal(success.context.permissions.canViewAuditLogs, true);
  }
  assert.equal(monitoringCalls.length, 1);
  assert.equal(monitoringCalls[0]?.organizationSlug, "active-org");
});

test("requirePageOrgAccess throws through unauthorized, notFound, and forbidden hooks", async () => {
  orgAccessDeps.auth = (async () => null) as never;
  orgAccessDeps.unauthorized = () => {
    throw new Error("UNAUTHORIZED_HIT");
  };

  await assert.rejects(
    () => requirePageOrgAccess("page-org-unauthorized"),
    /UNAUTHORIZED_HIT/,
  );

  orgAccessDeps.auth = (async () => createSession("page_user_missing")) as never;
  orgAccessDeps.getOrganizationBySlug = async () => null;
  orgAccessDeps.notFound = () => {
    throw new Error("NOT_FOUND_HIT");
  };

  await assert.rejects(
    () => requirePageOrgAccess("page-org-missing"),
    /NOT_FOUND_HIT/,
  );

  orgAccessDeps.getOrganizationBySlug = async (slug) => ({
    id: `org_${slug}`,
    name: "Acme",
    slug,
    logo_url: null,
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:00.000Z",
  });
  orgAccessDeps.listUserOrganizations = async () => [];
  orgAccessDeps.forbidden = () => {
    throw new Error("FORBIDDEN_HIT");
  };

  await assert.rejects(
    () => requirePageOrgAccess("page-org-forbidden"),
    /FORBIDDEN_HIT/,
  );
});

test("writeAuditLog redacts metadata and stores request context", async () => {
  let insertedPayload: Record<string, unknown> | null = null;
  auditLogDeps.createSupabaseAdminClient = () =>
    createSupabaseMock({
      onQuery(state) {
        insertedPayload = state.payload as Record<string, unknown>;
        return {
          data: null,
          error: null,
        };
      },
    }) as never;

  const request = new Request("https://example.com/api/test", {
    headers: {
      "x-forwarded-for": "203.0.113.42, 10.0.0.1",
      "user-agent": "phase-one-test",
    },
  });

  await writeAuditLog({
    organizationId: "org_456",
    actorUserId: "user_456",
    action: "membership.role_changed",
    entityType: "membership",
    entityId: "membership_456",
    metadata: {
      authorization: "Bearer secret-token",
      safe: "visible",
    },
    request,
  });

  assert.ok(insertedPayload);
  const payload = insertedPayload as Record<string, unknown>;
  assert.equal(payload.organization_id, "org_456");
  assert.equal(payload.actor_user_id, "user_456");
  assert.equal(payload.ip_address, "203.0.113.42");
  assert.equal(payload.user_agent, "phase-one-test");
  assert.deepEqual(payload.metadata, {
    authorization: "[REDACTED]",
    safe: "visible",
  });
});
