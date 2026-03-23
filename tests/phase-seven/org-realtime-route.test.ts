import assert from "node:assert/strict";
import test from "node:test";
import {
  GET,
  orgRealtimeRouteDeps,
} from "@/app/api/orgs/[orgSlug]/realtime/route";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalOrgRealtimeRouteDeps = { ...orgRealtimeRouteDeps };

test.afterEach(() => {
  restoreMutableExports(orgRealtimeRouteDeps, originalOrgRealtimeRouteDeps);
});

function createAuthStub(userId = "user_1"): typeof orgRealtimeRouteDeps.auth {
  return ((async () => ({ user: { id: userId } } as never)) as unknown) as typeof orgRealtimeRouteDeps.auth;
}

test("GET /api/orgs/[orgSlug]/realtime validates the requested channel", async () => {
  orgRealtimeRouteDeps.auth = createAuthStub();

  const response = await GET(
    new Request("https://example.com/api/orgs/acme/realtime?channel=invalid"),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid realtime channel",
  });
});

test("GET /api/orgs/[orgSlug]/realtime enforces channel-specific permissions", async () => {
  orgRealtimeRouteDeps.auth = createAuthStub();
  orgRealtimeRouteDeps.getApiOrgAccess = async () =>
    ({
      ok: true,
      context: {
        organization: {
          id: "org_1",
          slug: "acme",
        },
        membership: {
          role: "workflow_editor",
        },
      },
    }) as never;

  const response = await GET(
    new Request("https://example.com/api/orgs/acme/realtime?channel=audit"),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "Forbidden",
  });
});

test("GET /api/orgs/[orgSlug]/realtime opens an SSE stream for permitted channels", async () => {
  orgRealtimeRouteDeps.auth = createAuthStub();
  orgRealtimeRouteDeps.createRequestLogger = () => ({}) as never;
  orgRealtimeRouteDeps.getApiOrgAccess = async () =>
    ({
      ok: true,
      context: {
        organization: {
          id: "org_1",
          slug: "acme",
        },
        membership: {
          role: "operator",
        },
      },
    }) as never;
  orgRealtimeRouteDeps.getOrganizationRealtimeVersion = async () => "version_1";

  const response = await GET(
    new Request("https://example.com/api/orgs/acme/realtime?channel=executions"),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-type"),
    "text/event-stream; charset=utf-8",
  );
  assert.ok(response.body);
  await response.body.cancel();
});
