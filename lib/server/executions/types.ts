import type {
  WorkflowRecordValueType,
  WorkflowConditionBranchKey,
  WorkflowConditionOperator,
  WorkflowConditionResolverScope,
  WorkflowConditionValue,
  WorkflowRunAttemptLaunchReason,
  WorkflowRunAttemptRecord as AppWorkflowRunAttemptRecord,
  WorkflowRunAttemptStatus,
  WorkflowRunDetail as AppWorkflowRunDetail,
  WorkflowRunFailureSummary as AppWorkflowRunFailureSummary,
  WorkflowRunListSummary as AppWorkflowRunListSummary,
  WorkflowRunStepStatus as AppWorkflowRunStepStatus,
  WorkflowRunSummary as AppWorkflowRunSummary,
  WorkflowRunStatus,
  WorkflowSourceContext,
  WorkflowTriggerSource,
} from "@/lib/server/workflows/types";
import type { SupportedActionExecutionOutput } from "@/lib/server/actions/types";

export type ExecutionQueueJob = {
  runDbId: string;
  organizationId: string;
  runKey: string;
  correlationId: string;
  enqueuedAt: string;
  reason: "trigger" | "retry" | "manual_retry";
};

export type WorkflowRunRow = {
  id: string;
  organization_id: string;
  workflow_id: string;
  workflow_version_id: string;
  binding_id: string;
  run_key: string;
  correlation_id: string;
  status: WorkflowRunStatus;
  trigger_source: WorkflowTriggerSource;
  source_context: unknown;
  payload: unknown;
  idempotency_key: string | null;
  created_by_event_id: string | null;
  attempt_count: number;
  max_attempts: number;
  started_at: string | null;
  completed_at: string | null;
  cancel_requested_at: string | null;
  cancelled_at: string | null;
  last_heartbeat_at: string | null;
  next_retry_at: string | null;
  last_retry_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowRunStepStatus = AppWorkflowRunStepStatus;

export type WorkflowRunStepRow = {
  id: string;
  run_id: string;
  organization_id: string;
  workflow_id: string;
  workflow_version_id: string;
  node_id: string;
  node_type: string;
  node_label: string;
  node_snapshot: unknown;
  sequence_number: number;
  attempt_number: number;
  branch_taken: string | null;
  status: WorkflowRunStepStatus;
  correlation_id: string;
  input_payload: unknown;
  output_payload: unknown;
  error_code: string | null;
  error_message: string | null;
  logs: unknown;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowRunLookupRow = WorkflowRunRow & {
  workflow_key: string;
  workflow_name: string;
  workflow_status: string;
  workflow_category: string;
  workflow_version_number: number;
};

export type WorkflowRunSummary = AppWorkflowRunSummary;
export type WorkflowRunFailureSummary = AppWorkflowRunFailureSummary;
export type WorkflowRunListSummary = AppWorkflowRunListSummary;

export type WorkflowRunStepRecord = {
  stepId: string;
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  sequenceNumber: number;
  attemptNumber: number;
  branchTaken: WorkflowConditionBranchKey | null;
  status: WorkflowRunStepStatus;
  correlationId: string;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
  logs: Array<Record<string, unknown>>;
  startedAt: string | null;
  completedAt: string | null;
};

export type WorkflowRunDetail = AppWorkflowRunDetail;
export type WorkflowRunAttemptRecord = AppWorkflowRunAttemptRecord;

export type WorkflowRunAttemptRow = {
  id: string;
  run_id: string;
  organization_id: string;
  workflow_id: string;
  workflow_version_id: string;
  attempt_number: number;
  launch_reason: WorkflowRunAttemptLaunchReason;
  requested_by_user_id: string | null;
  request_note: string | null;
  scheduled_for: string;
  backoff_seconds: number | null;
  status: WorkflowRunAttemptStatus;
  failure_code: string | null;
  failure_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExecutionListFilters = {
  query?: string;
  status?: WorkflowRunStatus;
  source?: WorkflowTriggerSource;
  workflowId?: string;
  page: number;
  pageSize: number;
};

export type RunCancellationResult = {
  run: WorkflowRunSummary;
  accepted: boolean;
  mode: "immediate" | "cooperative";
};

export type RunRetryResult = {
  run: WorkflowRunSummary;
  accepted: boolean;
  mode: "manual_retry";
  attemptNumber: number;
};

export type ExecutionStepLog = {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
};

export type WorkflowConditionStepOutput = {
  matched: boolean;
  resolverScope: WorkflowConditionResolverScope;
  resolverPath: string;
  operator: WorkflowConditionOperator;
  expectedValue: WorkflowConditionValue | null;
  resolvedValue: unknown;
  terminationReason: "condition_not_met" | null;
  nextNodeId: string | null;
};

export type WorkflowConditionStepLogData = {
  matched: boolean;
  resolverScope: WorkflowConditionResolverScope;
  resolverPath: string;
  operator: WorkflowConditionOperator;
  expectedValue: WorkflowConditionValue | null;
  resolvedValue: unknown;
  terminationReason: "condition_not_met" | null;
};

export type WorkflowActionStepOutput = SupportedActionExecutionOutput;

export type WorkflowActionStepLogData =
  | {
      actionType: "send_webhook";
      status: number;
      url: string;
    }
  | {
      actionType: "send_email";
      recipient: string;
      providerMessageId: string | null;
    }
  | {
      actionType: "create_task";
      taskId: string;
      assigneeEmail: string | null;
    }
  | {
      actionType: "update_record_field";
      recordId: string;
      recordType: string;
      recordKey: string;
      field: string;
      valueType: WorkflowRecordValueType;
    };

export type StepExecutionRecordInput = {
  runId: string;
  organizationId: string;
  workflowId: string;
  workflowVersionId: string;
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  nodeSnapshot: Record<string, unknown>;
  sequenceNumber: number;
  attemptNumber: number;
  branchTaken?: string | null;
  status: WorkflowRunStepStatus;
  correlationId: string;
  inputPayload?: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
  logs?: ExecutionStepLog[];
  startedAt?: string | null;
  completedAt?: string | null;
};

export type ExecutorClassification = "success" | "retryable_failure" | "fatal_failure";

export type ExecutorContext = {
  run: WorkflowRunRow;
  stepId: string;
  correlationId: string;
  organizationId: string;
  workflowId: string;
  workflowVersionId: string;
  payload: Record<string, unknown>;
  sourceContext: WorkflowSourceContext;
};

export type ExecutorResult = {
  classification: ExecutorClassification;
  output: Record<string, unknown>;
  logs: ExecutionStepLog[];
  errorCode?: string | null;
  errorMessage?: string | null;
};

export function createWorkflowRunKey(): string {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `RUN-${random}`;
}

export function createWorkflowCorrelationId(): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `corr_${Date.now().toString(36)}_${random}`;
}
