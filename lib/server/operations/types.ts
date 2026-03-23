import type { OperationalAlertState } from "@/lib/observability/alerts";
import type { AuditLogSummary } from "@/lib/server/audit-log";
import type {
  WorkflowRunFailureSummary,
  WorkflowRunListSummary,
} from "@/lib/server/workflows/types";

export type OperationsQueueSnapshot = {
  readyBacklog: number;
  delayedBacklog: number;
  totalBacklog: number;
  staleRunningCount: number;
  retryBacklogCount: number;
};

export type OperationsWebhookMetrics = {
  lookbackMinutes: number;
  accepted: number;
  rejected: number;
  duplicate: number;
  rateLimited: number;
};

export type OperationsRetentionSummary = {
  auditLogDays: number;
  executionLogDays: number;
  ingestionEventDays: number;
  dryRunCommand: string;
  applyCommand: string;
};

export type OperationsChecklistStatus = "complete" | "attention" | "manual";

export type OperationsChecklistItem = {
  key: string;
  title: string;
  status: OperationsChecklistStatus;
  detail: string;
  href: string | null;
};

export type OperationsMetrics = {
  runs: WorkflowRunListSummary;
  topFailureCodes: WorkflowRunFailureSummary[];
  webhooks: OperationsWebhookMetrics;
  audit: AuditLogSummary;
};

export type OperationsDashboardData = {
  generatedAt: string;
  lookbackMinutes: number;
  metrics: OperationsMetrics;
  alerts: OperationalAlertState[];
  queue: OperationsQueueSnapshot;
  retention: OperationsRetentionSummary;
  checklist: OperationsChecklistItem[];
};
