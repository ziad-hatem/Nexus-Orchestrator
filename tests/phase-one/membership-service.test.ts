import assert from "node:assert/strict";
import test from "node:test";
import {
  membershipServiceDeps,
  updateOrganizationMembership,
} from "@/lib/server/membership-service";
import { createSupabaseMock } from "@/tests/helpers/fake-supabase";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalMembershipServiceDeps = { ...membershipServiceDeps };

test.afterEach(() => {
  restoreMutableExports(
    membershipServiceDeps,
    originalMembershipServiceDeps,
  );
});

test("updateOrganizationMembership restores admin access if a concurrent update would leave zero active admins", async () => {
  const updatePayloads: Array<Record<string, unknown>> = [];
  let countCall = 0;

  membershipServiceDeps.createSupabaseAdminClient = () =>
    createSupabaseMock({
      onQuery(state) {
        if (
          state.table === "organization_memberships" &&
          state.action === "select"
        ) {
          if (state.selectOptions?.count === "exact") {
            countCall += 1;
            return {
              count: countCall === 1 ? 2 : 0,
              data: null,
              error: null,
            };
          }

          return {
            data: {
              id: "membership_admin",
              user_id: "user_admin",
              organization_id: "org_admin",
              role: "org_admin",
              status: "active",
              joined_at: null,
              created_at: "2026-03-23T00:00:00.000Z",
              updated_at: "2026-03-23T00:00:00.000Z",
            },
            error: null,
          };
        }

        if (
          state.table === "organization_memberships" &&
          state.action === "update"
        ) {
          updatePayloads.push(state.payload as Record<string, unknown>);
          return {
            data: null,
            error: null,
          };
        }

        throw new Error(`Unexpected query: ${state.table}.${state.action}`);
      },
    }) as never;
  membershipServiceDeps.writeAuditLog = async () => {
    throw new Error("audit log should not be written on rollback");
  };

  await assert.rejects(
    () =>
      updateOrganizationMembership({
        organizationId: "org_admin",
        membershipId: "membership_admin",
        actorUserId: "actor_admin",
        status: "suspended",
      }),
    /at least one active org admin/i,
  );

  assert.equal(updatePayloads.length, 2);
  assert.equal(updatePayloads[0]?.status, "suspended");
  assert.equal(updatePayloads[1]?.role, "org_admin");
  assert.equal(updatePayloads[1]?.status, "active");
});

test("updateOrganizationMembership returns the updated member and writes audit entries for role and status changes", async () => {
  const auditActions: string[] = [];
  let countCall = 0;

  membershipServiceDeps.createSupabaseAdminClient = () =>
    createSupabaseMock({
      onQuery(state) {
        if (
          state.table === "organization_memberships" &&
          state.action === "select"
        ) {
          if (state.selectOptions?.count === "exact") {
            countCall += 1;
            return {
              count: countCall === 1 ? 2 : 1,
              data: null,
              error: null,
            };
          }

          return {
            data: {
              id: "membership_admin",
              user_id: "user_admin",
              organization_id: "org_admin",
              role: "org_admin",
              status: "active",
              joined_at: null,
              created_at: "2026-03-23T00:00:00.000Z",
              updated_at: "2026-03-23T00:00:00.000Z",
            },
            error: null,
          };
        }

        if (
          state.table === "organization_memberships" &&
          state.action === "update"
        ) {
          return {
            data: null,
            error: null,
          };
        }

        if (state.table === "users" && state.action === "select") {
          return {
            data: {
              id: "user_admin",
              name: "Admin User",
              email: "admin@example.com",
              avatar_url: null,
            },
            error: null,
          };
        }

        throw new Error(`Unexpected query: ${state.table}.${state.action}`);
      },
    }) as never;
  membershipServiceDeps.writeAuditLog = async (params) => {
    auditActions.push(params.action);
  };

  const member = await updateOrganizationMembership({
    organizationId: "org_admin",
    membershipId: "membership_admin",
    actorUserId: "actor_admin",
    role: "operator",
    status: "suspended",
  });

  assert.equal(member.role, "operator");
  assert.equal(member.status, "suspended");
  assert.deepEqual(auditActions, [
    "membership.role_changed",
    "membership.suspended",
  ]);
});
