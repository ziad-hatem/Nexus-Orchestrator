import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("retention helpers derive policy, cutoffs, and scrub marker deterministically", async () => {
  const {
    buildRetentionCutoffs,
    buildRetentionScrubMarker,
    getRetentionPolicyFromEnv,
  } = await import("../../scripts/retention-helpers.mjs");

  const retention = getRetentionPolicyFromEnv({
    AUDIT_LOG_RETENTION_DAYS: "120",
    EXECUTION_LOG_RETENTION_DAYS: "45",
    INGESTION_EVENT_RETENTION_DAYS: "15",
  });
  const now = new Date("2026-03-23T12:00:00.000Z");
  const cutoffs = buildRetentionCutoffs(now, retention);
  const scrubMarker = buildRetentionScrubMarker(now);

  assert.deepEqual(retention, {
    auditLogDays: 120,
    executionLogDays: 45,
    ingestionEventDays: 15,
  });
  assert.equal(cutoffs.audit.toISOString(), "2025-11-23T12:00:00.000Z");
  assert.equal(cutoffs.execution.toISOString(), "2026-02-06T12:00:00.000Z");
  assert.equal(cutoffs.ingestion.toISOString(), "2026-03-08T12:00:00.000Z");
  assert.deepEqual(scrubMarker, {
    retained: false,
    reason: "retention_policy",
    scrubbedAt: "2026-03-23T12:00:00.000Z",
  });
});

test("phase-eight hardening SQL defines the expected pilot-release indexes", async () => {
  const sql = await readFile("db/phase-eight-hardening.sql", "utf8");

  assert.match(sql, /audit_logs_org_entity_created_idx/);
  assert.match(sql, /audit_logs_actor_created_idx/);
  assert.match(sql, /workflow_trigger_bindings_active_webhook_secret_usage_idx/);
  assert.match(sql, /workflow_ingestion_events_org_source_status_created_idx/);
  assert.match(sql, /workflow_ingestion_events_org_error_created_idx/);
  assert.match(sql, /workflow_runs_running_heartbeat_idx/);
  assert.match(sql, /workflow_runs_retry_backlog_idx/);
});
