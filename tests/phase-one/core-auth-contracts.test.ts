import assert from "node:assert/strict";
import test from "node:test";
import { mapLoginError } from "@/app/(auth)/login/login-flow";
import { createInviteSchema, createOrganizationSchema, updateMembershipSchema } from "@/lib/server/validation";
import {
  canCreateInvites,
  canEditWorkflows,
  canManageMembers,
  canViewAuditLogs,
  canViewExecutions,
  canViewOperations,
  canViewStreams,
  getRolePermissions,
  isOrganizationRole,
  ORGANIZATION_ROLES,
} from "@/lib/server/permissions";
import {
  isInviteCreatedAccount,
  loadMembershipAccessSummary,
} from "@/lib/server/membership-access";
import { createSupabaseMock } from "@/tests/helpers/fake-supabase";

test("organization roles stay aligned with the phase-one RBAC contract", () => {
  assert.deepEqual(ORGANIZATION_ROLES, [
    "org_admin",
    "workflow_editor",
    "operator",
    "viewer",
  ]);

  assert.equal(isOrganizationRole("org_admin"), true);
  assert.equal(isOrganizationRole("admin"), false);

  assert.equal(canManageMembers("org_admin"), true);
  assert.equal(canCreateInvites("org_admin"), true);
  assert.equal(canViewAuditLogs("org_admin"), true);

  assert.equal(canManageMembers("workflow_editor"), false);
  assert.equal(canEditWorkflows("workflow_editor"), true);
  assert.equal(canViewAuditLogs("workflow_editor"), false);

  assert.equal(canViewExecutions("operator"), true);
  assert.equal(canViewOperations("operator"), true);
  assert.equal(canViewStreams("operator"), true);
  assert.equal(canViewAuditLogs("operator"), true);
  assert.equal(canEditWorkflows("operator"), false);

  assert.equal(canViewExecutions("viewer"), true);
  assert.equal(canViewOperations("viewer"), false);
  assert.equal(canViewStreams("viewer"), false);
  assert.equal(canCreateInvites("viewer"), false);

  for (const role of ORGANIZATION_ROLES) {
    assert.equal(getRolePermissions(role).role, role);
  }
});

test("phase-one validation schemas normalize and reject invalid input", () => {
  const organization = createOrganizationSchema.parse({
    name: "  Acme Operations  ",
  });
  assert.equal(organization.name, "Acme Operations");

  const invite = createInviteSchema.parse({
    email: "Teammate@Example.com",
    name: "  Sam  ",
    role: "operator",
  });
  assert.equal(invite.email, "teammate@example.com");
  assert.equal(invite.name, "Sam");

  const blankNameInvite = createInviteSchema.parse({
    email: "user@example.com",
    name: "   ",
    role: "viewer",
  });
  assert.equal(blankNameInvite.name, undefined);

  const membershipUpdate = updateMembershipSchema.parse({
    status: "suspended",
  });
  assert.equal(membershipUpdate.status, "suspended");

  assert.equal(
    updateMembershipSchema.safeParse({}).success,
    false,
  );
  assert.equal(
    createOrganizationSchema.safeParse({ name: "a" }).success,
    false,
  );
});

test("loadMembershipAccessSummary counts active, suspended, and legacy memberships", async () => {
  const activeAndSuspendedClient = createSupabaseMock({
    onQuery(state) {
      assert.equal(state.table, "organization_memberships");
      return {
        data: [
          { status: "active" },
          { status: "suspended" },
          { status: "active" },
        ],
        error: null,
      };
    },
  });

  const result = await loadMembershipAccessSummary(
    activeAndSuspendedClient as never,
    "user_123",
  );

  assert.equal(result.error, null);
  assert.deepEqual(result.summary, {
    totalMemberships: 3,
    activeMemberships: 2,
    suspendedMemberships: 1,
    hasOnlySuspendedMemberships: false,
  });

  const legacyClient = createSupabaseMock({
    onQuery(state) {
      if (state.selectClause === "status") {
        return {
          data: null,
          error: {
            message: 'column organization_memberships.status does not exist',
          },
        };
      }

      return {
        data: [{ id: "membership_1" }, { id: "membership_2" }],
        error: null,
      };
    },
  });

  const legacyResult = await loadMembershipAccessSummary(
    legacyClient as never,
    "user_legacy",
  );

  assert.equal(legacyResult.error, null);
  assert.deepEqual(legacyResult.summary, {
    totalMemberships: 2,
    activeMemberships: 2,
    suspendedMemberships: 0,
    hasOnlySuspendedMemberships: false,
  });
});

test("invite-created account metadata and login error mapping stay stable", () => {
  assert.equal(isInviteCreatedAccount({ created_from_invite: true }), true);
  assert.equal(isInviteCreatedAccount({ created_from_invite: false }), false);
  assert.equal(isInviteCreatedAccount(null), false);

  assert.equal(
    mapLoginError("CredentialsSignin", "access_check_failed"),
    "We could not verify your organization access right now. Please try again.",
  );
  assert.equal(
    mapLoginError("CredentialsSignin", "account_suspended"),
    "Your account is suspended. Contact your organization admin.",
  );
});
