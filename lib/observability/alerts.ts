import { getOptionalEnv } from "@/lib/env";
import {
  captureServerMessage,
  type MonitoringContext,
} from "@/lib/observability/error-tracking";

export const alertsDeps = {
  getOptionalEnv,
  captureServerMessage,
};

export const OPERATIONAL_ALERT_KEYS = [
  "queue_backlog",
  "stale_runs",
  "webhook_rejection_spike",
  "retry_exhaustion",
] as const;

export type OperationalAlertKey = (typeof OPERATIONAL_ALERT_KEYS)[number];
export type OperationalAlertStatus = "ok" | "warning" | "critical";

export type OperationalAlertState = {
  key: OperationalAlertKey;
  title: string;
  status: OperationalAlertStatus;
  currentValue: number;
  thresholdValue: number;
  message: string;
};

export type OperationalAlertInput = {
  queueBacklog: number;
  staleRunningCount: number;
  recentWebhookRejections: number;
  retryExhaustionCount: number;
};

function parsePositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function getOperationsQueueBacklogAlertThreshold(): number {
  return parsePositiveInteger(
    alertsDeps.getOptionalEnv("OPERATIONS_QUEUE_BACKLOG_ALERT_THRESHOLD"),
    50,
  );
}

export function getOperationsStaleRunAlertSeconds(): number {
  return parsePositiveInteger(
    alertsDeps.getOptionalEnv("OPERATIONS_STALE_RUN_ALERT_SECONDS"),
    300,
  );
}

export function getOperationsWebhookRejectionSpikeThreshold(): number {
  return parsePositiveInteger(
    alertsDeps.getOptionalEnv("OPERATIONS_WEBHOOK_REJECTION_SPIKE_THRESHOLD"),
    10,
  );
}

export function getOperationsRetryExhaustionAlertThreshold(): number {
  return parsePositiveInteger(
    alertsDeps.getOptionalEnv("OPERATIONS_RETRY_EXHAUSTION_ALERT_THRESHOLD"),
    5,
  );
}

export function getOperationsAlertLookbackMinutes(): number {
  return parsePositiveInteger(
    alertsDeps.getOptionalEnv("OPERATIONS_ALERT_LOOKBACK_MINUTES"),
    60,
  );
}

function statusFromRatio(current: number, threshold: number): OperationalAlertStatus {
  if (threshold <= 0) {
    return current > 0 ? "critical" : "ok";
  }

  if (current >= threshold) {
    return "critical";
  }

  if (current >= Math.max(1, Math.floor(threshold * 0.6))) {
    return "warning";
  }

  return "ok";
}

export function evaluateOperationalAlerts(
  input: OperationalAlertInput,
): OperationalAlertState[] {
  const queueThreshold = getOperationsQueueBacklogAlertThreshold();
  const staleThresholdSeconds = getOperationsStaleRunAlertSeconds();
  const rejectionThreshold = getOperationsWebhookRejectionSpikeThreshold();
  const retryExhaustionThreshold = getOperationsRetryExhaustionAlertThreshold();
  const lookbackMinutes = getOperationsAlertLookbackMinutes();

  return [
    {
      key: "queue_backlog",
      title: "Queue backlog",
      status: statusFromRatio(input.queueBacklog, queueThreshold),
      currentValue: input.queueBacklog,
      thresholdValue: queueThreshold,
      message:
        input.queueBacklog >= queueThreshold
          ? `Execution queue backlog is ${input.queueBacklog}, exceeding the threshold of ${queueThreshold}.`
          : `Execution queue backlog is ${input.queueBacklog}.`,
    },
    {
      key: "stale_runs",
      title: "Stale running runs",
      status: input.staleRunningCount > 0 ? "critical" : "ok",
      currentValue: input.staleRunningCount,
      thresholdValue: staleThresholdSeconds,
      message:
        input.staleRunningCount > 0
          ? `${input.staleRunningCount} running workflow run(s) have exceeded the ${staleThresholdSeconds}s heartbeat threshold.`
          : "No stale running workflow runs were detected.",
    },
    {
      key: "webhook_rejection_spike",
      title: "Webhook rejection spike",
      status: statusFromRatio(input.recentWebhookRejections, rejectionThreshold),
      currentValue: input.recentWebhookRejections,
      thresholdValue: rejectionThreshold,
      message:
        input.recentWebhookRejections >= rejectionThreshold
          ? `${input.recentWebhookRejections} webhook rejections were recorded in the last ${lookbackMinutes} minutes.`
          : `${input.recentWebhookRejections} webhook rejections were recorded in the last ${lookbackMinutes} minutes.`,
    },
    {
      key: "retry_exhaustion",
      title: "Retry exhaustion",
      status: statusFromRatio(input.retryExhaustionCount, retryExhaustionThreshold),
      currentValue: input.retryExhaustionCount,
      thresholdValue: retryExhaustionThreshold,
      message:
        input.retryExhaustionCount >= retryExhaustionThreshold
          ? `${input.retryExhaustionCount} runs exhausted their retry budget in the last ${lookbackMinutes} minutes.`
          : `${input.retryExhaustionCount} runs exhausted their retry budget in the last ${lookbackMinutes} minutes.`,
    },
  ];
}

export function emitOperationalAlert(params: {
  alert: OperationalAlertState;
  context?: MonitoringContext;
  extras?: Record<string, unknown>;
}): string | null {
  if (params.alert.status === "ok") {
    return null;
  }

  return alertsDeps.captureServerMessage(params.alert.message, {
    context: {
      ...params.context,
      alertKey: params.alert.key,
    },
    level: params.alert.status === "critical" ? "error" : "warning",
    extras: {
      currentValue: params.alert.currentValue,
      thresholdValue: params.alert.thresholdValue,
      ...params.extras,
    },
    fingerprint: ["operations-alert", params.alert.key],
  });
}
