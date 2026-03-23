import assert from "node:assert/strict";
import test from "node:test";
import { type AuditLogSummary } from "@/lib/server/audit-log";
import { type OperationalAlertState } from "@/lib/observability/alerts";
import {
  buildQueueSnapshot,
  buildWebhookMetrics,
  getOperationsDashboardData,
  operationsServiceDeps,
} from "@/lib/server/operations/service";
import type { WorkflowRunRow } from "@/lib/server/executions/types";
import type { WorkflowIngestionEventRow } from "@/lib/server/triggers/types";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalOperationsServiceDeps = { ...operationsServiceDeps };

test.afterEach(() => {
  restoreMutableExports(operationsServiceDeps, originalOperationsServiceDeps);
});

function createRunRow(overrides: Partial<WorkflowRunRow> = {}): WorkflowRunRow {
  return {
    id: "run_db_1",
    organization_id: "org_1",
    workflow_id: "workflow_db_1",
    workflow_version_id: "version_db_1",
    binding_id: "binding_1",
    run_key: "RUN-1001",
    correlation_id: "corr_1",
    status: "running",
    trigger_source: "manual",
    source_context: {},
    payload: {},
    idempotency_key: null,
    created_by_event_id: null,
    attempt_count: 1,
    max_attempts: 3,
    started_at: "2026-03-23T00:00:00.000Z",
    completed_at: null,
    cancel_requested_at: null,
    cancelled_at: null,
    last_heartbeat_at: "2026-03-23T00:00:00.000Z",
    next_retry_at: null,
    last_retry_at: null,
    failure_code: null,
    failure_message: null,
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createEventRow(
  overrides: Partial<WorkflowIngestionEventRow> = {},
): WorkflowIngestionEventRow {
  return {
    id: "event_1",
    organization_id: "org_1",
    workflow_id: "workflow_db_1",
    workflow_version_id: "version_db_1",
    binding_id: "binding_1",
    run_id: "run_db_1",
    source_type: "webhook",
    match_key: "hooks/acme",
    status: "accepted",
    source_context: {},
    payload: {},
    idempotency_key: null,
    error_code: null,
    error_message: null,
    request_ip: null,
    request_user_agent: null,
    triggered_by_user_id: null,
    created_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createAuditSummary(): AuditLogSummary {
  return {
    total: 3,
    uniqueActorCount: 2,
    securityEventCount: 1,
    topActions: [{ action: "workflow.run_retried", count: 2 }],
    coverage: {
      requiredActions: [],
      observedActions: [],
      missingActions: [],
      coveredCount: 0,
      totalRequired: 0,
    },
  };
}

test("buildQueueSnapshot reports stale runs and retry backlog counts", () => {
  const snapshot = buildQueueSnapshot({
    runs: [
      createRunRow({
        status: "running",
        started_at: "2026-03-23T00:00:00.000Z",
        last_heartbeat_at: "2026-03-23T00:00:00.000Z",
      }),
      createRunRow({
        id: "run_db_2",
        run_key: "RUN-1002",
        status: "retrying",
        next_retry_at: "2026-03-23T00:06:00.000Z",
      }),
    ],
    readyBacklog: 4,
    delayedBacklog: 3,
    now: new Date("2026-03-23T00:10:00.000Z"),
    staleRunAlertSeconds: 300,
  });

  assert.equal(snapshot.readyBacklog, 4);
  assert.equal(snapshot.delayedBacklog, 3);
  assert.equal(snapshot.totalBacklog, 7);
  assert.equal(snapshot.staleRunningCount, 1);
  assert.equal(snapshot.retryBacklogCount, 1);
});

test("buildWebhookMetrics filters events to the configured lookback window", () => {
  const metrics = buildWebhookMetrics(
    [
      createEventRow({
        id: "accepted",
        status: "accepted",
        created_at: "2026-03-23T00:50:00.000Z",
      }),
      createEventRow({
        id: "rejected",
        status: "rejected",
        created_at: "2026-03-23T00:40:00.000Z",
      }),
      createEventRow({
        id: "duplicate",
        status: "duplicate",
        created_at: "2026-03-22T22:00:00.000Z",
      }),
      createEventRow({
        id: "internal",
        source_type: "internal_event",
        created_at: "2026-03-23T00:45:00.000Z",
      }),
    ],
    new Date("2026-03-23T01:00:00.000Z"),
    30,
  );

  assert.deepEqual(metrics, {
    lookbackMinutes: 30,
    accepted: 1,
    rejected: 1,
    duplicate: 0,
    rateLimited: 0,
  });
});

test("getOperationsDashboardData emits only non-ok alerts with org context", async () => {
  const recentTimestamp = new Date(Date.now() - 60_000).toISOString();
  const emitted: Array<{
    alertKey: string;
    organizationId: string;
    organizationSlug: string;
  }> = [];
  const alerts: OperationalAlertState[] = [
    {
      key: "queue_backlog",
      title: "Queue backlog",
      status: "ok",
      currentValue: 1,
      thresholdValue: 50,
      message: "ok",
    },
    {
      key: "stale_runs",
      title: "Stale runs",
      status: "critical",
      currentValue: 2,
      thresholdValue: 300,
      message: "stale",
    },
    {
      key: "webhook_rejection_spike",
      title: "Webhook rejection spike",
      status: "ok",
      currentValue: 0,
      thresholdValue: 10,
      message: "ok",
    },
    {
      key: "retry_exhaustion",
      title: "Retry exhaustion",
      status: "warning",
      currentValue: 1,
      thresholdValue: 5,
      message: "retrying",
    },
  ];

  operationsServiceDeps.getOperationsRepositorySnapshot = async () => ({
    runs: [
      createRunRow({
        status: "failed",
        completed_at: recentTimestamp,
        attempt_count: 3,
        max_attempts: 3,
        failure_code: "provider_timeout",
      }),
      createRunRow({
        id: "run_db_2",
        run_key: "RUN-1002",
        status: "retrying",
        next_retry_at: "2026-03-23T01:05:00.000Z",
      }),
    ],
    ingestionEvents: [
      createEventRow({
        id: "rejected",
        status: "rejected",
        created_at: recentTimestamp,
      }),
    ],
    audit: {
      summary: createAuditSummary(),
      logs: [],
      total: 3,
      availableActions: [],
    },
    queue: {
      ready: 7,
      delayed: 5,
    },
  });
  operationsServiceDeps.getOperationsAlertLookbackMinutes = () => 60;
  operationsServiceDeps.getOperationsStaleRunAlertSeconds = () => 300;
  operationsServiceDeps.evaluateOperationalAlerts = () => alerts;
  operationsServiceDeps.emitOperationalAlert = (params) => {
    emitted.push({
      alertKey: params.alert.key,
      organizationId: String(params.context?.organizationId),
      organizationSlug: String(params.extras?.organizationSlug),
    });
    return "alert_1";
  };
  operationsServiceDeps.getOptionalEnv = (name: string) => {
    if (
      name === "SENTRY_DSN" ||
      name === "UPSTASH_REDIS_REST_URL" ||
      name === "UPSTASH_REDIS_REST_TOKEN" ||
      name === "WEBHOOK_MAX_BODY_BYTES"
    ) {
      return "configured";
    }

    return null;
  };

  const result = await getOperationsDashboardData({
    organizationId: "org_1",
    organizationSlug: "acme",
    emitAlerts: true,
  });

  assert.equal(result.metrics.runs.total, 2);
  assert.equal(result.metrics.webhooks.rejected, 1);
  assert.equal(result.queue.totalBacklog, 12);
  assert.deepEqual(
    emitted.map((entry) => entry.alertKey),
    ["stale_runs", "retry_exhaustion"],
  );
  assert.equal(emitted[0]?.organizationId, "org_1");
  assert.equal(emitted[0]?.organizationSlug, "acme");
});
