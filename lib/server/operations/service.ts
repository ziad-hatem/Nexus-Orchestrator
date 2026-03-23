import { getOptionalEnv } from "@/lib/env";
import {
  emitOperationalAlert,
  evaluateOperationalAlerts,
  getOperationsAlertLookbackMinutes,
  getOperationsStaleRunAlertSeconds,
} from "@/lib/observability/alerts";
import type { AuditLogSummary } from "@/lib/server/audit-log";
import { getOperationsRepositorySnapshot } from "@/lib/server/operations/repository";
import type {
  OperationsChecklistItem,
  OperationsDashboardData,
  OperationsQueueSnapshot,
  OperationsRetentionSummary,
  OperationsWebhookMetrics,
} from "@/lib/server/operations/types";
import type { WorkflowRunRow } from "@/lib/server/executions/types";
import type { WorkflowIngestionEventRow } from "@/lib/server/triggers/types";
import type {
  WorkflowRunFailureSummary,
  WorkflowRunListSummary,
  WorkflowRunStatus,
} from "@/lib/server/workflows/types";

export const operationsServiceDeps = {
  getOptionalEnv,
  emitOperationalAlert,
  evaluateOperationalAlerts,
  getOperationsAlertLookbackMinutes,
  getOperationsStaleRunAlertSeconds,
  getOperationsRepositorySnapshot,
};

function parsePositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function isWithinLookback(
  value: string | null,
  now: Date,
  lookbackMinutes: number,
): boolean {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return timestamp >= now.getTime() - lookbackMinutes * 60 * 1000;
}

export function buildRunSummaryFromRows(
  runs: WorkflowRunRow[],
): WorkflowRunListSummary {
  const counts: Record<WorkflowRunStatus, number> = {
    pending: 0,
    running: 0,
    success: 0,
    failed: 0,
    retrying: 0,
    cancelled: 0,
  };
  const failureCounts = new Map<string, number>();

  for (const run of runs) {
    counts[run.status] += 1;
    if (run.failure_code) {
      failureCounts.set(run.failure_code, (failureCounts.get(run.failure_code) ?? 0) + 1);
    }
  }

  const topFailureCodes: WorkflowRunFailureSummary[] = Array.from(failureCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([failureCode, count]) => ({
      failureCode,
      count,
    }));

  return {
    total: runs.length,
    pending: counts.pending,
    running: counts.running,
    success: counts.success,
    failed: counts.failed,
    retrying: counts.retrying,
    cancelled: counts.cancelled,
    topFailureCodes,
  };
}

export function buildWebhookMetrics(
  events: WorkflowIngestionEventRow[],
  now = new Date(),
  lookbackMinutes = operationsServiceDeps.getOperationsAlertLookbackMinutes(),
): OperationsWebhookMetrics {
  const relevant = events.filter(
    (event) =>
      event.source_type === "webhook" &&
      isWithinLookback(event.created_at, now, lookbackMinutes),
  );

  return {
    lookbackMinutes,
    accepted: relevant.filter((event) => event.status === "accepted").length,
    rejected: relevant.filter((event) => event.status === "rejected").length,
    duplicate: relevant.filter((event) => event.status === "duplicate").length,
    rateLimited: relevant.filter((event) => event.status === "rate_limited").length,
  };
}

export function buildQueueSnapshot(params: {
  runs: WorkflowRunRow[];
  readyBacklog: number;
  delayedBacklog: number;
  now?: Date;
  staleRunAlertSeconds?: number;
}): OperationsQueueSnapshot {
  const now = params.now ?? new Date();
  const staleThresholdSeconds =
    params.staleRunAlertSeconds ?? operationsServiceDeps.getOperationsStaleRunAlertSeconds();
  const staleRunningCount = params.runs.filter((run) => {
    if (run.status !== "running") {
      return false;
    }

    const heartbeatSource = run.last_heartbeat_at ?? run.started_at ?? run.created_at;
    const heartbeatTime = new Date(heartbeatSource).getTime();
    if (Number.isNaN(heartbeatTime)) {
      return true;
    }

    return now.getTime() - heartbeatTime >= staleThresholdSeconds * 1000;
  }).length;
  const retryBacklogCount = params.runs.filter(
    (run) => run.status === "retrying" && Boolean(run.next_retry_at),
  ).length;

  return {
    readyBacklog: params.readyBacklog,
    delayedBacklog: params.delayedBacklog,
    totalBacklog: params.readyBacklog + params.delayedBacklog,
    staleRunningCount,
    retryBacklogCount,
  };
}

export function buildRetentionSummary(): OperationsRetentionSummary {
  return {
    auditLogDays: parsePositiveInteger(
      operationsServiceDeps.getOptionalEnv("AUDIT_LOG_RETENTION_DAYS"),
      365,
    ),
    executionLogDays: parsePositiveInteger(
      operationsServiceDeps.getOptionalEnv("EXECUTION_LOG_RETENTION_DAYS"),
      90,
    ),
    ingestionEventDays: parsePositiveInteger(
      operationsServiceDeps.getOptionalEnv("INGESTION_EVENT_RETENTION_DAYS"),
      30,
    ),
    dryRunCommand: "npm run retention:prune:dry-run",
    applyCommand: "npm run retention:prune",
  };
}

export function buildOperationsChecklist(params: {
  orgSlug: string;
  audit: AuditLogSummary;
  queue: OperationsQueueSnapshot;
  alerts: OperationsDashboardData["alerts"];
  retention: OperationsRetentionSummary;
}): OperationsChecklistItem[] {
  const requiredEnvNames = [
    "SENTRY_DSN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "WEBHOOK_MAX_BODY_BYTES",
  ];
  const missingEnvs = requiredEnvNames.filter(
    (name) => !operationsServiceDeps.getOptionalEnv(name),
  );
  const criticalAlerts = params.alerts.filter((alert) => alert.status === "critical");

  return [
    {
      key: "envs",
      title: "Operational envs configured",
      status: missingEnvs.length === 0 ? "complete" : "attention",
      detail:
        missingEnvs.length === 0
          ? "Sentry, Upstash, and webhook hardening envs are configured."
          : `Missing envs: ${missingEnvs.join(", ")}`,
      href: null,
    },
    {
      key: "audit",
      title: "Audit coverage verified",
      status:
        params.audit.coverage.missingActions.length === 0 ? "complete" : "attention",
      detail:
        params.audit.coverage.missingActions.length === 0
          ? "All privileged workflow and admin actions in the current dataset are covered."
          : `Missing coverage for: ${params.audit.coverage.missingActions.join(", ")}`,
      href: `/org/${params.orgSlug}/audit`,
    },
    {
      key: "worker",
      title: "Worker health review",
      status: params.queue.staleRunningCount === 0 ? "complete" : "attention",
      detail:
        params.queue.staleRunningCount === 0
          ? "No stale running workflow runs are currently detected."
          : `${params.queue.staleRunningCount} stale running workflow run(s) need investigation.`,
      href: `/org/${params.orgSlug}/executions`,
    },
    {
      key: "queue",
      title: "Queue backlog under control",
      status: criticalAlerts.some((alert) => alert.key === "queue_backlog")
        ? "attention"
        : "complete",
      detail: `Ready backlog ${params.queue.readyBacklog}, delayed backlog ${params.queue.delayedBacklog}, retry backlog ${params.queue.retryBacklogCount}.`,
      href: `/org/${params.orgSlug}/operations`,
    },
    {
      key: "retention",
      title: "Retention policy scheduled",
      status: "manual",
      detail: `Audit ${params.retention.auditLogDays}d, execution ${params.retention.executionLogDays}d, ingestion ${params.retention.ingestionEventDays}d. Schedule ${params.retention.dryRunCommand} before ${params.retention.applyCommand}.`,
      href: null,
    },
    {
      key: "fire_drill",
      title: "Staging fire-drill completed",
      status: "manual",
      detail: "Trigger backlog, stale-run, and webhook rejection scenarios in staging and confirm Sentry receives the operational alerts.",
      href: null,
    },
  ];
}

export async function getOperationsDashboardData(params: {
  organizationId: string;
  organizationSlug: string;
  emitAlerts?: boolean;
}): Promise<OperationsDashboardData> {
  const now = new Date();
  const lookbackMinutes = operationsServiceDeps.getOperationsAlertLookbackMinutes();
  const snapshot = await operationsServiceDeps.getOperationsRepositorySnapshot(
    params.organizationId,
  );
  const runSummary = buildRunSummaryFromRows(snapshot.runs);
  const queue = buildQueueSnapshot({
    runs: snapshot.runs,
    readyBacklog: snapshot.queue.ready,
    delayedBacklog: snapshot.queue.delayed,
    now,
  });
  const webhookMetrics = buildWebhookMetrics(snapshot.ingestionEvents, now, lookbackMinutes);
  const retryExhaustionCount = snapshot.runs.filter(
    (run) =>
      run.status === "failed" &&
      run.attempt_count >= run.max_attempts &&
      isWithinLookback(run.completed_at, now, lookbackMinutes),
  ).length;
  const alerts = operationsServiceDeps.evaluateOperationalAlerts({
    queueBacklog: queue.totalBacklog,
    staleRunningCount: queue.staleRunningCount,
    recentWebhookRejections: webhookMetrics.rejected,
    retryExhaustionCount,
  });
  const retention = buildRetentionSummary();
  const checklist = buildOperationsChecklist({
    orgSlug: params.organizationSlug,
    audit: snapshot.audit.summary,
    queue,
    alerts,
    retention,
  });

  if (params.emitAlerts) {
    for (const alert of alerts) {
      if (alert.status === "ok") {
        continue;
      }

      operationsServiceDeps.emitOperationalAlert({
        alert,
        context: {
          organizationId: params.organizationId,
        },
        extras: {
          organizationSlug: params.organizationSlug,
        },
      });
    }
  }

  return {
    generatedAt: now.toISOString(),
    lookbackMinutes,
    metrics: {
      runs: runSummary,
      topFailureCodes: runSummary.topFailureCodes,
      webhooks: webhookMetrics,
      audit: snapshot.audit.summary,
    },
    alerts,
    queue,
    retention,
    checklist,
  };
}
