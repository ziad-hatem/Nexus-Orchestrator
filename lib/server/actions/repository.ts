import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeEmail } from "@/lib/server/validation";

export type WorkflowTaskRow = {
  id: string;
  organization_id: string;
  workflow_id: string;
  workflow_version_id: string;
  run_id: string;
  step_id: string;
  title: string;
  description: string | null;
  status: string;
  assignee_user_id: string | null;
  assignee_email: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowRecordRow = {
  id: string;
  organization_id: string;
  record_type: string;
  record_key: string;
  fields: unknown;
  created_by_workflow_id: string | null;
  created_by_workflow_version_id: string | null;
  created_by_run_id: string | null;
  created_by_step_id: string | null;
  updated_by_workflow_id: string | null;
  updated_by_workflow_version_id: string | null;
  updated_by_run_id: string | null;
  updated_by_step_id: string | null;
  created_at: string;
  updated_at: string;
};

type WorkflowUserRow = {
  id: string;
  email: string;
};

type MembershipLookupRow = {
  id: string;
  user_id: string;
  status: "active" | "suspended" | null;
};

function getClient() {
  return createSupabaseAdminClient();
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export async function resolveActiveAssigneeByEmail(params: {
  organizationId: string;
  email: string;
}): Promise<{ userId: string; email: string } | null> {
  const normalizedEmail = normalizeEmail(params.email);
  if (!normalizedEmail) {
    return null;
  }

  const supabase = getClient();
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email")
    .eq("email", normalizedEmail)
    .returns<WorkflowUserRow[]>();

  if (usersError) {
    throw new Error(`Failed to resolve task assignee: ${usersError.message}`);
  }

  const user = users?.[0];
  if (!user) {
    return null;
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("id, user_id, status")
    .eq("organization_id", params.organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .returns<MembershipLookupRow[]>();

  if (membershipError) {
    throw new Error(
      `Failed to validate task assignee membership: ${membershipError.message}`,
    );
  }

  if (!memberships?.length) {
    return null;
  }

  return {
    userId: user.id,
    email: normalizedEmail,
  };
}

export async function createWorkflowTaskRow(params: {
  organizationId: string;
  workflowId: string;
  workflowVersionId: string;
  runId: string;
  stepId: string;
  title: string;
  description?: string | null;
  assigneeUserId?: string | null;
  assigneeEmail?: string | null;
  dueAt?: string | null;
}): Promise<WorkflowTaskRow> {
  const supabase = getClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("workflow_tasks")
    .insert({
      organization_id: params.organizationId,
      workflow_id: params.workflowId,
      workflow_version_id: params.workflowVersionId,
      run_id: params.runId,
      step_id: params.stepId,
      title: params.title,
      description: params.description ?? null,
      status: "open",
      assignee_user_id: params.assigneeUserId ?? null,
      assignee_email: params.assigneeEmail ?? null,
      due_at: params.dueAt ?? null,
      updated_at: now,
    })
    .select(
      "id, organization_id, workflow_id, workflow_version_id, run_id, step_id, title, description, status, assignee_user_id, assignee_email, due_at, created_at, updated_at",
    )
    .single<WorkflowTaskRow>();

  if (error || !data) {
    throw new Error(
      `Failed to create workflow task: ${error?.message ?? "Unknown error"}`,
    );
  }

  return data;
}

async function getWorkflowRecordRow(params: {
  organizationId: string;
  recordType: string;
  recordKey: string;
}): Promise<WorkflowRecordRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_records")
    .select(
      "id, organization_id, record_type, record_key, fields, created_by_workflow_id, created_by_workflow_version_id, created_by_run_id, created_by_step_id, updated_by_workflow_id, updated_by_workflow_version_id, updated_by_run_id, updated_by_step_id, created_at, updated_at",
    )
    .eq("organization_id", params.organizationId)
    .eq("record_type", params.recordType)
    .eq("record_key", params.recordKey)
    .maybeSingle<WorkflowRecordRow>();

  if (error) {
    throw new Error(`Failed to load workflow record: ${error.message}`);
  }

  return data ?? null;
}

export async function upsertWorkflowRecordField(params: {
  organizationId: string;
  workflowId: string;
  workflowVersionId: string;
  runId: string;
  stepId: string;
  recordType: string;
  recordKey: string;
  field: string;
  value: unknown;
}): Promise<WorkflowRecordRow> {
  const supabase = getClient();
  const now = new Date().toISOString();
  const existing = await getWorkflowRecordRow({
    organizationId: params.organizationId,
    recordType: params.recordType,
    recordKey: params.recordKey,
  });

  const nextFields = {
    ...toRecord(existing?.fields),
    [params.field]: params.value,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("workflow_records")
      .update({
        fields: nextFields,
        updated_by_workflow_id: params.workflowId,
        updated_by_workflow_version_id: params.workflowVersionId,
        updated_by_run_id: params.runId,
        updated_by_step_id: params.stepId,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select(
        "id, organization_id, record_type, record_key, fields, created_by_workflow_id, created_by_workflow_version_id, created_by_run_id, created_by_step_id, updated_by_workflow_id, updated_by_workflow_version_id, updated_by_run_id, updated_by_step_id, created_at, updated_at",
      )
      .single<WorkflowRecordRow>();

    if (error || !data) {
      throw new Error(
        `Failed to update workflow record: ${error?.message ?? "Unknown error"}`,
      );
    }

    return data;
  }

  const { data, error } = await supabase
    .from("workflow_records")
    .insert({
      organization_id: params.organizationId,
      record_type: params.recordType,
      record_key: params.recordKey,
      fields: nextFields,
      created_by_workflow_id: params.workflowId,
      created_by_workflow_version_id: params.workflowVersionId,
      created_by_run_id: params.runId,
      created_by_step_id: params.stepId,
      updated_by_workflow_id: params.workflowId,
      updated_by_workflow_version_id: params.workflowVersionId,
      updated_by_run_id: params.runId,
      updated_by_step_id: params.stepId,
      updated_at: now,
    })
    .select(
      "id, organization_id, record_type, record_key, fields, created_by_workflow_id, created_by_workflow_version_id, created_by_run_id, created_by_step_id, updated_by_workflow_id, updated_by_workflow_version_id, updated_by_run_id, updated_by_step_id, created_at, updated_at",
    )
    .single<WorkflowRecordRow>();

  if (error || !data) {
    throw new Error(
      `Failed to create workflow record: ${error?.message ?? "Unknown error"}`,
    );
  }

  return data;
}
