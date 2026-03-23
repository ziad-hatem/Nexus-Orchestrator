import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOperationalAlerts } from "@/lib/observability/alerts";

test("evaluateOperationalAlerts marks threshold breaches as critical", () => {
  const previous = {
    queue: process.env.OPERATIONS_QUEUE_BACKLOG_ALERT_THRESHOLD,
    webhook: process.env.OPERATIONS_WEBHOOK_REJECTION_SPIKE_THRESHOLD,
    retry: process.env.OPERATIONS_RETRY_EXHAUSTION_ALERT_THRESHOLD,
  };
  process.env.OPERATIONS_QUEUE_BACKLOG_ALERT_THRESHOLD = "5";
  process.env.OPERATIONS_WEBHOOK_REJECTION_SPIKE_THRESHOLD = "2";
  process.env.OPERATIONS_RETRY_EXHAUSTION_ALERT_THRESHOLD = "1";

  const alerts = evaluateOperationalAlerts({
    queueBacklog: 7,
    staleRunningCount: 1,
    recentWebhookRejections: 2,
    retryExhaustionCount: 1,
  });

  assert.equal(alerts.find((alert) => alert.key === "queue_backlog")?.status, "critical");
  assert.equal(alerts.find((alert) => alert.key === "stale_runs")?.status, "critical");
  assert.equal(
    alerts.find((alert) => alert.key === "webhook_rejection_spike")?.status,
    "critical",
  );
  assert.equal(alerts.find((alert) => alert.key === "retry_exhaustion")?.status, "critical");

  process.env.OPERATIONS_QUEUE_BACKLOG_ALERT_THRESHOLD = previous.queue;
  process.env.OPERATIONS_WEBHOOK_REJECTION_SPIKE_THRESHOLD = previous.webhook;
  process.env.OPERATIONS_RETRY_EXHAUSTION_ALERT_THRESHOLD = previous.retry;
});
