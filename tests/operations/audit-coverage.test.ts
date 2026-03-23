import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  PRIVILEGED_AUDIT_ACTIONS,
  summarizeAuditLogs,
  type AuditLogEntry,
} from "@/lib/server/audit-log";

function createAuditLog(action: string, overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: randomUUID(),
    organization_id: "org_123",
    actor_user_id: "user_123",
    action,
    entity_type: "workflow",
    entity_id: "WFL-123",
    metadata: {},
    ip_address: null,
    user_agent: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

test("summarizeAuditLogs reports privileged coverage and top actions", () => {
  const logs = [
    createAuditLog("workflow.created"),
    createAuditLog("workflow.published"),
    createAuditLog("workflow.published"),
    createAuditLog("workflow.run_retried"),
  ];

  const summary = summarizeAuditLogs(logs);

  assert.equal(summary.total, logs.length);
  assert.equal(summary.topActions[0]?.action, "workflow.published");
  assert.equal(summary.coverage.observedActions.includes("workflow.created"), true);
  assert.equal(summary.coverage.coveredCount >= 3, true);
  assert.equal(summary.coverage.totalRequired, PRIVILEGED_AUDIT_ACTIONS.length);
  assert.equal(summary.coverage.missingActions.includes("workflow.archived"), true);
});
