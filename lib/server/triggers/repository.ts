import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type {
  TriggerBindingRow,
  WorkflowIngestionEventRow,
} from "@/lib/server/triggers/types";
import type { WorkflowRunRow } from "@/lib/server/executions/types";

type WorkflowLookupRow = {
  id: string;
  workflow_key: string;
  name: string;
  status: string;
  category: string;
  latest_published_version_number: number | null;
};

type WorkflowVersionLookupRow = {
  id: string;
  workflow_id: string;
  version_number: number;
};

const TRIGGER_BINDING_SELECT =
  "*";

export const triggerRepositoryDeps = {
  createSupabaseAdminClient,
};

function isMissingTriggerBindingSecurityColumnError(message: string): boolean {
  return (
    message.includes(
      "Could not find the 'secret_last_used_at' column of 'workflow_trigger_bindings' in the schema cache",
    ) ||
    message.includes(
      "Could not find the 'secret_rotated_at' column of 'workflow_trigger_bindings' in the schema cache",
    ) ||
    message.includes("workflow_trigger_bindings.secret_last_used_at") ||
    message.includes("workflow_trigger_bindings.secret_rotated_at")
  );
}

function normalizeTriggerBindingRow(row: Record<string, unknown>): TriggerBindingRow {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    workflow_id: String(row.workflow_id),
    workflow_version_id: String(row.workflow_version_id),
    source_type: row.source_type as TriggerBindingRow["source_type"],
    match_key: String(row.match_key),
    config_snapshot: row.config_snapshot ?? {},
    secret_hash: typeof row.secret_hash === "string" ? row.secret_hash : null,
    secret_last_four:
      typeof row.secret_last_four === "string" ? row.secret_last_four : null,
    secret_rotated_at:
      typeof row.secret_rotated_at === "string" ? row.secret_rotated_at : null,
    secret_last_used_at:
      typeof row.secret_last_used_at === "string" ? row.secret_last_used_at : null,
    is_active: Boolean(row.is_active),
    created_by: String(row.created_by),
    updated_by: String(row.updated_by),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function getClient() {
  return triggerRepositoryDeps.createSupabaseAdminClient();
}

export async function createTriggerBindingRow(params: {
  organizationId: string;
  workflowDbId: string;
  workflowVersionId: string;
  sourceType: TriggerBindingRow["source_type"];
  matchKey: string;
  configSnapshot: unknown;
  secretHash?: string | null;
  secretLastFour?: string | null;
  userId: string;
}): Promise<TriggerBindingRow> {
  const supabase = getClient();
  const baseInsert = {
    organization_id: params.organizationId,
    workflow_id: params.workflowDbId,
    workflow_version_id: params.workflowVersionId,
    source_type: params.sourceType,
    match_key: params.matchKey,
    config_snapshot: params.configSnapshot,
    secret_hash: params.secretHash ?? null,
    secret_last_four: params.secretLastFour ?? null,
    is_active: true,
    created_by: params.userId,
    updated_by: params.userId,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("workflow_trigger_bindings")
    .insert({
      ...baseInsert,
      secret_rotated_at: params.secretHash ? new Date().toISOString() : null,
      secret_last_used_at: null,
    })
    .select(TRIGGER_BINDING_SELECT)
    .single<Record<string, unknown>>();

  if (error && isMissingTriggerBindingSecurityColumnError(error.message)) {
    const legacyAttempt = await supabase
      .from("workflow_trigger_bindings")
      .insert(baseInsert)
      .select(TRIGGER_BINDING_SELECT)
      .single<Record<string, unknown>>();

    if (legacyAttempt.error || !legacyAttempt.data) {
      throw new Error(
        `Failed to create workflow trigger binding: ${legacyAttempt.error?.message ?? "Unknown error"}`,
      );
    }

    return normalizeTriggerBindingRow(legacyAttempt.data);
  }

  if (error || !data) {
    throw new Error(
      `Failed to create workflow trigger binding: ${error?.message ?? "Unknown error"}`,
    );
  }

  return normalizeTriggerBindingRow(data);
}

export async function deactivateTriggerBindingsForWorkflow(params: {
  workflowDbId: string;
  userId: string;
}): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from("workflow_trigger_bindings")
    .update({
      is_active: false,
      updated_by: params.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("workflow_id", params.workflowDbId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to deactivate trigger bindings: ${error.message}`);
  }
}

export async function deleteTriggerBindingRow(bindingId: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from("workflow_trigger_bindings")
    .delete()
    .eq("id", bindingId);

  if (error) {
    throw new Error(`Failed to delete trigger binding: ${error.message}`);
  }
}

export async function getActiveTriggerBindingByWorkflowDbId(
  workflowDbId: string,
): Promise<TriggerBindingRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_trigger_bindings")
    .select(TRIGGER_BINDING_SELECT)
    .eq("workflow_id", workflowDbId)
    .eq("is_active", true)
    .maybeSingle<Record<string, unknown>>();

  if (error) {
    throw new Error(`Failed to load workflow trigger binding: ${error.message}`);
  }

  return data ? normalizeTriggerBindingRow(data) : null;
}

export async function getActiveWebhookBindingByMatchKey(
  matchKey: string,
): Promise<TriggerBindingRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_trigger_bindings")
    .select(TRIGGER_BINDING_SELECT)
    .eq("source_type", "webhook")
    .eq("match_key", matchKey)
    .eq("is_active", true)
    .maybeSingle<Record<string, unknown>>();

  if (error) {
    throw new Error(`Failed to load webhook trigger binding: ${error.message}`);
  }

  return data ? normalizeTriggerBindingRow(data) : null;
}

export async function getActiveManualBindingByWorkflowDbId(
  workflowDbId: string,
): Promise<TriggerBindingRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_trigger_bindings")
    .select(TRIGGER_BINDING_SELECT)
    .eq("workflow_id", workflowDbId)
    .eq("source_type", "manual")
    .eq("is_active", true)
    .maybeSingle<Record<string, unknown>>();

  if (error) {
    throw new Error(`Failed to load manual trigger binding: ${error.message}`);
  }

  return data ? normalizeTriggerBindingRow(data) : null;
}

export async function listActiveInternalEventBindings(
  eventKey: string,
): Promise<TriggerBindingRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_trigger_bindings")
    .select(TRIGGER_BINDING_SELECT)
    .eq("source_type", "internal_event")
    .eq("match_key", eventKey)
    .eq("is_active", true)
    .returns<Record<string, unknown>[]>();

  if (error) {
    throw new Error(`Failed to load internal event bindings: ${error.message}`);
  }

  return (data ?? []).map(normalizeTriggerBindingRow);
}

export async function updateTriggerBindingSecret(params: {
  bindingId: string;
  secretHash: string;
  secretLastFour: string;
  userId: string;
}): Promise<TriggerBindingRow> {
  const supabase = getClient();
  const baseUpdate = {
    secret_hash: params.secretHash,
    secret_last_four: params.secretLastFour,
    updated_by: params.userId,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("workflow_trigger_bindings")
    .update({
      ...baseUpdate,
      secret_rotated_at: new Date().toISOString(),
      secret_last_used_at: null,
    })
    .eq("id", params.bindingId)
    .select(TRIGGER_BINDING_SELECT)
    .single<Record<string, unknown>>();

  if (error && isMissingTriggerBindingSecurityColumnError(error.message)) {
    const legacyAttempt = await supabase
      .from("workflow_trigger_bindings")
      .update(baseUpdate)
      .eq("id", params.bindingId)
      .select(TRIGGER_BINDING_SELECT)
      .single<Record<string, unknown>>();

    if (legacyAttempt.error || !legacyAttempt.data) {
      throw new Error(
        `Failed to rotate webhook API key: ${legacyAttempt.error?.message ?? "Unknown error"}`,
      );
    }

    return normalizeTriggerBindingRow(legacyAttempt.data);
  }

  if (error || !data) {
    throw new Error(
      `Failed to rotate webhook API key: ${error?.message ?? "Unknown error"}`,
    );
  }

  return normalizeTriggerBindingRow(data);
}

export async function markTriggerBindingSecretUsed(bindingId: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from("workflow_trigger_bindings")
    .update({
      secret_last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bindingId);

  if (error && isMissingTriggerBindingSecurityColumnError(error.message)) {
    return;
  }

  if (error) {
    throw new Error(`Failed to update webhook API key usage: ${error.message}`);
  }
}

export async function createWorkflowRunRow(params: {
  organizationId: string;
  workflowDbId: string;
  workflowVersionId: string;
  bindingId: string;
  runKey: string;
  correlationId: string;
  triggerSource: WorkflowRunRow["trigger_source"];
  sourceContext: unknown;
  payload: unknown;
  maxAttempts: number;
  idempotencyKey?: string | null;
}): Promise<WorkflowRunRow> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_runs")
    .insert({
      organization_id: params.organizationId,
      workflow_id: params.workflowDbId,
      workflow_version_id: params.workflowVersionId,
      binding_id: params.bindingId,
      run_key: params.runKey,
      correlation_id: params.correlationId,
      status: "pending",
      trigger_source: params.triggerSource,
      source_context: params.sourceContext,
      payload: params.payload,
      attempt_count: 0,
      max_attempts: params.maxAttempts,
      idempotency_key: params.idempotencyKey ?? null,
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, organization_id, workflow_id, workflow_version_id, binding_id, run_key, correlation_id, status, trigger_source, source_context, payload, idempotency_key, created_by_event_id, attempt_count, max_attempts, started_at, completed_at, cancel_requested_at, cancelled_at, last_heartbeat_at, next_retry_at, last_retry_at, failure_code, failure_message, created_at, updated_at",
    )
    .single<WorkflowRunRow>();

  if (error || !data) {
    throw new Error(
      `Failed to create workflow run: ${error?.message ?? "Unknown error"}`,
    );
  }

  return data;
}

export async function createWorkflowIngestionEventRow(params: {
  organizationId: string;
  workflowDbId: string;
  workflowVersionId: string;
  bindingId: string;
  sourceType: WorkflowIngestionEventRow["source_type"];
  matchKey: string;
  status: WorkflowIngestionEventRow["status"];
  sourceContext: unknown;
  payload: unknown;
  idempotencyKey?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  requestIp?: string | null;
  requestUserAgent?: string | null;
  triggeredByUserId?: string | null;
  runId?: string | null;
}): Promise<WorkflowIngestionEventRow> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_ingestion_events")
    .insert({
      organization_id: params.organizationId,
      workflow_id: params.workflowDbId,
      workflow_version_id: params.workflowVersionId,
      binding_id: params.bindingId,
      run_id: params.runId ?? null,
      source_type: params.sourceType,
      match_key: params.matchKey,
      status: params.status,
      source_context: params.sourceContext,
      payload: params.payload,
      idempotency_key: params.idempotencyKey ?? null,
      error_code: params.errorCode ?? null,
      error_message: params.errorMessage ?? null,
      request_ip: params.requestIp ?? null,
      request_user_agent: params.requestUserAgent ?? null,
      triggered_by_user_id: params.triggeredByUserId ?? null,
    })
    .select(
      "id, organization_id, workflow_id, workflow_version_id, binding_id, run_id, source_type, match_key, status, source_context, payload, idempotency_key, error_code, error_message, request_ip, request_user_agent, triggered_by_user_id, created_at",
    )
    .single<WorkflowIngestionEventRow>();

  if (error || !data) {
    throw new Error(
      `Failed to create workflow ingestion event: ${error?.message ?? "Unknown error"}`,
    );
  }

  return data;
}

export async function updateWorkflowRunEventLink(params: {
  eventId: string;
  runId: string;
}): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from("workflow_ingestion_events")
    .update({
      run_id: params.runId,
    })
    .eq("id", params.eventId);

  if (error) {
    throw new Error(`Failed to update workflow ingestion event: ${error.message}`);
  }
}

export async function updateWorkflowRunCreatedByEvent(params: {
  runId: string;
  eventId: string;
}): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from("workflow_runs")
    .update({
      created_by_event_id: params.eventId,
    })
    .eq("id", params.runId);

  if (error) {
    throw new Error(`Failed to update workflow run event link: ${error.message}`);
  }
}

export async function listWorkflowIngestionEventsByWorkflowDbId(params: {
  workflowDbId: string;
}): Promise<WorkflowIngestionEventRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_ingestion_events")
    .select(
      "id, organization_id, workflow_id, workflow_version_id, binding_id, run_id, source_type, match_key, status, source_context, payload, idempotency_key, error_code, error_message, request_ip, request_user_agent, triggered_by_user_id, created_at",
    )
    .eq("workflow_id", params.workflowDbId)
    .order("created_at", { ascending: false })
    .returns<WorkflowIngestionEventRow[]>();

  if (error) {
    throw new Error(`Failed to load workflow ingestion events: ${error.message}`);
  }

  return data ?? [];
}

export async function listWorkflowIngestionEventsByOrganization(
  organizationId: string,
): Promise<WorkflowIngestionEventRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_ingestion_events")
    .select(
      "id, organization_id, workflow_id, workflow_version_id, binding_id, run_id, source_type, match_key, status, source_context, payload, idempotency_key, error_code, error_message, request_ip, request_user_agent, triggered_by_user_id, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .returns<WorkflowIngestionEventRow[]>();

  if (error) {
    throw new Error(`Failed to load organization ingestion events: ${error.message}`);
  }

  return data ?? [];
}

export async function listWorkflowRowsByIds(
  workflowDbIds: string[],
): Promise<WorkflowLookupRow[]> {
  if (workflowDbIds.length === 0) {
    return [];
  }

  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflows")
    .select("id, workflow_key, name, status, category, latest_published_version_number")
    .in("id", Array.from(new Set(workflowDbIds)))
    .returns<WorkflowLookupRow[]>();

  if (error) {
    throw new Error(`Failed to load workflows for trigger events: ${error.message}`);
  }

  return data ?? [];
}

export async function listWorkflowVersionRowsByIds(
  versionDbIds: string[],
): Promise<WorkflowVersionLookupRow[]> {
  if (versionDbIds.length === 0) {
    return [];
  }

  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_versions")
    .select("id, workflow_id, version_number")
    .in("id", Array.from(new Set(versionDbIds)))
    .returns<WorkflowVersionLookupRow[]>();

  if (error) {
    throw new Error(`Failed to load workflow versions for trigger events: ${error.message}`);
  }

  return data ?? [];
}
