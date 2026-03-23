import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorkflowCanvas,
  createEmptyWorkflowDraftDocument,
  createWorkflowActionDefinition,
  syncWorkflowDraftCanvas,
} from "@/lib/server/workflows/types";
import {
  archiveWorkflow,
  createWorkflow,
  getOrCreateWorkflowDraft,
  publishWorkflow,
  updateWorkflowDraft,
  WorkflowConflictError,
  workflowServiceDeps,
} from "@/lib/server/workflows/service";
import {
  type WorkflowDraftRow,
  type WorkflowRow,
  type WorkflowVersionRow,
} from "@/lib/server/workflows/repository";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalWorkflowServiceDeps = { ...workflowServiceDeps };

test.afterEach(() => {
  restoreMutableExports(workflowServiceDeps, originalWorkflowServiceDeps);
});

function createWorkflowRow(overrides: Partial<WorkflowRow> = {}): WorkflowRow {
  return {
    id: "workflow_db_1",
    organization_id: "org_1",
    workflow_key: "WFL-1234",
    slug: "incident-triage",
    name: "Incident triage",
    description: "Routes incidents",
    category: "Operations",
    tags: ["ops"],
    status: "draft_only",
    latest_published_version_number: null,
    created_by: "user_1",
    updated_by: "user_1",
    archived_by: null,
    archived_at: null,
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createDraftRow(overrides: Partial<WorkflowDraftRow> = {}): WorkflowDraftRow {
  const baseDraft = createEmptyWorkflowDraftDocument({
    name: "Incident triage",
    description: "Routes incidents",
    category: "Operations",
    triggerType: "manual",
  });
  const action = createWorkflowActionDefinition("send_email");
  action.label = "Send email";
  action.config = {
    to: "ops@example.com",
    subject: "Workflow update",
    body: "A workflow step completed.",
    replyTo: "",
  };
  const draft = syncWorkflowDraftCanvas({
    ...baseDraft,
    config: {
      ...baseDraft.config,
      actions: [action],
    },
    canvas: buildWorkflowCanvas({
      ...baseDraft.config,
      actions: [action],
    }),
  });

  return {
    id: "draft_1",
    workflow_id: "workflow_db_1",
    organization_id: "org_1",
    metadata: draft.metadata,
    config: draft.config,
    canvas: draft.canvas,
    validation_issues: [],
    created_by: "user_1",
    updated_by: "user_1",
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createVersionRow(overrides: Partial<WorkflowVersionRow> = {}): WorkflowVersionRow {
  const draft = createDraftRow();

  return {
    id: "version_db_1",
    workflow_id: "workflow_db_1",
    organization_id: "org_1",
    version_number: 1,
    metadata: draft.metadata,
    config: draft.config,
    canvas: draft.canvas,
    validation_issues: [],
    publish_notes: null,
    published_by: "user_1",
    created_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createActorRows(userIds: string[]) {
  return Array.from(new Set(userIds)).map((userId) => ({
    id: userId,
    name: `User ${userId}`,
    email: `${userId}@example.com`,
  }));
}

test("createWorkflow rolls back the workflow row when audit logging fails", async () => {
  let deletedWorkflowId = "";

  workflowServiceDeps.workflowPublicIdExists = async () => false;
  workflowServiceDeps.createWorkflowRow = async (params) =>
    createWorkflowRow({
      workflow_key: params.workflowId,
      name: params.name,
      description: params.description,
      category: params.category,
      tags: params.tags,
      created_by: params.userId,
      updated_by: params.userId,
    });
  workflowServiceDeps.createWorkflowDraftRow = async () => createDraftRow();
  workflowServiceDeps.writeAuditLog = async () => {
    throw new Error("audit insert failed");
  };
  workflowServiceDeps.deleteWorkflowRow = async (workflowDbId) => {
    deletedWorkflowId = workflowDbId;
  };

  await assert.rejects(
    () =>
      createWorkflow({
        organizationId: "org_1",
        userId: "user_1",
        name: "Incident triage",
        category: "Operations",
      }),
    /audit insert failed/,
  );

  assert.equal(deletedWorkflowId, "workflow_db_1");
});

test("getOrCreateWorkflowDraft returns the concurrently created draft instead of surfacing a duplicate error", async () => {
  const workflow = createWorkflowRow({
    status: "published",
    latest_published_version_number: 3,
  });
  const version = createVersionRow({
    version_number: 3,
  });
  const concurrentDraft = createDraftRow({
    id: "draft_concurrent",
    updated_by: "user_2",
  });

  let draftLookupCount = 0;
  let updatedStatusPatch: Record<string, unknown> | null = null;

  workflowServiceDeps.getWorkflowRowByPublicId = async () => workflow;
  workflowServiceDeps.getWorkflowDraftRowByWorkflowDbId = async () => {
    draftLookupCount += 1;
    return draftLookupCount === 1 ? null : concurrentDraft;
  };
  workflowServiceDeps.getWorkflowVersionRow = async () => version;
  workflowServiceDeps.createWorkflowDraftRow = async () => {
    throw new Error("duplicate key value violates unique constraint");
  };
  workflowServiceDeps.isDuplicateConstraintError = (message: string) =>
    message.includes("duplicate");
  workflowServiceDeps.updateWorkflowRow = async ({ patch }) => {
    updatedStatusPatch = patch;
  };
  workflowServiceDeps.listWorkflowActorsByIds = async (userIds) =>
    createActorRows(userIds);

  const draft = await getOrCreateWorkflowDraft({
    organizationId: "org_1",
    workflowId: workflow.workflow_key,
    userId: "user_3",
  });

  assert.equal(draft.draftId, "draft_concurrent");
  assert.equal(draft.status, "published_with_draft");
  assert.deepEqual(updatedStatusPatch, {
    status: "published_with_draft",
    updated_by: "user_3",
  });
});

test("updateWorkflowDraft keeps production metadata stable while creating a published draft", async () => {
  const workflow = createWorkflowRow({
    status: "published",
    latest_published_version_number: 2,
    name: "Production workflow",
  });
  const currentDraft = createDraftRow();
  let updatedWorkflowPatch: Record<string, unknown> | null = null;
  let auditMetadata: unknown = null;

  workflowServiceDeps.getWorkflowRowByPublicId = async () => workflow;
  workflowServiceDeps.getWorkflowDraftRowByWorkflowDbId = async () => currentDraft;
  workflowServiceDeps.updateWorkflowDraftRow = async (params) =>
    createDraftRow({
      metadata: params.metadata,
      config: params.config,
      canvas: params.canvas,
      validation_issues: params.validationIssues,
      updated_by: params.userId,
    });
  workflowServiceDeps.updateWorkflowRow = async ({ patch }) => {
    updatedWorkflowPatch = patch;
  };
  workflowServiceDeps.writeAuditLog = async (params) => {
    auditMetadata = params.metadata as { workflowStatusAfter?: string };
  };
  workflowServiceDeps.listWorkflowActorsByIds = async (userIds) =>
    createActorRows(userIds);

  const draft = await updateWorkflowDraft({
    organizationId: "org_1",
    workflowId: workflow.workflow_key,
    userId: "user_2",
    input: {
      metadata: {
        name: "Draft only name",
        description: "Draft description",
        category: "Draft category",
        tags: ["draft"],
      },
    },
  });

  assert.equal(draft.workflowName, "Production workflow");
  assert.equal(draft.status, "published_with_draft");
  assert.equal(draft.draft.metadata.name, "Draft only name");
  assert.deepEqual(updatedWorkflowPatch, {
    updated_by: "user_2",
    status: "published_with_draft",
  });
  const loggedMetadata = auditMetadata as {
    workflowStatusAfter?: string;
  };
  assert.equal(loggedMetadata.workflowStatusAfter, "published_with_draft");
});

test("publishWorkflow creates an immutable snapshot and removes the editable draft", async () => {
  const workflow = createWorkflowRow({
    status: "published_with_draft",
    latest_published_version_number: 1,
  });
  const draft = createDraftRow({
    metadata: {
      name: "Published snapshot name",
      description: "Immutable description",
      category: "Operations",
      tags: ["snapshot"],
    },
  });

  let updatedWorkflowPatch: Record<string, unknown> | null = null;
  let deletedDraftWorkflowId = "";
  let auditAction = "";

  workflowServiceDeps.getWorkflowRowByPublicId = async () => workflow;
  workflowServiceDeps.getWorkflowDraftRowByWorkflowDbId = async () => draft;
  workflowServiceDeps.createWorkflowVersionRow = async (params) =>
    createVersionRow({
      version_number: params.versionNumber,
      metadata: params.metadata,
      config: params.config,
      canvas: params.canvas,
      validation_issues: params.validationIssues,
      publish_notes: params.notes,
      published_by: params.userId,
    });
  workflowServiceDeps.materializePublishedTriggerBinding = async () => ({
    binding: {
      id: "binding_1",
      organization_id: "org_1",
      workflow_id: workflow.id,
      workflow_version_id: "version_db_2",
      source_type: "manual",
      match_key: `manual:${workflow.workflow_key}`,
      config_snapshot: {
        id: "trigger_1",
        type: "manual",
        label: "Manual trigger",
        description: "",
        config: {},
      },
      secret_hash: null,
      secret_last_four: null,
      secret_rotated_at: null,
      secret_last_used_at: null,
      is_active: true,
      created_by: "user_2",
      updated_by: "user_2",
      created_at: "2026-03-23T00:00:00.000Z",
      updated_at: "2026-03-23T00:00:00.000Z",
    },
    webhookSecret: null,
  });
  workflowServiceDeps.updateWorkflowRow = async ({ patch }) => {
    updatedWorkflowPatch = patch;
  };
  workflowServiceDeps.deleteWorkflowDraftRowByWorkflowDbId = async (
    workflowDbId,
  ) => {
    deletedDraftWorkflowId = workflowDbId;
  };
  workflowServiceDeps.writeAuditLog = async (params) => {
    auditAction = params.action;
  };
  workflowServiceDeps.listWorkflowActorsByIds = async (userIds) =>
    createActorRows(userIds);

  const snapshot = await publishWorkflow({
    organizationId: "org_1",
    workflowId: workflow.workflow_key,
    userId: "user_2",
    notes: "Release note",
  });

  assert.equal(snapshot.versionNumber, 2);
  assert.equal(snapshot.metadata.name, "Published snapshot name");
  assert.equal(snapshot.notes, "Release note");
  assert.deepEqual(updatedWorkflowPatch, {
    name: "Published snapshot name",
    description: "Immutable description",
    category: "Operations",
    tags: ["snapshot"],
    status: "published",
    latest_published_version_number: 2,
    updated_by: "user_2",
  });
  assert.equal(deletedDraftWorkflowId, workflow.id);
  assert.equal(auditAction, "workflow.published");
});

test("publishWorkflow normalizes concurrent version conflicts into WorkflowConflictError", async () => {
  const workflow = createWorkflowRow({
    status: "published_with_draft",
    latest_published_version_number: 4,
  });

  workflowServiceDeps.getWorkflowRowByPublicId = async () => workflow;
  workflowServiceDeps.getWorkflowDraftRowByWorkflowDbId = async () =>
    createDraftRow();
  workflowServiceDeps.createWorkflowVersionRow = async () => {
    throw new Error("duplicate key value violates unique constraint");
  };
  workflowServiceDeps.isDuplicateConstraintError = (message: string) =>
    message.includes("duplicate");

  await assert.rejects(
    () =>
      publishWorkflow({
        organizationId: "org_1",
        workflowId: workflow.workflow_key,
        userId: "user_2",
      }),
    (error: unknown) =>
      error instanceof WorkflowConflictError &&
      error.message.includes("Another publish completed first"),
  );
});

test("archiveWorkflow clears lingering drafts, deactivates bindings, and returns archived detail", async () => {
  const workflow = createWorkflowRow({
    status: "published_with_draft",
    latest_published_version_number: 2,
  });
  const archivedWorkflow = createWorkflowRow({
    ...workflow,
    status: "archived",
    archived_at: "2026-03-24T00:00:00.000Z",
    archived_by: "user_2",
    updated_by: "user_2",
  });
  let workflowLookupCount = 0;
  const operations: string[] = [];

  workflowServiceDeps.getWorkflowRowByPublicId = async () => {
    workflowLookupCount += 1;
    return workflowLookupCount === 1 ? workflow : archivedWorkflow;
  };
  workflowServiceDeps.updateWorkflowRow = async () => {
    operations.push("workflow.update");
  };
  workflowServiceDeps.deactivateWorkflowTriggerBindings = async () => {
    operations.push("bindings.deactivate");
  };
  workflowServiceDeps.deleteWorkflowDraftRowByWorkflowDbId = async () => {
    operations.push("draft.delete");
  };
  workflowServiceDeps.writeAuditLog = async () => {
    operations.push("audit.write");
  };
  workflowServiceDeps.getWorkflowDraftRowByWorkflowDbId = async () => null;
  workflowServiceDeps.listWorkflowVersionRowsByWorkflowDbId = async () => [];
  workflowServiceDeps.listWorkflowActorsByIds = async (userIds) =>
    createActorRows(userIds);

  const detail = await archiveWorkflow({
    organizationId: "org_1",
    workflowId: workflow.workflow_key,
    userId: "user_2",
    reason: "Deprecated",
  });

  assert.equal(detail.status, "archived");
  assert.equal(detail.hasDraft, false);
  assert.deepEqual(operations, [
    "workflow.update",
    "bindings.deactivate",
    "draft.delete",
    "audit.write",
  ]);
});
