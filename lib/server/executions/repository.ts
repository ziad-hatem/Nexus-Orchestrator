import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type {
  StepExecutionRecordInput,
  WorkflowRunAttemptRow,
  WorkflowRunRow,
  WorkflowRunStepRow,
} from "@/lib/server/executions/types";
import type { WorkflowRunStatus } from "@/lib/server/workflows/types";

type WorkflowIngestionOriginRow = {
  id: string;
  status: "accepted" | "rejected" | "duplicate" | "rate_limited";
  source_context: unknown;
  triggered_by_user_id: string | null;
  created_at: string;
};

const RUN_SELECT =
  "id, organization_id, workflow_id, workflow_version_id, binding_id, run_key, correlation_id, status, trigger_source, source_context, payload, idempotency_key, created_by_event_id, attempt_count, max_attempts, started_at, completed_at, cancel_requested_at, cancelled_at, last_heartbeat_at, next_retry_at, last_retry_at, failure_code, failure_message, created_at, updated_at";
const STEP_SELECT =
  "id, run_id, organization_id, workflow_id, workflow_version_id, node_id, node_type, node_label, node_snapshot, sequence_number, attempt_number, branch_taken, status, correlation_id, input_payload, output_payload, error_code, error_message, logs, started_at, completed_at, created_at, updated_at";
const ATTEMPT_SELECT =
  "id, run_id, organization_id, workflow_id, workflow_version_id, attempt_number, launch_reason, requested_by_user_id, request_note, scheduled_for, backoff_seconds, status, failure_code, failure_message, started_at, completed_at, created_at, updated_at";

function getClient() {
  return createSupabaseAdminClient();
}

async function updateWorkflowRunRow(params: {
  runDbId: string;
  patch: Record<string, unknown>;
  expectedStatuses?: WorkflowRunStatus[];
}): Promise<WorkflowRunRow | null> {
  const supabase = getClient();
  let query = supabase
    .from("workflow_runs")
    .update({
      ...params.patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.runDbId);

  if (params.expectedStatuses?.length) {
    query = query.in("status", params.expectedStatuses);
  }

  const { data, error } = await query
    .select(RUN_SELECT)
    .maybeSingle<WorkflowRunRow>();

  if (error) {
    throw new Error(`Failed to update workflow run: ${error.message}`);
  }

  return data ?? null;
}

export async function listWorkflowRunRowsByOrganization(
  organizationId: string,
): Promise<WorkflowRunRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_runs")
    .select(RUN_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .returns<WorkflowRunRow[]>();

  if (error) {
    throw new Error(`Failed to load workflow runs: ${error.message}`);
  }

  return data ?? [];
}

export async function listWorkflowRunRowsByIds(
  runDbIds: string[],
): Promise<WorkflowRunRow[]> {
  if (runDbIds.length === 0) {
    return [];
  }

  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_runs")
    .select(RUN_SELECT)
    .in("id", Array.from(new Set(runDbIds)))
    .returns<WorkflowRunRow[]>();

  if (error) {
    throw new Error(`Failed to load workflow runs by ids: ${error.message}`);
  }

  return data ?? [];
}

export async function getWorkflowRunRowByDbId(
  runDbId: string,
): Promise<WorkflowRunRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_runs")
    .select(RUN_SELECT)
    .eq("id", runDbId)
    .maybeSingle<WorkflowRunRow>();

  if (error) {
    throw new Error(`Failed to load workflow run by db id: ${error.message}`);
  }

  return data ?? null;
}

export async function getWorkflowRunRowByPublicId(params: {
  organizationId: string;
  runId: string;
}): Promise<WorkflowRunRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_runs")
    .select(RUN_SELECT)
    .eq("organization_id", params.organizationId)
    .eq("run_key", params.runId)
    .maybeSingle<WorkflowRunRow>();

  if (error) {
    throw new Error(`Failed to load workflow run: ${error.message}`);
  }

  return data ?? null;
}

export async function claimWorkflowRunForExecution(
  runDbId: string,
): Promise<WorkflowRunRow | null> {
  const current = await getWorkflowRunRowByDbId(runDbId);
  if (!current || !["pending", "retrying"].includes(current.status)) {
    return null;
  }

  return updateWorkflowRunRow({
    runDbId,
    expectedStatuses: ["pending", "retrying"],
    patch: {
      status: "running",
      attempt_count: current.attempt_count + 1,
      started_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      next_retry_at: null,
      last_retry_at:
        current.attempt_count + 1 > 1 ? new Date().toISOString() : current.last_retry_at,
      failure_code: null,
      failure_message: null,
      cancel_requested_at: current.cancel_requested_at,
      completed_at: null,
      cancelled_at: null,
    },
  });
}

export async function touchWorkflowRunHeartbeat(
  runDbId: string,
): Promise<void> {
  await updateWorkflowRunRow({
    runDbId,
    expectedStatuses: ["running"],
    patch: {
      last_heartbeat_at: new Date().toISOString(),
    },
  });
}

export async function markWorkflowRunSuccess(
  runDbId: string,
): Promise<WorkflowRunRow | null> {
  const now = new Date().toISOString();
  return updateWorkflowRunRow({
    runDbId,
    expectedStatuses: ["running"],
    patch: {
      status: "success",
      completed_at: now,
      last_heartbeat_at: now,
      next_retry_at: null,
      failure_code: null,
      failure_message: null,
    },
  });
}

export async function markWorkflowRunFailed(params: {
  runDbId: string;
  failureCode: string;
  failureMessage: string;
}): Promise<WorkflowRunRow | null> {
  const now = new Date().toISOString();
  return updateWorkflowRunRow({
    runDbId: params.runDbId,
    expectedStatuses: ["running"],
    patch: {
      status: "failed",
      completed_at: now,
      last_heartbeat_at: now,
      next_retry_at: null,
      failure_code: params.failureCode,
      failure_message: params.failureMessage,
    },
  });
}

export async function markWorkflowRunRetrying(params: {
  runDbId: string;
  failureCode: string;
  failureMessage: string;
  nextRetryAt: string | null;
}): Promise<WorkflowRunRow | null> {
  const now = new Date().toISOString();
  return updateWorkflowRunRow({
    runDbId: params.runDbId,
    expectedStatuses: ["running"],
    patch: {
      status: "retrying",
      last_heartbeat_at: now,
      next_retry_at: params.nextRetryAt,
      failure_code: params.failureCode,
      failure_message: params.failureMessage,
      completed_at: null,
    },
  });
}

export async function queueWorkflowRunForManualRetry(params: {
  runDbId: string;
}): Promise<WorkflowRunRow | null> {
  return updateWorkflowRunRow({
    runDbId: params.runDbId,
    expectedStatuses: ["failed", "cancelled"],
    patch: {
      status: "pending",
      started_at: null,
      completed_at: null,
      cancel_requested_at: null,
      cancelled_at: null,
      last_heartbeat_at: null,
      next_retry_at: null,
      failure_code: null,
      failure_message: null,
    },
  });
}

export async function cancelWorkflowRunImmediately(params: {
  runDbId: string;
  expectedStatuses: WorkflowRunStatus[];
  failureMessage: string;
}): Promise<WorkflowRunRow | null> {
  const now = new Date().toISOString();
  return updateWorkflowRunRow({
    runDbId: params.runDbId,
    expectedStatuses: params.expectedStatuses,
    patch: {
      status: "cancelled",
      cancel_requested_at: now,
      cancelled_at: now,
      completed_at: now,
      last_heartbeat_at: now,
      next_retry_at: null,
      failure_code: "cancelled_by_user",
      failure_message: params.failureMessage,
    },
  });
}

export async function requestWorkflowRunCancellation(
  runDbId: string,
): Promise<WorkflowRunRow | null> {
  return updateWorkflowRunRow({
    runDbId,
    expectedStatuses: ["running"],
    patch: {
      cancel_requested_at: new Date().toISOString(),
    },
  });
}

export async function markWorkflowRunCancelledFromWorker(params: {
  runDbId: string;
  failureMessage: string;
}): Promise<WorkflowRunRow | null> {
  const now = new Date().toISOString();
  return updateWorkflowRunRow({
    runDbId: params.runDbId,
    expectedStatuses: ["running"],
    patch: {
      status: "cancelled",
      cancelled_at: now,
      completed_at: now,
      last_heartbeat_at: now,
      next_retry_at: null,
      failure_code: "cancelled_by_user",
      failure_message: params.failureMessage,
    },
  });
}

export async function getWorkflowRunAttemptRow(params: {
  runDbId: string;
  attemptNumber: number;
}): Promise<WorkflowRunAttemptRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_run_attempts")
    .select(ATTEMPT_SELECT)
    .eq("run_id", params.runDbId)
    .eq("attempt_number", params.attemptNumber)
    .maybeSingle<WorkflowRunAttemptRow>();

  if (error) {
    throw new Error(`Failed to load workflow run attempt: ${error.message}`);
  }

  return data ?? null;
}

export async function listWorkflowRunAttemptRows(
  runDbId: string,
): Promise<WorkflowRunAttemptRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_run_attempts")
    .select(ATTEMPT_SELECT)
    .eq("run_id", runDbId)
    .order("attempt_number", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<WorkflowRunAttemptRow[]>();

  if (error) {
    throw new Error(`Failed to load workflow run attempts: ${error.message}`);
  }

  return data ?? [];
}

export async function createWorkflowRunAttemptRow(params: {
  runId: string;
  organizationId: string;
  workflowId: string;
  workflowVersionId: string;
  attemptNumber: number;
  launchReason: WorkflowRunAttemptRow["launch_reason"];
  requestedByUserId?: string | null;
  requestNote?: string | null;
  scheduledFor?: string | null;
  backoffSeconds?: number | null;
  status?: WorkflowRunAttemptRow["status"];
  failureCode?: string | null;
  failureMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}): Promise<WorkflowRunAttemptRow> {
  const existing = await getWorkflowRunAttemptRow({
    runDbId: params.runId,
    attemptNumber: params.attemptNumber,
  });
  if (existing) {
    return existing;
  }

  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_run_attempts")
    .insert({
      run_id: params.runId,
      organization_id: params.organizationId,
      workflow_id: params.workflowId,
      workflow_version_id: params.workflowVersionId,
      attempt_number: params.attemptNumber,
      launch_reason: params.launchReason,
      requested_by_user_id: params.requestedByUserId ?? null,
      request_note: params.requestNote ?? null,
      scheduled_for: params.scheduledFor ?? new Date().toISOString(),
      backoff_seconds: params.backoffSeconds ?? null,
      status: params.status ?? "scheduled",
      failure_code: params.failureCode ?? null,
      failure_message: params.failureMessage ?? null,
      started_at: params.startedAt ?? null,
      completed_at: params.completedAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .select(ATTEMPT_SELECT)
    .single<WorkflowRunAttemptRow>();

  if (error || !data) {
    throw new Error(
      `Failed to create workflow run attempt: ${error?.message ?? "Unknown error"}`,
    );
  }

  return data;
}

export async function updateWorkflowRunAttemptRow(params: {
  attemptId: string;
  patch: Record<string, unknown>;
}): Promise<WorkflowRunAttemptRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_run_attempts")
    .update({
      ...params.patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.attemptId)
    .select(ATTEMPT_SELECT)
    .maybeSingle<WorkflowRunAttemptRow>();

  if (error) {
    throw new Error(`Failed to update workflow run attempt: ${error.message}`);
  }

  return data ?? null;
}

export async function markWorkflowRunAttemptRunning(params: {
  runDbId: string;
  attemptNumber: number;
}): Promise<WorkflowRunAttemptRow | null> {
  const attempt = await getWorkflowRunAttemptRow({
    runDbId: params.runDbId,
    attemptNumber: params.attemptNumber,
  });
  if (!attempt) {
    return null;
  }

  return updateWorkflowRunAttemptRow({
    attemptId: attempt.id,
    patch: {
      status: "running",
      started_at: new Date().toISOString(),
      completed_at: null,
      failure_code: null,
      failure_message: null,
    },
  });
}

export async function completeWorkflowRunAttempt(params: {
  runDbId: string;
  attemptNumber: number;
  status: "success" | "failed" | "cancelled";
  failureCode?: string | null;
  failureMessage?: string | null;
}): Promise<WorkflowRunAttemptRow | null> {
  const attempt = await getWorkflowRunAttemptRow({
    runDbId: params.runDbId,
    attemptNumber: params.attemptNumber,
  });
  if (!attempt) {
    return null;
  }

  return updateWorkflowRunAttemptRow({
    attemptId: attempt.id,
    patch: {
      status: params.status,
      failure_code: params.failureCode ?? null,
      failure_message: params.failureMessage ?? null,
      completed_at: new Date().toISOString(),
    },
  });
}

export async function listWorkflowRunStepRows(
  runDbId: string,
): Promise<WorkflowRunStepRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_run_steps")
    .select(STEP_SELECT)
    .eq("run_id", runDbId)
    .order("attempt_number", { ascending: true })
    .order("sequence_number", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<WorkflowRunStepRow[]>();

  if (error) {
    throw new Error(`Failed to load workflow run steps: ${error.message}`);
  }

  return data ?? [];
}

export async function createWorkflowRunStepRow(
  params: StepExecutionRecordInput,
): Promise<WorkflowRunStepRow> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_run_steps")
    .insert({
      run_id: params.runId,
      organization_id: params.organizationId,
      workflow_id: params.workflowId,
      workflow_version_id: params.workflowVersionId,
      node_id: params.nodeId,
      node_type: params.nodeType,
      node_label: params.nodeLabel,
      node_snapshot: params.nodeSnapshot,
      sequence_number: params.sequenceNumber,
      attempt_number: params.attemptNumber,
      branch_taken: params.branchTaken ?? null,
      status: params.status,
      correlation_id: params.correlationId,
      input_payload: params.inputPayload ?? {},
      output_payload: params.outputPayload ?? {},
      error_code: params.errorCode ?? null,
      error_message: params.errorMessage ?? null,
      logs: params.logs ?? [],
      started_at: params.startedAt ?? null,
      completed_at: params.completedAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .select(STEP_SELECT)
    .single<WorkflowRunStepRow>();

  if (error || !data) {
    throw new Error(
      `Failed to create workflow run step: ${error?.message ?? "Unknown error"}`,
    );
  }

  return data;
}

export async function updateWorkflowRunStepRow(params: {
  stepId: string;
  patch: Record<string, unknown>;
}): Promise<WorkflowRunStepRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_run_steps")
    .update({
      ...params.patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.stepId)
    .select(STEP_SELECT)
    .maybeSingle<WorkflowRunStepRow>();

  if (error) {
    throw new Error(`Failed to update workflow run step: ${error.message}`);
  }

  return data ?? null;
}

export async function getWorkflowIngestionOriginById(
  eventId: string,
): Promise<WorkflowIngestionOriginRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_ingestion_events")
    .select("id, status, source_context, triggered_by_user_id, created_at")
    .eq("id", eventId)
    .maybeSingle<WorkflowIngestionOriginRow>();

  if (error) {
    throw new Error(
      `Failed to load workflow ingestion origin event: ${error.message}`,
    );
  }

  return data ?? null;
}
