import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { WorkflowLifecycleStatus } from "@/lib/server/workflows/types";

export type WorkflowRow = {
  id: string;
  organization_id: string;
  workflow_key: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: unknown;
  status: WorkflowLifecycleStatus;
  latest_published_version_number: number | null;
  created_by: string;
  updated_by: string;
  archived_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowDraftRow = {
  id: string;
  workflow_id: string;
  organization_id: string;
  metadata: unknown;
  config: unknown;
  canvas: unknown;
  validation_issues: unknown;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type WorkflowVersionRow = {
  id: string;
  workflow_id: string;
  organization_id: string;
  version_number: number;
  metadata: unknown;
  config: unknown;
  canvas: unknown;
  validation_issues: unknown;
  publish_notes: string | null;
  published_by: string;
  created_at: string;
};

export type WorkflowActorRow = {
  id: string;
  name: string | null;
  email: string;
};

function getClient() {
  return createSupabaseAdminClient();
}

export function isDuplicateConstraintError(message: string): boolean {
  const lowered = message.toLowerCase();
  return lowered.includes("duplicate") || lowered.includes("unique");
}

export async function workflowPublicIdExists(params: {
  organizationId: string;
  workflowId: string;
}): Promise<boolean> {
  const supabase = getClient();
  const { count, error } = await supabase
    .from("workflows")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", params.organizationId)
    .eq("workflow_key", params.workflowId);

  if (error) {
    throw new Error(`Failed to check workflow id uniqueness: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

export async function listWorkflowRowsForOrganization(
  organizationId: string,
): Promise<WorkflowRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflows")
    .select(
      "id, organization_id, workflow_key, slug, name, description, category, tags, status, latest_published_version_number, created_by, updated_by, archived_by, archived_at, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .returns<WorkflowRow[]>();

  if (error) {
    throw new Error(`Failed to load workflows: ${error.message}`);
  }

  return data ?? [];
}

export async function getWorkflowRowByPublicId(params: {
  organizationId: string;
  workflowId: string;
}): Promise<WorkflowRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflows")
    .select(
      "id, organization_id, workflow_key, slug, name, description, category, tags, status, latest_published_version_number, created_by, updated_by, archived_by, archived_at, created_at, updated_at",
    )
    .eq("organization_id", params.organizationId)
    .eq("workflow_key", params.workflowId)
    .maybeSingle<WorkflowRow>();

  if (error) {
    throw new Error(`Failed to load workflow: ${error.message}`);
  }

  return data ?? null;
}

export async function createWorkflowRow(params: {
  organizationId: string;
  workflowId: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  status: WorkflowLifecycleStatus;
  userId: string;
}): Promise<WorkflowRow> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflows")
    .insert({
      organization_id: params.organizationId,
      workflow_key: params.workflowId,
      slug: params.slug,
      name: params.name,
      description: params.description,
      category: params.category,
      tags: params.tags,
      status: params.status,
      created_by: params.userId,
      updated_by: params.userId,
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, organization_id, workflow_key, slug, name, description, category, tags, status, latest_published_version_number, created_by, updated_by, archived_by, archived_at, created_at, updated_at",
    )
    .single<WorkflowRow>();

  if (error || !data) {
    throw new Error(
      `Failed to create workflow: ${error?.message ?? "Unknown error"}`,
    );
  }

  return data;
}

export async function updateWorkflowRow(params: {
  workflowDbId: string;
  patch: Record<string, unknown>;
}): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from("workflows")
    .update({
      ...params.patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.workflowDbId);

  if (error) {
    throw new Error(`Failed to update workflow: ${error.message}`);
  }
}

export async function deleteWorkflowRow(workflowDbId: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from("workflows")
    .delete()
    .eq("id", workflowDbId);

  if (error) {
    throw new Error(`Failed to delete workflow: ${error.message}`);
  }
}

export async function listWorkflowDraftRowsForOrganization(
  organizationId: string,
): Promise<WorkflowDraftRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_drafts")
    .select(
      "id, workflow_id, organization_id, metadata, config, canvas, validation_issues, created_by, updated_by, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .returns<WorkflowDraftRow[]>();

  if (error) {
    throw new Error(`Failed to load workflow drafts: ${error.message}`);
  }

  return data ?? [];
}

export async function getWorkflowDraftRowByWorkflowDbId(
  workflowDbId: string,
): Promise<WorkflowDraftRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_drafts")
    .select(
      "id, workflow_id, organization_id, metadata, config, canvas, validation_issues, created_by, updated_by, created_at, updated_at",
    )
    .eq("workflow_id", workflowDbId)
    .maybeSingle<WorkflowDraftRow>();

  if (error) {
    throw new Error(`Failed to load workflow draft: ${error.message}`);
  }

  return data ?? null;
}

export async function createWorkflowDraftRow(params: {
  workflowDbId: string;
  organizationId: string;
  metadata: unknown;
  config: unknown;
  canvas: unknown;
  validationIssues: unknown;
  userId: string;
}): Promise<WorkflowDraftRow> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_drafts")
    .insert({
      workflow_id: params.workflowDbId,
      organization_id: params.organizationId,
      metadata: params.metadata,
      config: params.config,
      canvas: params.canvas,
      validation_issues: params.validationIssues,
      created_by: params.userId,
      updated_by: params.userId,
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, workflow_id, organization_id, metadata, config, canvas, validation_issues, created_by, updated_by, created_at, updated_at",
    )
    .single<WorkflowDraftRow>();

  if (error || !data) {
    throw new Error(
      `Failed to create workflow draft: ${error?.message ?? "Unknown error"}`,
    );
  }

  return data;
}

export async function updateWorkflowDraftRow(params: {
  draftId: string;
  metadata: unknown;
  config: unknown;
  canvas: unknown;
  validationIssues: unknown;
  userId: string;
}): Promise<WorkflowDraftRow> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_drafts")
    .update({
      metadata: params.metadata,
      config: params.config,
      canvas: params.canvas,
      validation_issues: params.validationIssues,
      updated_by: params.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.draftId)
    .select(
      "id, workflow_id, organization_id, metadata, config, canvas, validation_issues, created_by, updated_by, created_at, updated_at",
    )
    .single<WorkflowDraftRow>();

  if (error || !data) {
    throw new Error(
      `Failed to update workflow draft: ${error?.message ?? "Unknown error"}`,
    );
  }

  return data;
}

export async function deleteWorkflowDraftRowByWorkflowDbId(
  workflowDbId: string,
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from("workflow_drafts")
    .delete()
    .eq("workflow_id", workflowDbId);

  if (error) {
    throw new Error(`Failed to delete workflow draft: ${error.message}`);
  }
}

export async function listWorkflowVersionRowsByWorkflowDbId(
  workflowDbId: string,
): Promise<WorkflowVersionRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_versions")
    .select(
      "id, workflow_id, organization_id, version_number, metadata, config, canvas, validation_issues, publish_notes, published_by, created_at",
    )
    .eq("workflow_id", workflowDbId)
    .order("version_number", { ascending: false })
    .returns<WorkflowVersionRow[]>();

  if (error) {
    throw new Error(`Failed to load workflow versions: ${error.message}`);
  }

  return data ?? [];
}

export async function getWorkflowVersionRow(params: {
  workflowDbId: string;
  versionNumber: number;
}): Promise<WorkflowVersionRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_versions")
    .select(
      "id, workflow_id, organization_id, version_number, metadata, config, canvas, validation_issues, publish_notes, published_by, created_at",
    )
    .eq("workflow_id", params.workflowDbId)
    .eq("version_number", params.versionNumber)
    .maybeSingle<WorkflowVersionRow>();

  if (error) {
    throw new Error(`Failed to load workflow version: ${error.message}`);
  }

  return data ?? null;
}

export async function createWorkflowVersionRow(params: {
  workflowDbId: string;
  organizationId: string;
  versionNumber: number;
  metadata: unknown;
  config: unknown;
  canvas: unknown;
  validationIssues: unknown;
  notes: string | null;
  userId: string;
}): Promise<WorkflowVersionRow> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workflow_versions")
    .insert({
      workflow_id: params.workflowDbId,
      organization_id: params.organizationId,
      version_number: params.versionNumber,
      metadata: params.metadata,
      config: params.config,
      canvas: params.canvas,
      validation_issues: params.validationIssues,
      publish_notes: params.notes,
      published_by: params.userId,
    })
    .select(
      "id, workflow_id, organization_id, version_number, metadata, config, canvas, validation_issues, publish_notes, published_by, created_at",
    )
    .single<WorkflowVersionRow>();

  if (error || !data) {
    throw new Error(
      `Failed to create workflow version: ${error?.message ?? "Unknown error"}`,
    );
  }

  return data;
}

export async function deleteWorkflowVersionRow(params: {
  workflowDbId: string;
  versionNumber: number;
}): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from("workflow_versions")
    .delete()
    .eq("workflow_id", params.workflowDbId)
    .eq("version_number", params.versionNumber);

  if (error) {
    throw new Error(`Failed to delete workflow version: ${error.message}`);
  }
}

export async function listWorkflowActorsByIds(
  userIds: string[],
): Promise<WorkflowActorRow[]> {
  if (userIds.length === 0) {
    return [];
  }

  const supabase = getClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email")
    .in("id", Array.from(new Set(userIds)))
    .returns<WorkflowActorRow[]>();

  if (error) {
    throw new Error(`Failed to load workflow actors: ${error.message}`);
  }

  return data ?? [];
}
