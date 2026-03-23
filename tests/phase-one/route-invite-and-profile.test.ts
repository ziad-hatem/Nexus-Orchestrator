import assert from "node:assert/strict";
import test from "node:test";
import {
  GET as getInvitePreview,
  invitePreviewRouteDeps,
} from "@/app/api/invites/[token]/route";
import {
  POST as postInviteAccept,
  inviteAcceptRouteDeps,
} from "@/app/api/invites/[token]/accept/route";
import {
  GET as getProfile,
  PATCH as patchProfile,
  meProfileRouteDeps,
} from "@/app/api/me/profile/route";
import { createSupabaseMock } from "@/tests/helpers/fake-supabase";
import { restoreMutableExports, readJson } from "@/tests/helpers/test-utils";

const originalInvitePreviewRouteDeps = { ...invitePreviewRouteDeps };
const originalInviteAcceptRouteDeps = { ...inviteAcceptRouteDeps };
const originalMeProfileRouteDeps = { ...meProfileRouteDeps };

test.afterEach(() => {
  restoreMutableExports(invitePreviewRouteDeps, originalInvitePreviewRouteDeps);
  restoreMutableExports(inviteAcceptRouteDeps, originalInviteAcceptRouteDeps);
  restoreMutableExports(meProfileRouteDeps, originalMeProfileRouteDeps);
});

function createLogger() {
  return {
    info() {},
    warn() {},
    error() {},
  };
}

function createSession(userId: string, overrides: Partial<{
  email: string;
  image: string | null;
  name: string | null;
}> = {}) {
  return {
    user: {
      id: userId,
      email: overrides.email ?? null,
      image: overrides.image ?? null,
      name: overrides.name ?? null,
    },
    expires: "2099-01-01T00:00:00.000Z",
  };
}

test("GET /api/invites/[token] returns 404 for missing invites and 200 for valid previews", async () => {
  invitePreviewRouteDeps.createRequestLogger = () => createLogger() as never;
  invitePreviewRouteDeps.previewInviteByToken = async () => null;

  const missingResponse = await getInvitePreview(
    new Request("https://example.com/api/invites/missing"),
    { params: Promise.resolve({ token: "missing" }) },
  );
  assert.equal(missingResponse.status, 404);

  invitePreviewRouteDeps.previewInviteByToken = async () => ({
    id: "invite_123",
    organizationId: "org_123",
    organizationName: "Acme",
    organizationSlug: "acme",
    email: "teammate@example.com",
    role: "viewer",
    displayName: "Teammate",
    expiresAt: "2026-03-30T00:00:00.000Z",
    acceptedAt: null,
    revokedAt: null,
    isExpired: false,
  });

  const successResponse = await getInvitePreview(
    new Request("https://example.com/api/invites/valid"),
    { params: Promise.resolve({ token: "valid" }) },
  );
  const successPayload = await readJson<{ invite: { organizationSlug: string } }>(
    successResponse,
  );

  assert.equal(successResponse.status, 200);
  assert.equal(successPayload.invite.organizationSlug, "acme");
});

test("POST /api/invites/[token]/accept enforces auth and sets the org cookie on success", async () => {
  inviteAcceptRouteDeps.auth = (async () => null) as never;
  inviteAcceptRouteDeps.createRequestLogger = () => createLogger() as never;

  const unauthorizedResponse = await postInviteAccept(
    new Request("https://example.com/api/invites/token/accept", {
      method: "POST",
    }),
    { params: Promise.resolve({ token: "token" }) },
  );
  assert.equal(unauthorizedResponse.status, 401);

  inviteAcceptRouteDeps.auth = (async () => createSession("user_accept")) as never;
  inviteAcceptRouteDeps.acceptOrganizationInvite = async () => ({
    organizationName: "Acme",
    organizationSlug: "acme",
  });

  const successResponse = await postInviteAccept(
    new Request("https://example.com/api/invites/token/accept", {
      method: "POST",
    }),
    { params: Promise.resolve({ token: "token" }) },
  );
  const successPayload = await readJson<{ redirectPath: string }>(successResponse);

  assert.equal(successResponse.status, 200);
  assert.equal(successPayload.redirectPath, "/org/acme");
  assert.match(successResponse.headers.get("set-cookie") ?? "", /active_org=acme/);
});

test("GET /api/me/profile enforces auth and returns the user profile", async () => {
  meProfileRouteDeps.auth = (async () => null) as never;
  meProfileRouteDeps.createRequestLogger = () => createLogger() as never;

  const unauthorizedResponse = await getProfile(
    new Request("https://example.com/api/me/profile"),
  );
  assert.equal(unauthorizedResponse.status, 401);

  meProfileRouteDeps.auth = (async () =>
    createSession("user_profile", {
      email: "profile@example.com",
      name: "Profile User",
      image: null,
    })) as never;
  meProfileRouteDeps.createSupabaseAdminClient = () =>
    createSupabaseMock({
      auth: {
        getUserById: async () => ({
          data: {
            user: {
              user_metadata: {
                phone: "555-0100",
                multi_step_auth_enabled: true,
              },
            },
          },
          error: null,
        }),
      },
      onQuery(state) {
        if (state.table === "users" && state.action === "select") {
          return {
            data: {
              id: "user_profile",
              name: "Profile User",
              email: "profile@example.com",
              avatar_url: null,
            },
            error: null,
          };
        }

        throw new Error(`Unexpected query: ${state.table}.${state.action}`);
      },
    }) as never;

  const response = await getProfile(
    new Request("https://example.com/api/me/profile"),
  );
  const payload = await readJson<{
    user: { email: string };
    profile: { phone: string | null; multiStepAuthEnabled: boolean };
  }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.user.email, "profile@example.com");
  assert.equal(payload.profile.phone, "555-0100");
  assert.equal(payload.profile.multiStepAuthEnabled, true);
});

test("PATCH /api/me/profile validates input and persists profile updates", async () => {
  meProfileRouteDeps.auth = (async () =>
    createSession("user_profile_patch", {
      email: "profile@example.com",
      name: "Profile User",
      image: null,
    })) as never;
  meProfileRouteDeps.createRequestLogger = () => createLogger() as never;

  const noFieldsResponse = await patchProfile(
    new Request("https://example.com/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
  assert.equal(noFieldsResponse.status, 400);

  const authUpdatePayloads: Array<Record<string, unknown>> = [];
  let userSelectCount = 0;
  let userUpdatePayload:
    | {
        name?: string | null;
      }
    | null = null;

  meProfileRouteDeps.createSupabaseAdminClient = () =>
    createSupabaseMock({
      auth: {
        getUserById: async () => ({
          data: {
            user: {
              user_metadata: {
                name: "Profile User",
                multi_step_auth_enabled: false,
              },
            },
          },
          error: null,
        }),
        updateUserById: async (_userId, payload) => {
          authUpdatePayloads.push(payload as Record<string, unknown>);
          return {
            data: null,
            error: null,
          };
        },
      },
      onQuery(state) {
        if (state.table === "users" && state.action === "select") {
          userSelectCount += 1;
          if (userSelectCount === 1) {
            return {
              data: {
                id: "user_profile_patch",
                name: "Profile User",
                email: "profile@example.com",
                avatar_url: null,
              },
              error: null,
            };
          }

          return {
            data: {
              id: "user_profile_patch",
              name: "Updated User",
              email: "profile@example.com",
              avatar_url: null,
            },
            error: null,
          };
        }

        if (state.table === "users" && state.action === "update") {
          userUpdatePayload = state.payload as { name?: string | null };
          return {
            data: null,
            error: null,
          };
        }

        throw new Error(`Unexpected query: ${state.table}.${state.action}`);
      },
    }) as never;

  const response = await patchProfile(
    new Request("https://example.com/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated User",
        multiStepAuthEnabled: true,
      }),
    }),
  );
  const payload = await readJson<{
    user: { name: string };
    profile: { multiStepAuthEnabled: boolean };
  }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.user.name, "Updated User");
  assert.equal(payload.profile.multiStepAuthEnabled, true);
  assert.equal(authUpdatePayloads.length, 1);
  assert.ok(userUpdatePayload);
  const updatedUserPayload = userUpdatePayload as { name?: string | null };
  assert.equal(updatedUserPayload.name, "Updated User");
});
