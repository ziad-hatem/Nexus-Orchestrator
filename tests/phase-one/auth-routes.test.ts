import assert from "node:assert/strict";
import test from "node:test";
import { POST as postRegister, registerRouteDeps } from "@/app/api/auth/register/route";
import {
  POST as postMagicLink,
  magicLinkRouteDeps,
} from "@/app/api/auth/passwordless/magic-link/route";
import {
  POST as postOauthAccountCheck,
  oauthAccountCheckRouteDeps,
} from "@/app/api/auth/oauth/account-check/route";
import { createSupabaseMock } from "@/tests/helpers/fake-supabase";
import { restoreMutableExports, readJson } from "@/tests/helpers/test-utils";

const originalRegisterRouteDeps = { ...registerRouteDeps };
const originalMagicLinkRouteDeps = { ...magicLinkRouteDeps };
const originalOauthAccountCheckRouteDeps = { ...oauthAccountCheckRouteDeps };

test.afterEach(() => {
  restoreMutableExports(registerRouteDeps, originalRegisterRouteDeps);
  restoreMutableExports(magicLinkRouteDeps, originalMagicLinkRouteDeps);
  restoreMutableExports(
    oauthAccountCheckRouteDeps,
    originalOauthAccountCheckRouteDeps,
  );
});

function createLogger() {
  return {
    info() {},
    warn() {},
    error() {},
  };
}

test("POST /api/auth/register validates required fields and creates a verification link", async () => {
  registerRouteDeps.createRequestLogger = () => createLogger() as never;

  const invalidResponse = await postRegister(
    new Request("https://example.com/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "missing-fields@example.com" }),
    }),
  );
  assert.equal(invalidResponse.status, 400);

  let generatedRedirectTo = "";
  registerRouteDeps.getRequiredEnv = (name: string) => {
    if (name === "NEXTAUTH_URL") {
      return "https://nexus.example.com";
    }

    return "ignored";
  };
  registerRouteDeps.getSupabaseUrl = () => "https://supabase.example.com";
  registerRouteDeps.getSupabaseServiceRoleKey = () => "service-role-key";
  registerRouteDeps.createClient = () =>
    ({
      auth: {
        admin: {
          generateLink: async (params: {
            options: { redirectTo: string };
          }) => {
            generatedRedirectTo = params.options.redirectTo;
            return {
              data: {
                user: { id: "user_registered" },
                properties: {
                  action_link: "https://nexus.example.com/verify/token",
                },
              },
              error: null,
            };
          },
        },
      },
    }) as never;
  registerRouteDeps.sendVerificationEmail = async () => ({
    error: null,
  });

  const response = await postRegister(
    new Request("https://example.com/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "super-secret",
        firstName: "Ada",
        lastName: "Lovelace",
        next: "https://evil.example.com/phish",
      }),
    }),
  );
  const payload = await readJson<{ user: { id: string } }>(response);

  assert.equal(response.status, 201);
  assert.equal(payload.user.id, "user_registered");
  assert.equal(generatedRedirectTo, "https://nexus.example.com/login?verified=true");
});

test("POST /api/auth/passwordless/magic-link validates email and uses a safe redirect target", async () => {
  magicLinkRouteDeps.auth = (async () => null) as never;
  magicLinkRouteDeps.createRequestLogger = () => createLogger() as never;

  const invalidResponse = await postMagicLink(
    new Request("https://example.com/api/auth/passwordless/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    }),
  );
  assert.equal(invalidResponse.status, 400);

  let generatedRedirectTo = "";
  let emailedMagicLink = "";
  magicLinkRouteDeps.createSupabaseAdminClient = () =>
    createSupabaseMock({
      auth: {
        listUsers: async () => ({
          data: {
            users: [{ email: "user@example.com" }],
            lastPage: 1,
          },
          error: null,
        }),
        generateLink: async (params: unknown) => {
          generatedRedirectTo = (
            params as { options: { redirectTo: string } }
          ).options.redirectTo;
          return {
            data: {
              properties: {
                action_link: "https://nexus.example.com/auth/magic-link?token=123",
              },
            },
            error: null,
          };
        },
      },
      onQuery() {
        throw new Error("Magic-link route should not hit table queries");
      },
    }) as never;
  magicLinkRouteDeps.sendMagicLinkEmail = async (params) => {
    emailedMagicLink = params.magicLink;
  };

  const response = await postMagicLink(
    new Request("https://example.com/api/auth/passwordless/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        next: "https://evil.example.com/steal",
      }),
    }),
  );
  const payload = await readJson<{ message: string }>(response);

  assert.equal(response.status, 200);
  assert.equal(
    generatedRedirectTo,
    "http://localhost:3000/auth/magic-link",
  );
  assert.equal(
    emailedMagicLink,
    "https://nexus.example.com/auth/magic-link?token=123",
  );
  assert.match(payload.message, /sign-in link/i);
});

test("POST /api/auth/oauth/account-check returns account existence based on metadata, profile, and memberships", async () => {
  oauthAccountCheckRouteDeps.createSupabaseAdminClient = () =>
    createSupabaseMock({
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: "user_oauth",
              user_metadata: {
                registered_via_nexusorchestrator: true,
              },
            },
          },
          error: null,
        }),
      },
      onQuery(state) {
        if (state.table === "users") {
          return {
            data: null,
            error: null,
          };
        }

        if (state.table === "organization_memberships") {
          return {
            data: [],
            error: null,
          };
        }

        throw new Error(`Unexpected query: ${state.table}.${state.action}`);
      },
    }) as never;

  const successResponse = await postOauthAccountCheck(
    new Request("https://example.com/api/auth/oauth/account-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "access-token" }),
    }),
  );
  const successPayload = await readJson<{ exists: boolean }>(successResponse);

  assert.equal(successResponse.status, 200);
  assert.equal(successPayload.exists, true);

  const invalidResponse = await postOauthAccountCheck(
    new Request("https://example.com/api/auth/oauth/account-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "" }),
    }),
  );
  assert.equal(invalidResponse.status, 400);
});
