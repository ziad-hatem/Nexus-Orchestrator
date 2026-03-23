import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptOrganizationInvite,
  createOrganizationInvite,
  inviteServiceDeps,
} from "@/lib/server/invite-service";
import { createSupabaseMock } from "@/tests/helpers/fake-supabase";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalInviteServiceDeps = { ...inviteServiceDeps };

test.afterEach(() => {
  restoreMutableExports(inviteServiceDeps, originalInviteServiceDeps);
});

test("createOrganizationInvite revokes expired invites, sends email, and writes an audit log", async () => {
  const queries: string[] = [];
  let emailPayload:
    | {
        toEmail: string;
      }
    | null = null;
  let auditPayload:
    | {
        action: string;
      }
    | null = null;

  inviteServiceDeps.createSupabaseAdminClient = () =>
    createSupabaseMock({
      onQuery(state) {
        queries.push(`${state.table}.${state.action}`);

        if (state.table === "organizations") {
          return {
            data: {
              id: "org_123",
              name: "Acme",
              slug: "acme",
            },
            error: null,
          };
        }

        if (
          state.table === "organization_invites" &&
          state.action === "update"
        ) {
          return {
            data: null,
            error: null,
          };
        }

        if (
          state.table === "organization_invites" &&
          state.action === "select"
        ) {
          return {
            data: [],
            error: null,
          };
        }

        if (state.table === "users") {
          return {
            data: [],
            error: null,
          };
        }

        if (
          state.table === "organization_invites" &&
          state.action === "insert"
        ) {
          return {
            data: {
              id: "invite_123",
              organization_id: "org_123",
              email: "teammate@example.com",
              role: "operator",
              display_name: "Sam",
              token_hash: "hashed_token",
              expires_at: "2026-03-30T00:00:00.000Z",
              invited_by: "user_123",
              accepted_at: null,
              revoked_at: null,
              created_at: "2026-03-23T00:00:00.000Z",
            },
            error: null,
          };
        }

        throw new Error(`Unexpected query: ${state.table}.${state.action}`);
      },
    }) as never;
  inviteServiceDeps.sendOrganizationInviteEmail = async (params) => {
    emailPayload = params as { toEmail: string };
  };
  inviteServiceDeps.writeAuditLog = async (params) => {
    auditPayload = params as { action: string };
  };
  inviteServiceDeps.randomBytes = () => Buffer.from("0123456789abcdef0123456789abcdef");

  const invite = await createOrganizationInvite({
    organizationId: "org_123",
    actorUserId: "user_123",
    email: "  Teammate@Example.com ",
    name: "Sam",
    role: "operator",
  });

  assert.equal(invite.email, "teammate@example.com");
  assert.equal(invite.organizationSlug, "acme");
  assert.ok(
    queries.includes("organization_invites.update"),
    "expected expired invite cleanup to run before insert",
  );
  assert.ok(emailPayload);
  assert.ok(auditPayload);
  const sentEmail = emailPayload as { toEmail: string };
  const auditEntry = auditPayload as { action: string };
  assert.equal(sentEmail.toEmail, "teammate@example.com");
  assert.equal(auditEntry.action, "invite.sent");
});

test("createOrganizationInvite normalizes duplicate insert errors to a 409-safe message", async () => {
  inviteServiceDeps.createSupabaseAdminClient = () =>
    createSupabaseMock({
      onQuery(state) {
        if (state.table === "organizations") {
          return {
            data: {
              id: "org_123",
              name: "Acme",
              slug: "acme",
            },
            error: null,
          };
        }

        if (
          state.table === "organization_invites" &&
          state.action === "update"
        ) {
          return {
            data: null,
            error: null,
          };
        }

        if (
          state.table === "organization_invites" &&
          state.action === "select"
        ) {
          return {
            data: [],
            error: null,
          };
        }

        if (state.table === "users") {
          return {
            data: [],
            error: null,
          };
        }

        if (
          state.table === "organization_invites" &&
          state.action === "insert"
        ) {
          return {
            data: null,
            error: { message: "duplicate key value violates unique constraint" },
          };
        }

        throw new Error(`Unexpected query: ${state.table}.${state.action}`);
      },
    }) as never;

  await assert.rejects(
    () =>
      createOrganizationInvite({
        organizationId: "org_123",
        actorUserId: "user_123",
        email: "teammate@example.com",
        role: "viewer",
      }),
    /An active invitation already exists for this email/,
  );
});

test("acceptOrganizationInvite is idempotent and only writes invite.accepted once", async () => {
  let inviteAcceptedAt: string | null = null;
  let auditCount = 0;

  inviteServiceDeps.createSupabaseAdminClient = () =>
    createSupabaseMock({
      auth: {
        getUserById: async () => ({
          data: {
            user: {
              id: "user_accepted",
              email: "teammate@example.com",
            },
          },
          error: null,
        }),
      },
      onQuery(state) {
        if (
          state.table === "organization_invites" &&
          state.action === "select"
        ) {
          const inviteRecord = {
            id: "invite_accepted",
            organization_id: "org_accepted",
            email: "teammate@example.com",
            role: "workflow_editor",
            display_name: "Teammate",
            token_hash: "hashed_token",
            expires_at: "2026-03-30T00:00:00.000Z",
            invited_by: "user_admin",
            accepted_at: inviteAcceptedAt,
            revoked_at: null,
            created_at: "2026-03-23T00:00:00.000Z",
          };

          return {
            data: inviteRecord,
            error: null,
          };
        }

        if (state.table === "organizations") {
          return {
            data: {
              id: "org_accepted",
              name: "Acme",
              slug: "acme",
            },
            error: null,
          };
        }

        if (
          state.table === "organization_memberships" &&
          state.action === "select"
        ) {
          return {
            data: null,
            error: null,
          };
        }

        if (
          state.table === "organization_memberships" &&
          state.action === "insert"
        ) {
          return {
            data: {
              id: "membership_accepted",
              user_id: "user_accepted",
              organization_id: "org_accepted",
              role: "workflow_editor",
              status: "active",
              joined_at: "2026-03-23T00:00:00.000Z",
            },
            error: null,
          };
        }

        if (
          state.table === "organization_invites" &&
          state.action === "update"
        ) {
          if (inviteAcceptedAt) {
            return {
              data: null,
              error: null,
            };
          }

          inviteAcceptedAt = "2026-03-23T00:05:00.000Z";
          return {
            data: { id: "invite_accepted" },
            error: null,
          };
        }

        throw new Error(`Unexpected query: ${state.table}.${state.action}`);
      },
    }) as never;
  inviteServiceDeps.writeAuditLog = async () => {
    auditCount += 1;
  };

  const first = await acceptOrganizationInvite({
    token: "raw_token",
    userId: "user_accepted",
  });
  const second = await acceptOrganizationInvite({
    token: "raw_token",
    userId: "user_accepted",
  });

  assert.equal(first.organizationSlug, "acme");
  assert.equal(second.organizationSlug, "acme");
  assert.equal(auditCount, 1);
});
