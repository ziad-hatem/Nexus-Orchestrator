import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOperationsChecklist,
  buildRetentionSummary,
  operationsServiceDeps,
} from "@/lib/server/operations/service";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalOperationsServiceDeps = { ...operationsServiceDeps };

test.afterEach(() => {
  restoreMutableExports(operationsServiceDeps, originalOperationsServiceDeps);
});

test("buildRetentionSummary honors configured env values", () => {
  operationsServiceDeps.getOptionalEnv = (name: string) => {
    switch (name) {
      case "AUDIT_LOG_RETENTION_DAYS":
        return "180";
      case "EXECUTION_LOG_RETENTION_DAYS":
        return "45";
      case "INGESTION_EVENT_RETENTION_DAYS":
        return "14";
      default:
        return null;
    }
  };

  const summary = buildRetentionSummary();

  assert.deepEqual(summary, {
    auditLogDays: 180,
    executionLogDays: 45,
    ingestionEventDays: 14,
    dryRunCommand: "npm run retention:prune:dry-run",
    applyCommand: "npm run retention:prune",
  });
});

test("buildOperationsChecklist reflects missing envs and operational gaps", () => {
  operationsServiceDeps.getOptionalEnv = (name: string) =>
    name === "UPSTASH_REDIS_REST_URL" ? "configured" : null;

  const checklist = buildOperationsChecklist({
    orgSlug: "acme",
    audit: {
      total: 2,
      uniqueActorCount: 1,
      securityEventCount: 1,
      topActions: [],
      coverage: {
        requiredActions: ["workflow.created", "workflow.archived"],
        observedActions: ["workflow.created"],
        missingActions: ["workflow.archived"],
        coveredCount: 1,
        totalRequired: 2,
      },
    },
    queue: {
      readyBacklog: 12,
      delayedBacklog: 4,
      totalBacklog: 16,
      staleRunningCount: 2,
      retryBacklogCount: 3,
    },
    alerts: [
      {
        key: "queue_backlog",
        title: "Queue backlog",
        status: "critical",
        currentValue: 16,
        thresholdValue: 10,
        message: "backlog high",
      },
    ],
    retention: {
      auditLogDays: 365,
      executionLogDays: 90,
      ingestionEventDays: 30,
      dryRunCommand: "npm run retention:prune:dry-run",
      applyCommand: "npm run retention:prune",
    },
  });

  const envsItem = checklist.find((item) => item.key === "envs");
  const auditItem = checklist.find((item) => item.key === "audit");
  const workerItem = checklist.find((item) => item.key === "worker");
  const queueItem = checklist.find((item) => item.key === "queue");
  const retentionItem = checklist.find((item) => item.key === "retention");

  assert.equal(envsItem?.status, "attention");
  assert.match(envsItem?.detail ?? "", /SENTRY_DSN/);
  assert.equal(auditItem?.status, "attention");
  assert.match(auditItem?.detail ?? "", /workflow\.archived/);
  assert.equal(workerItem?.status, "attention");
  assert.equal(queueItem?.status, "attention");
  assert.equal(retentionItem?.status, "manual");
});
