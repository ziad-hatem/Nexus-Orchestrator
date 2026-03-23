import { writeAuditLog } from "@/lib/server/audit-log";
import {
  deactivateWorkflowTriggerBindings,
  materializePublishedTriggerBinding,
} from "@/lib/server/triggers/service";
import { deleteTriggerBindingRow } from "@/lib/server/triggers/repository";
import { normalizeOrgSlug } from "@/lib/server/validation";
import {
  type SupportedWorkflowTriggerType,
  type ValidationIssue,
  type WorkflowActor,
  type WorkflowDetail,
  type WorkflowDraftDocument,
  type WorkflowDraftState,
  type WorkflowLifecycleStatus,
  type WorkflowPublishedSnapshot,
  type WorkflowSummary,
  type WorkflowVersionSummary,
  createEmptyWorkflowDraftDocument,
  createWorkflowPublicId,
  getWorkflowVersionLabel,
  normalizeValidationIssues,
  normalizeWorkflowDraftDocument,
  normalizeWorkflowTags,
  syncWorkflowDraftCanvas,
} from "@/lib/server/workflows/types";
import { validateWorkflowDraftDocument } from "@/lib/server/workflows/validation";
import {
  createWorkflowDraftRow,
  createWorkflowRow,
  createWorkflowVersionRow,
  deleteWorkflowDraftRowByWorkflowDbId,
  deleteWorkflowRow,
  deleteWorkflowVersionRow,
  getWorkflowDraftRowByWorkflowDbId,
  getWorkflowRowByPublicId,
  getWorkflowVersionRow,
  isDuplicateConstraintError,
  listWorkflowActorsByIds,
  listWorkflowDraftRowsForOrganization,
  listWorkflowRowsForOrganization,
  listWorkflowVersionRowsByWorkflowDbId,
  updateWorkflowDraftRow,
  updateWorkflowRow,
  workflowPublicIdExists,
  type WorkflowActorRow,
  type WorkflowDraftRow,
  type WorkflowRow,
  type WorkflowVersionRow,
} from "@/lib/server/workflows/repository";

export const workflowServiceDeps = {
  writeAuditLog,
  materializePublishedTriggerBinding,
  deactivateWorkflowTriggerBindings,
  deleteTriggerBindingRow,
  createWorkflowDraftRow,
  createWorkflowRow,
  createWorkflowVersionRow,
  deleteWorkflowDraftRowByWorkflowDbId,
  deleteWorkflowRow,
  deleteWorkflowVersionRow,
  getWorkflowDraftRowByWorkflowDbId,
  getWorkflowRowByPublicId,
  getWorkflowVersionRow,
  isDuplicateConstraintError,
  listWorkflowActorsByIds,
  listWorkflowDraftRowsForOrganization,
  listWorkflowRowsForOrganization,
  listWorkflowVersionRowsByWorkflowDbId,
  updateWorkflowDraftRow,
  updateWorkflowRow,
  workflowPublicIdExists,
};

export class WorkflowNotFoundError extends Error {
  constructor() {
    super("Workflow not found");
  }
}

export class WorkflowConflictError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class WorkflowValidationError extends Error {
  issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("Workflow validation failed");
    this.issues = issues;
  }
}

export type WorkflowListFilters = {
  query?: string;
  status?: WorkflowLifecycleStatus;
  category?: string;
  page: number;
  pageSize: number;
};

export type UpdateWorkflowDraftInput = {
  metadata?: Partial<WorkflowDraftDocument["metadata"]>;
  config?: Partial<WorkflowDraftDocument["config"]>;
  canvas?: WorkflowDraftDocument["canvas"];
};

function mapActors(rows: WorkflowActorRow[]): Map<string, WorkflowActor> {
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        email: row.email,
      } satisfies WorkflowActor,
    ]),
  );
}

async function getActorMap(userIds: string[]): Promise<Map<string, WorkflowActor>> {
  return mapActors(await workflowServiceDeps.listWorkflowActorsByIds(userIds));
}

function workflowMatchesQuery(
  workflow: WorkflowSummary,
  query: string,
): boolean {
  const lowered = query.toLowerCase();
  return [
    workflow.workflowId,
    workflow.name,
    workflow.description,
    workflow.category,
    workflow.tags.join(" "),
  ].some((candidate) => candidate.toLowerCase().includes(lowered));
}

function mapWorkflowSummary(params: {
  workflow: WorkflowRow;
  actors: Map<string, WorkflowActor>;
  hasDraft: boolean;
}): WorkflowSummary {
  return {
    workflowId: params.workflow.workflow_key,
    slug: params.workflow.slug,
    name: params.workflow.name,
    description: params.workflow.description,
    category: params.workflow.category,
    tags: normalizeWorkflowTags(params.workflow.tags),
    status: params.workflow.status,
    latestVersionNumber: params.workflow.latest_published_version_number,
    hasDraft: params.hasDraft,
    lastModifiedAt: params.workflow.updated_at,
    modifiedBy: params.actors.get(params.workflow.updated_by) ?? null,
    archivedAt: params.workflow.archived_at,
  };
}

function toDraftDocument(params: {
  metadata: unknown;
  config: unknown;
  canvas: unknown;
}): WorkflowDraftDocument {
  return normalizeWorkflowDraftDocument({
    metadata: params.metadata,
    config: params.config,
    canvas: params.canvas,
  });
}

function mapPublishedSnapshot(params: {
  version: WorkflowVersionRow;
  actors: Map<string, WorkflowActor>;
}): WorkflowPublishedSnapshot {
  const snapshot = toDraftDocument({
    metadata: params.version.metadata,
    config: params.version.config,
    canvas: params.version.canvas,
  });

  return {
    versionNumber: params.version.version_number,
    metadata: snapshot.metadata,
    config: snapshot.config,
    canvas: snapshot.canvas,
    notes: params.version.publish_notes,
    validationIssues: normalizeValidationIssues(params.version.validation_issues),
    publishedAt: params.version.created_at,
    publishedBy: params.actors.get(params.version.published_by) ?? null,
  };
}

function mapDraftState(params: {
  workflow: WorkflowRow;
  draft: WorkflowDraftRow;
  actors: Map<string, WorkflowActor>;
}): WorkflowDraftState {
  return {
    workflowId: params.workflow.workflow_key,
    workflowName: params.workflow.name,
    status: params.workflow.status,
    latestVersionNumber: params.workflow.latest_published_version_number,
    draftId: params.draft.id,
    draft: toDraftDocument({
      metadata: params.draft.metadata,
      config: params.draft.config,
      canvas: params.draft.canvas,
    }),
    validationIssues: normalizeValidationIssues(params.draft.validation_issues),
    updatedAt: params.draft.updated_at,
    updatedBy: params.actors.get(params.draft.updated_by) ?? null,
    isArchived: params.workflow.status === "archived",
  };
}

async function loadWorkflowOrThrow(params: {
  organizationId: string;
  workflowId: string;
}): Promise<WorkflowRow> {
  const workflow = await workflowServiceDeps.getWorkflowRowByPublicId(params);
  if (!workflow) {
    throw new WorkflowNotFoundError();
  }

  return workflow;
}

async function reserveWorkflowPublicId(
  organizationId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const workflowId = createWorkflowPublicId();
    const exists = await workflowServiceDeps.workflowPublicIdExists({
      organizationId,
      workflowId,
    });

    if (!exists) {
      return workflowId;
    }
  }

  throw new WorkflowConflictError("Failed to reserve a unique workflow id.");
}

async function createUniqueWorkflowRow(params: {
  organizationId: string;
  workflowId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  userId: string;
}): Promise<WorkflowRow> {
  const baseSlug = normalizeOrgSlug(params.name);

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

    try {
      return await workflowServiceDeps.createWorkflowRow({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        slug,
        name: params.name,
        description: params.description,
        category: params.category,
        tags: params.tags,
        status: "draft_only",
        userId: params.userId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (!workflowServiceDeps.isDuplicateConstraintError(message)) {
        throw error;
      }
    }
  }

  throw new WorkflowConflictError("Failed to reserve a unique workflow slug.");
}

export async function listWorkflows(params: {
  organizationId: string;
  filters: WorkflowListFilters;
}): Promise<{
  workflows: WorkflowSummary[];
  total: number;
  categories: string[];
  page: number;
  pageSize: number;
}> {
  const [workflowRows, draftRows] = await Promise.all([
    workflowServiceDeps.listWorkflowRowsForOrganization(params.organizationId),
    workflowServiceDeps.listWorkflowDraftRowsForOrganization(
      params.organizationId,
    ),
  ]);

  const draftWorkflowIds = new Set(draftRows.map((draft) => draft.workflow_id));
  const actors = await getActorMap(workflowRows.map((workflow) => workflow.updated_by));

  let workflows = workflowRows.map((workflow) =>
    mapWorkflowSummary({
      workflow,
      actors,
      hasDraft: draftWorkflowIds.has(workflow.id),
    }),
  );

  const categories = Array.from(
    new Set(workflows.map((workflow) => workflow.category).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));

  if (params.filters.status) {
    workflows = workflows.filter(
      (workflow) => workflow.status === params.filters.status,
    );
  }

  if (params.filters.category) {
    workflows = workflows.filter(
      (workflow) =>
        workflow.category.toLowerCase() ===
        params.filters.category?.trim().toLowerCase(),
    );
  }

  if (params.filters.query) {
    workflows = workflows.filter((workflow) =>
      workflowMatchesQuery(workflow, params.filters.query ?? ""),
    );
  }

  const total = workflows.length;
  const page = Math.max(1, params.filters.page);
  const pageSize = Math.max(1, Math.min(params.filters.pageSize, 50));
  const start = (page - 1) * pageSize;

  return {
    workflows: workflows.slice(start, start + pageSize),
    total,
    categories,
    page,
    pageSize,
  };
}

export async function createWorkflow(params: {
  organizationId: string;
  userId: string;
  name: string;
  description?: string;
  category: string;
  tags?: string[];
  triggerType?: SupportedWorkflowTriggerType;
  request?: Request | null;
}): Promise<WorkflowDraftState> {
  const workflowId = await reserveWorkflowPublicId(params.organizationId);
  const draft = createEmptyWorkflowDraftDocument({
    name: params.name,
    description: params.description,
    category: params.category,
    tags: params.tags,
    triggerType: params.triggerType,
  });
  const validationIssues = validateWorkflowDraftDocument(draft);

  const workflow = await createUniqueWorkflowRow({
    organizationId: params.organizationId,
    workflowId,
    name: draft.metadata.name,
    description: draft.metadata.description,
    category: draft.metadata.category,
    tags: draft.metadata.tags,
    userId: params.userId,
  });

  try {
    const draftRow = await workflowServiceDeps.createWorkflowDraftRow({
      workflowDbId: workflow.id,
      organizationId: params.organizationId,
      metadata: draft.metadata,
      config: draft.config,
      canvas: draft.canvas,
      validationIssues,
      userId: params.userId,
    });

    await workflowServiceDeps.writeAuditLog({
      organizationId: params.organizationId,
      actorUserId: params.userId,
      action: "workflow.created",
      entityType: "workflow",
      entityId: workflow.workflow_key,
      metadata: {
        workflowId: workflow.workflow_key,
        workflowName: workflow.name,
        workflowStatus: workflow.status,
      },
      request: params.request,
    });

    const actors = await getActorMap([params.userId]);
    return mapDraftState({
      workflow,
      draft: draftRow,
      actors,
    });
  } catch (error) {
    await workflowServiceDeps.deleteWorkflowRow(workflow.id).catch(
      () => undefined,
    );
    throw error;
  }
}

export async function getWorkflowDetail(params: {
  organizationId: string;
  workflowId: string;
}): Promise<WorkflowDetail> {
  const workflow = await loadWorkflowOrThrow(params);
  const [draft, versionRows] = await Promise.all([
    workflowServiceDeps.getWorkflowDraftRowByWorkflowDbId(workflow.id),
    workflowServiceDeps.listWorkflowVersionRowsByWorkflowDbId(workflow.id),
  ]);

  const latestVersion =
    workflow.latest_published_version_number === null
      ? null
      : versionRows.find(
          (version) =>
            version.version_number === workflow.latest_published_version_number,
        ) ?? null;

  const actorIds = [
    workflow.created_by,
    workflow.updated_by,
    draft?.updated_by ?? null,
    latestVersion?.published_by ?? null,
  ].filter((candidate): candidate is string => Boolean(candidate));
  const actors = await getActorMap(actorIds);

  return {
    ...mapWorkflowSummary({
      workflow,
      actors,
      hasDraft: Boolean(draft),
    }),
    createdAt: workflow.created_at,
    createdBy: actors.get(workflow.created_by) ?? null,
    versionCount: versionRows.length,
    draftUpdatedAt: draft?.updated_at ?? null,
    draftUpdatedBy: draft?.updated_by
      ? actors.get(draft.updated_by) ?? null
      : null,
    validationIssues: draft
      ? normalizeValidationIssues(draft.validation_issues)
      : [],
    latestPublishedSnapshot: latestVersion
      ? mapPublishedSnapshot({
          version: latestVersion,
          actors,
        })
      : null,
  };
}

export async function getOrCreateWorkflowDraft(params: {
  organizationId: string;
  workflowId: string;
  userId: string;
}): Promise<WorkflowDraftState> {
  const workflow = await loadWorkflowOrThrow(params);
  if (workflow.status === "archived") {
    throw new WorkflowConflictError(
      "Archived workflows cannot be edited. Unarchive is not available in this phase.",
    );
  }

  const existingDraft = await workflowServiceDeps.getWorkflowDraftRowByWorkflowDbId(
    workflow.id,
  );
  if (existingDraft) {
    const actors = await getActorMap([existingDraft.updated_by]);
    return mapDraftState({
      workflow,
      draft: existingDraft,
      actors,
    });
  }

  const latestVersionNumber = workflow.latest_published_version_number;
  const latestVersion =
    latestVersionNumber === null
      ? null
      : await workflowServiceDeps.getWorkflowVersionRow({
          workflowDbId: workflow.id,
          versionNumber: latestVersionNumber,
        });

  const nextDraftDocument = latestVersion
    ? toDraftDocument({
        metadata: latestVersion.metadata,
        config: latestVersion.config,
        canvas: latestVersion.canvas,
      })
    : createEmptyWorkflowDraftDocument({
        name: workflow.name,
        description: workflow.description,
        category: workflow.category,
        tags: normalizeWorkflowTags(workflow.tags),
      });

  const validationIssues = validateWorkflowDraftDocument(nextDraftDocument);
  let draft: WorkflowDraftRow;
  try {
    draft = await workflowServiceDeps.createWorkflowDraftRow({
      workflowDbId: workflow.id,
      organizationId: params.organizationId,
      metadata: nextDraftDocument.metadata,
      config: nextDraftDocument.config,
      canvas: nextDraftDocument.canvas,
      validationIssues,
      userId: params.userId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (!workflowServiceDeps.isDuplicateConstraintError(message)) {
      throw error;
    }

    const currentWorkflow = await loadWorkflowOrThrow({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
    });
    if (currentWorkflow.status === "archived") {
      throw new WorkflowConflictError(
        "Archived workflows cannot be edited. Unarchive is not available in this phase.",
      );
    }

    const concurrentDraft =
      await workflowServiceDeps.getWorkflowDraftRowByWorkflowDbId(workflow.id);
    if (!concurrentDraft) {
      throw error;
    }

    const concurrentStatus =
      currentWorkflow.latest_published_version_number === null
        ? "draft_only"
        : "published_with_draft";
    if (currentWorkflow.status === "published") {
      await workflowServiceDeps.updateWorkflowRow({
        workflowDbId: workflow.id,
        patch: {
          status: concurrentStatus,
          updated_by: params.userId,
        },
      });
    }

    const actors = await getActorMap([concurrentDraft.updated_by]);
    return mapDraftState({
      workflow: {
        ...currentWorkflow,
        status:
          currentWorkflow.status === "published"
            ? concurrentStatus
            : currentWorkflow.status,
        updated_by: params.userId,
      },
      draft: concurrentDraft,
      actors,
    });
  }

  const nextStatus =
    workflow.latest_published_version_number === null
      ? "draft_only"
      : "published_with_draft";
  await workflowServiceDeps.updateWorkflowRow({
    workflowDbId: workflow.id,
    patch: {
      status: nextStatus,
      updated_by: params.userId,
    },
  });

  const actors = await getActorMap([params.userId]);
  return mapDraftState({
    workflow: {
      ...workflow,
      status: nextStatus,
      updated_by: params.userId,
    },
    draft,
    actors,
  });
}

export async function updateWorkflowDraft(params: {
  organizationId: string;
  workflowId: string;
  userId: string;
  input: UpdateWorkflowDraftInput;
  request?: Request | null;
}): Promise<WorkflowDraftState> {
  const current = await getOrCreateWorkflowDraft({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    userId: params.userId,
  });
  const workflow = await loadWorkflowOrThrow({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  });

  const nextDraft = syncWorkflowDraftCanvas({
    metadata: params.input.metadata
      ? {
          ...current.draft.metadata,
          ...params.input.metadata,
          tags:
            params.input.metadata.tags === undefined
              ? current.draft.metadata.tags
              : normalizeWorkflowTags(params.input.metadata.tags),
        }
      : current.draft.metadata,
    config: params.input.config
      ? {
          trigger:
            params.input.config.trigger === undefined
              ? current.draft.config.trigger
              : params.input.config.trigger,
          conditions:
            params.input.config.conditions ?? current.draft.config.conditions,
          actions: params.input.config.actions ?? current.draft.config.actions,
        }
      : current.draft.config,
    canvas: params.input.canvas ?? current.draft.canvas,
  });
  const validationIssues = validateWorkflowDraftDocument(nextDraft);

  const updatedDraftRow = await workflowServiceDeps.updateWorkflowDraftRow({
    draftId: current.draftId,
    metadata: nextDraft.metadata,
    config: nextDraft.config,
    canvas: nextDraft.canvas,
    validationIssues,
    userId: params.userId,
  });

  const workflowPatch: Record<string, unknown> = {
    updated_by: params.userId,
  };

  if (workflow.status === "draft_only") {
    workflowPatch.name = nextDraft.metadata.name;
    workflowPatch.description = nextDraft.metadata.description;
    workflowPatch.category = nextDraft.metadata.category;
    workflowPatch.tags = nextDraft.metadata.tags;
  } else if (workflow.status === "published") {
    workflowPatch.status = "published_with_draft";
  }

  await workflowServiceDeps.updateWorkflowRow({
    workflowDbId: workflow.id,
    patch: workflowPatch,
  });

  await workflowServiceDeps.writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    action: "workflow.draft_updated",
    entityType: "workflow",
    entityId: params.workflowId,
    metadata: {
      workflowId: params.workflowId,
      workflowStatusBefore: workflow.status,
      workflowStatusAfter:
        workflow.status === "published"
      ? "published_with_draft"
      : workflow.status,
      validationIssueCount: validationIssues.length,
    },
    request: params.request,
  });

  const nextStatus =
    workflow.status === "published" ? "published_with_draft" : workflow.status;
  const actors = await getActorMap([params.userId]);

  return mapDraftState({
    workflow: {
      ...workflow,
      name:
        workflow.status === "draft_only" ? nextDraft.metadata.name : workflow.name,
      description:
        workflow.status === "draft_only"
          ? nextDraft.metadata.description
          : workflow.description,
      category:
        workflow.status === "draft_only"
          ? nextDraft.metadata.category
          : workflow.category,
      tags:
        workflow.status === "draft_only"
          ? nextDraft.metadata.tags
          : workflow.tags,
      status: nextStatus,
      updated_by: params.userId,
    },
    draft: updatedDraftRow,
    actors,
  });
}

export async function publishWorkflow(params: {
  organizationId: string;
  workflowId: string;
  userId: string;
  notes?: string | null;
  request?: Request | null;
}): Promise<WorkflowPublishedSnapshot> {
  const workflow = await loadWorkflowOrThrow({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  });

  if (workflow.status === "archived") {
    throw new WorkflowConflictError("Archived workflows cannot be published.");
  }

  const draft = await workflowServiceDeps.getWorkflowDraftRowByWorkflowDbId(
    workflow.id,
  );
  if (!draft) {
    throw new WorkflowConflictError(
      "Create or load a draft before publishing a workflow.",
    );
  }

  const draftDocument = toDraftDocument({
    metadata: draft.metadata,
    config: draft.config,
    canvas: draft.canvas,
  });
  const validationIssues = validateWorkflowDraftDocument(draftDocument);
  if (validationIssues.some((issue) => issue.severity === "error")) {
    throw new WorkflowValidationError(validationIssues);
  }

  const nextVersionNumber = (workflow.latest_published_version_number ?? 0) + 1;
  let version: WorkflowVersionRow;
  try {
    version = await workflowServiceDeps.createWorkflowVersionRow({
      workflowDbId: workflow.id,
      organizationId: params.organizationId,
      versionNumber: nextVersionNumber,
      metadata: draftDocument.metadata,
      config: draftDocument.config,
      canvas: draftDocument.canvas,
      validationIssues,
      notes: params.notes?.trim() || null,
      userId: params.userId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (workflowServiceDeps.isDuplicateConstraintError(message)) {
      throw new WorkflowConflictError(
        "Another publish completed first. Refresh the workflow and review the latest version.",
      );
    }

    throw error;
  }
  let createdBindingId: string | null = null;

  try {
    if (!draftDocument.config.trigger) {
      throw new WorkflowConflictError(
        "Workflow drafts must include a trigger before publishing.",
      );
    }

    const binding = await workflowServiceDeps.materializePublishedTriggerBinding(
      {
        organizationId: params.organizationId,
        workflow,
        version,
        trigger: draftDocument.config.trigger,
        userId: params.userId,
        request: params.request,
      },
    );
    createdBindingId = binding.binding.id;

    await workflowServiceDeps.updateWorkflowRow({
      workflowDbId: workflow.id,
      patch: {
        name: draftDocument.metadata.name,
        description: draftDocument.metadata.description,
        category: draftDocument.metadata.category,
        tags: draftDocument.metadata.tags,
        status: "published",
        latest_published_version_number: nextVersionNumber,
        updated_by: params.userId,
      },
    });
    await workflowServiceDeps.deleteWorkflowDraftRowByWorkflowDbId(workflow.id);
  } catch (error) {
    if (createdBindingId) {
      await workflowServiceDeps.deleteTriggerBindingRow(createdBindingId).catch(
        () => undefined,
      );
    }
    await workflowServiceDeps.deleteWorkflowVersionRow({
      workflowDbId: workflow.id,
      versionNumber: nextVersionNumber,
    }).catch(() => undefined);
    throw error;
  }

  await workflowServiceDeps.writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    action: "workflow.published",
    entityType: "workflow",
    entityId: params.workflowId,
    metadata: {
      workflowId: params.workflowId,
      version: getWorkflowVersionLabel(nextVersionNumber),
      validationIssueCount: validationIssues.length,
    },
    request: params.request,
  });

  const actors = await getActorMap([params.userId]);
  return mapPublishedSnapshot({
    version,
    actors,
  });
}

export async function archiveWorkflow(params: {
  organizationId: string;
  workflowId: string;
  userId: string;
  reason?: string | null;
  request?: Request | null;
}): Promise<WorkflowDetail> {
  const workflow = await loadWorkflowOrThrow({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  });

  if (workflow.status === "archived") {
    throw new WorkflowConflictError("Workflow is already archived.");
  }

  await workflowServiceDeps.updateWorkflowRow({
    workflowDbId: workflow.id,
    patch: {
      status: "archived",
      archived_at: new Date().toISOString(),
      archived_by: params.userId,
      updated_by: params.userId,
    },
  });
  await workflowServiceDeps.deactivateWorkflowTriggerBindings({
    workflowDbId: workflow.id,
    userId: params.userId,
  });
  await workflowServiceDeps.deleteWorkflowDraftRowByWorkflowDbId(
    workflow.id,
  ).catch(() => undefined);

  await workflowServiceDeps.writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    action: "workflow.archived",
    entityType: "workflow",
    entityId: params.workflowId,
    metadata: {
      workflowId: params.workflowId,
      workflowName: workflow.name,
      reason: params.reason?.trim() || null,
    },
    request: params.request,
  });

  return getWorkflowDetail({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  });
}

export async function listWorkflowVersions(params: {
  organizationId: string;
  workflowId: string;
}): Promise<WorkflowVersionSummary[]> {
  const workflow = await loadWorkflowOrThrow(params);
  const versions = await workflowServiceDeps.listWorkflowVersionRowsByWorkflowDbId(
    workflow.id,
  );
  const actors = await getActorMap(versions.map((version) => version.published_by));

  return versions.map((version) => ({
    workflowId: workflow.workflow_key,
    versionNumber: version.version_number,
    createdAt: version.created_at,
    publishedBy: actors.get(version.published_by) ?? null,
    notes: version.publish_notes,
    validationIssueCount: normalizeValidationIssues(version.validation_issues)
      .length,
    isCurrent:
      workflow.latest_published_version_number === version.version_number,
  }));
}

export async function getWorkflowVersionSnapshot(params: {
  organizationId: string;
  workflowId: string;
  versionNumber: number;
}): Promise<WorkflowPublishedSnapshot> {
  const workflow = await loadWorkflowOrThrow({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  });
  const version = await workflowServiceDeps.getWorkflowVersionRow({
    workflowDbId: workflow.id,
    versionNumber: params.versionNumber,
  });

  if (!version) {
    throw new WorkflowNotFoundError();
  }

  const actors = await getActorMap([version.published_by]);
  return mapPublishedSnapshot({
    version,
    actors,
  });
}
