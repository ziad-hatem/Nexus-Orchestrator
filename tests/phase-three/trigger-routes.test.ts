import assert from "node:assert/strict";
import test from "node:test";
import {
  POST as postManualTrigger,
  manualTriggerRouteDeps,
} from "@/app/api/orgs/[orgSlug]/workflows/[workflowId]/trigger/manual/route";
import {
  POST as postWebhook,
  webhookRouteDeps,
} from "@/app/hooks/[...path]/route";
import {
  POST as postInternalEvent,
  internalEventsRouteDeps,
} from "@/app/api/internal/events/route";
import {
  getRolePermissions,
  type OrganizationRole,
} from "@/lib/server/permissions";
import {
  WorkflowTriggerConflictError,
  WorkflowTriggerDuplicateError,
  WorkflowTriggerNotFoundError,
  WorkflowTriggerRateLimitError,
} from "@/lib/server/triggers/service";
import { restoreMutableExports, readJson } from "@/tests/helpers/test-utils";

const originalManualTriggerRouteDeps = { ...manualTriggerRouteDeps };
const originalWebhookRouteDeps = { ...webhookRouteDeps };
const originalInternalEventsRouteDeps = { ...internalEventsRouteDeps };

test.afterEach(() => {
  restoreMutableExports(manualTriggerRouteDeps, originalManualTriggerRouteDeps);
  restoreMutableExports(webhookRouteDeps, originalWebhookRouteDeps);
  restoreMutableExports(
    internalEventsRouteDeps,
    originalInternalEventsRouteDeps,
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

test("manual trigger route rejects malformed JSON before authz checks", async () => {
  manualTriggerRouteDeps.auth = (async () => createSession("user_route")) as never;
  manualTriggerRouteDeps.createRequestLogger = () => createLogger() as never;

  const response = await postManualTrigger(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1234/trigger/manual",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1234" }) },
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Invalid request body");
});

test("manual trigger route allows empty bodies and forwards request metadata", async () => {
  let receivedRequestIp: string | null = null;
  let receivedRequestUserAgent: string | null = null;
  let receivedPayload: unknown = "unset";

  manualTriggerRouteDeps.auth = (async () => createSession("user_route")) as never;
  manualTriggerRouteDeps.createRequestLogger = () => createLogger() as never;
  manualTriggerRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("workflow_editor");
  manualTriggerRouteDeps.executeManualTrigger = async (params) => {
    receivedRequestIp = params.requestIp ?? null;
    receivedRequestUserAgent = params.requestUserAgent ?? null;
    receivedPayload = params.payload;
    return {
      event: { id: "event_1" },
      run: { runId: "run_public_1" },
    } as never;
  };

  const response = await postManualTrigger(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1234/trigger/manual",
      {
        method: "POST",
        headers: {
          "x-forwarded-for": "198.51.100.10, 10.0.0.1",
          "user-agent": "qa-suite",
        },
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1234" }) },
  );
  const payload = await readJson<{ run: { runId: string } }>(response);

  assert.equal(response.status, 201);
  assert.equal(payload.run.runId, "run_public_1");
  assert.equal(receivedRequestIp, "198.51.100.10");
  assert.equal(receivedRequestUserAgent, "qa-suite");
  assert.equal(receivedPayload, undefined);
});

test("manual trigger route maps authz and trigger errors to stable HTTP statuses", async () => {
  manualTriggerRouteDeps.auth = (async () => createSession("user_route")) as never;
  manualTriggerRouteDeps.createRequestLogger = () => createLogger() as never;
  manualTriggerRouteDeps.handleRouteError = createRouteErrorResponse as never;

  manualTriggerRouteDeps.getApiOrgAccess = async () => createOrgAccess("viewer");
  const forbiddenResponse = await postManualTrigger(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1234/trigger/manual",
      {
        method: "POST",
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1234" }) },
  );
  assert.equal(forbiddenResponse.status, 403);

  const cases = [
    [new WorkflowTriggerNotFoundError("missing"), 404],
    [new WorkflowTriggerConflictError("conflict"), 409],
    [new WorkflowTriggerRateLimitError("slow down"), 429],
    [new WorkflowTriggerDuplicateError("duplicate"), 202],
  ] as const;

  for (const [error, status] of cases) {
    manualTriggerRouteDeps.getApiOrgAccess = async () =>
      createOrgAccess("workflow_editor");
    manualTriggerRouteDeps.executeManualTrigger = async () => {
      throw error;
    };

    const response = await postManualTrigger(
      new Request(
        "https://example.com/api/orgs/acme/workflows/WFL-1234/trigger/manual",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: { ok: true } }),
        },
      ),
      { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1234" }) },
    );

    assert.equal(response.status, status);
  }
});

test("webhook route enforces size limits and malformed JSON contracts", async () => {
  webhookRouteDeps.createRequestLogger = () => createLogger() as never;
  webhookRouteDeps.getWebhookMaxBodyBytes = () => 4;

  const oversizedResponse = await postWebhook(
    new Request("https://example.com/hooks/acme/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "content-length": "10",
      },
      body: JSON.stringify({ ok: true }),
    }),
    { params: Promise.resolve({ path: ["acme", "orders"] }) },
  );
  assert.equal(oversizedResponse.status, 413);

  const malformedResponse = await postWebhook(
    new Request("https://example.com/hooks/acme/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
    { params: Promise.resolve({ path: ["acme", "orders"] }) },
  );
  assert.equal(malformedResponse.status, 400);
});

test("webhook route wraps plain-text payloads and maps ingestion results", async () => {
  let receivedPayload: unknown = null;
  let receivedDeliveryId: string | null = null;

  webhookRouteDeps.createRequestLogger = () => createLogger() as never;
  webhookRouteDeps.getWebhookMaxBodyBytes = () => 1024;
  webhookRouteDeps.ingestWebhookDelivery = async (params) => {
    receivedPayload = params.payload;
    receivedDeliveryId = params.deliveryId ?? null;
    return {
      kind: "accepted",
      event: { id: "event_1" },
      run: { runId: "run_public_1" },
    } as never;
  };

  const acceptedResponse = await postWebhook(
    new Request("https://example.com/hooks/acme/orders", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "x-nexus-delivery-id": "delivery_1",
      },
      body: "plain text body",
    }),
    { params: Promise.resolve({ path: ["acme", "orders"] }) },
  );
  const acceptedPayload = await readJson<{ runId: string }>(acceptedResponse);

  assert.equal(acceptedResponse.status, 202);
  assert.equal(acceptedPayload.runId, "run_public_1");
  assert.deepEqual(receivedPayload, { rawBody: "plain text body" });
  assert.equal(receivedDeliveryId, "delivery_1");

  const resultCases = [
    ["not_found", 404],
    ["rejected", 401],
    ["rate_limited", 429],
    ["duplicate", 202],
  ] as const;

  for (const [kind, status] of resultCases) {
    webhookRouteDeps.ingestWebhookDelivery = async () => ({ kind }) as never;

    const response = await postWebhook(
      new Request("https://example.com/hooks/acme/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true }),
      }),
      { params: Promise.resolve({ path: ["acme", "orders"] }) },
    );

    assert.equal(response.status, status);
  }
});

test("internal events route enforces bearer auth and validates payloads", async () => {
  internalEventsRouteDeps.createRequestLogger = () => createLogger() as never;
  internalEventsRouteDeps.getRequiredEnv = () => "secret-token";

  const unauthorizedResponse = await postInternalEvent(
    new Request("https://example.com/api/internal/events", {
      method: "POST",
    }),
  );
  assert.equal(unauthorizedResponse.status, 401);

  const invalidBodyResponse = await postInternalEvent(
    new Request("https://example.com/api/internal/events", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
      },
      body: "{",
    }),
  );
  assert.equal(invalidBodyResponse.status, 400);

  const invalidPayloadResponse = await postInternalEvent(
    new Request("https://example.com/api/internal/events", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ eventKey: "ticket.created" }),
    }),
  );
  assert.equal(invalidPayloadResponse.status, 400);
});

test("internal events route accepts valid events and maps duplicate and rate-limit errors", async () => {
  internalEventsRouteDeps.createRequestLogger = () => createLogger() as never;
  internalEventsRouteDeps.handleRouteError = createRouteErrorResponse as never;
  internalEventsRouteDeps.getRequiredEnv = () => "secret-token";
  internalEventsRouteDeps.ingestInternalEvent = async () =>
    ({
      status: "accepted",
      matchedWorkflows: 1,
      runs: [{ runId: "run_public_1" }],
    }) as never;

  const acceptedResponse = await postInternalEvent(
    new Request("https://example.com/api/internal/events", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventId: "evt_1",
        eventKey: "ticket.created",
        source: "tickets",
        payload: { ticketId: "T-1" },
      }),
    }),
  );
  const acceptedPayload = await readJson<{ matchedWorkflows: number }>(
    acceptedResponse,
  );

  assert.equal(acceptedResponse.status, 202);
  assert.equal(acceptedPayload.matchedWorkflows, 1);

  const errorCases = [
    [new WorkflowTriggerRateLimitError("slow down"), 429],
    [new WorkflowTriggerDuplicateError("duplicate"), 202],
  ] as const;

  for (const [error, status] of errorCases) {
    internalEventsRouteDeps.ingestInternalEvent = async () => {
      throw error;
    };

    const response = await postInternalEvent(
      new Request("https://example.com/api/internal/events", {
        method: "POST",
        headers: {
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: "evt_1",
          eventKey: "payment.failed",
          source: "billing",
          payload: {},
        }),
      }),
    );

    assert.equal(response.status, status);
  }
});
