import assert from "node:assert/strict";
import test from "node:test";
import {
  POST as postWebhookSecret,
  webhookSecretRouteDeps,
} from "@/app/api/orgs/[orgSlug]/workflows/[workflowId]/trigger/webhook-secret/route";
import {
  WorkflowTriggerConflictError,
  WorkflowTriggerNotFoundError,
} from "@/lib/server/triggers/service";
import {
  getRolePermissions,
  type OrganizationRole,
} from "@/lib/server/permissions";
import { restoreMutableExports, readJson } from "@/tests/helpers/test-utils";

const originalWebhookSecretRouteDeps = { ...webhookSecretRouteDeps };

test.afterEach(() => {
  restoreMutableExports(webhookSecretRouteDeps, originalWebhookSecretRouteDeps);
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
      userId: "user_secret",
      organization: {
        id: "org_secret",
        name: "Acme",
        slug: "acme",
        logo_url: null,
        created_at: "2026-03-23T00:00:00.000Z",
        updated_at: "2026-03-23T00:00:00.000Z",
      },
      membership: {
        membershipId: "membership_secret",
        organizationId: "org_secret",
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

test("POST webhook-secret rejects malformed non-empty JSON bodies", async () => {
  webhookSecretRouteDeps.auth = (async () => createSession("user_secret")) as never;
  webhookSecretRouteDeps.createRequestLogger = () => createLogger() as never;

  const response = await postWebhookSecret(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1/trigger/webhook-secret",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1" }) },
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Invalid webhook API key regeneration payload");
});

test("POST webhook-secret enforces editor permissions", async () => {
  webhookSecretRouteDeps.auth = (async () => createSession("user_secret")) as never;
  webhookSecretRouteDeps.createRequestLogger = () => createLogger() as never;
  webhookSecretRouteDeps.getApiOrgAccess = async () => createOrgAccess("viewer");

  const response = await postWebhookSecret(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1/trigger/webhook-secret",
      { method: "POST" },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1" }) },
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Forbidden");
});

test("POST webhook-secret maps not-found, conflict, and success responses", async () => {
  webhookSecretRouteDeps.auth = (async () => createSession("user_secret")) as never;
  webhookSecretRouteDeps.createRequestLogger = () => createLogger() as never;
  webhookSecretRouteDeps.getApiOrgAccess = async () => createOrgAccess("workflow_editor");
  webhookSecretRouteDeps.handleRouteError = createRouteErrorResponse as never;

  webhookSecretRouteDeps.regenerateWorkflowWebhookSecret = async () => {
    throw new WorkflowTriggerNotFoundError();
  };

  const notFoundResponse = await postWebhookSecret(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-404/trigger/webhook-secret",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "rotate" }),
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-404" }) },
  );
  assert.equal(notFoundResponse.status, 404);

  webhookSecretRouteDeps.regenerateWorkflowWebhookSecret = async () => {
    throw new WorkflowTriggerConflictError(
      "Publish a webhook workflow before rotating its API key.",
    );
  };

  const conflictResponse = await postWebhookSecret(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1/trigger/webhook-secret",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "rotate" }),
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1" }) },
  );
  assert.equal(conflictResponse.status, 409);

  webhookSecretRouteDeps.regenerateWorkflowWebhookSecret = async () =>
    ({
      bindingId: "binding_1",
      workflowId: "WFL-1",
      endpointPath: "/hooks/acme/orders",
      endpointUrl: "https://example.com/hooks/acme/orders",
      plainTextSecret: "nwhsec_new",
      lastFour: "1234",
    }) as never;

  const successResponse = await postWebhookSecret(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1/trigger/webhook-secret",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "rotate" }),
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1" }) },
  );
  const successPayload = await readJson<{
    secret: { plainTextSecret: string; lastFour: string };
  }>(successResponse);

  assert.equal(successResponse.status, 200);
  assert.equal(successPayload.secret.plainTextSecret, "nwhsec_new");
  assert.equal(successPayload.secret.lastFour, "1234");
});
