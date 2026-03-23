import assert from "node:assert/strict";
import test from "node:test";
import {
  auditLogDeps,
  summarizeAuditLogs,
  writeAuditLog,
} from "@/lib/server/audit-log";
import { createSupabaseMock } from "@/tests/helpers/fake-supabase";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalAuditLogDeps = { ...auditLogDeps };

test.afterEach(() => {
  restoreMutableExports(auditLogDeps, originalAuditLogDeps);
});

test("summarizeAuditLogs tracks phase-eight privileged workflow actions", () => {
  const logs = [
    {
      id: "1",
      organization_id: "org_1",
      actor_user_id: "user_1",
      action: "workflow.webhook_secret_regenerated",
      entity_type: "workflow",
      entity_id: "WFL-1",
      metadata: {},
      ip_address: null,
      user_agent: null,
      created_at: "2026-03-23T00:00:00.000Z",
    },
    {
      id: "2",
      organization_id: "org_1",
      actor_user_id: "user_2",
      action: "workflow.webhook_auth_rejected",
      entity_type: "workflow",
      entity_id: "WFL-1",
      metadata: {},
      ip_address: null,
      user_agent: null,
      created_at: "2026-03-23T00:00:00.000Z",
    },
    {
      id: "3",
      organization_id: "org_1",
      actor_user_id: "user_2",
      action: "workflow.run_cancel_requested",
      entity_type: "workflow_run",
      entity_id: "RUN-1",
      metadata: {},
      ip_address: null,
      user_agent: null,
      created_at: "2026-03-23T00:00:00.000Z",
    },
    {
      id: "4",
      organization_id: "org_1",
      actor_user_id: null,
      action: "workflow.run_retried",
      entity_type: "workflow_run",
      entity_id: "RUN-1",
      metadata: {},
      ip_address: null,
      user_agent: null,
      created_at: "2026-03-23T00:00:00.000Z",
    },
    {
      id: "5",
      organization_id: "org_1",
      actor_user_id: null,
      action: "system.retention_pruned",
      entity_type: "system",
      entity_id: "retention",
      metadata: {},
      ip_address: null,
      user_agent: null,
      created_at: "2026-03-23T00:00:00.000Z",
    },
  ];

  const summary = summarizeAuditLogs(logs);

  assert.equal(
    summary.coverage.observedActions.includes("workflow.webhook_secret_regenerated"),
    true,
  );
  assert.equal(
    summary.coverage.observedActions.includes("workflow.webhook_auth_rejected"),
    true,
  );
  assert.equal(
    summary.coverage.observedActions.includes("workflow.run_cancel_requested"),
    true,
  );
  assert.equal(
    summary.coverage.observedActions.includes("workflow.run_retried"),
    true,
  );
  assert.equal(
    summary.coverage.observedActions.includes("system.retention_pruned"),
    true,
  );
  assert.equal(summary.securityEventCount >= 4, true);
});

test("writeAuditLog redacts secrets, hashes, and preview-style payload fields", async () => {
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
      "user-agent": "phase-eight-test",
    },
  });

  await writeAuditLog({
    organizationId: "org_1",
    actorUserId: "user_1",
    action: "workflow.webhook_secret_regenerated",
    entityType: "workflow",
    entityId: "WFL-1",
    metadata: {
      secretHash: "hash-value",
      plainTextSecret: "nwhsec_secret",
      rawBody: "{\"token\":\"super-secret\"}",
      requestBodyPreview: "{\"authorization\":\"secret\"}",
      safe: "visible",
    },
    request,
  });

  assert.ok(insertedPayload);
  const payload = insertedPayload as { metadata: Record<string, unknown> };
  assert.deepEqual(payload.metadata, {
    secretHash: "[REDACTED]",
    plainTextSecret: "[REDACTED]",
    rawBody: "[REDACTED]",
    requestBodyPreview: "[REDACTED]",
    safe: "visible",
  });
});
