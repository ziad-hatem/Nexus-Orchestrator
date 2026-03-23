"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, History, Loader2, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormStatusMessage } from "@/app/components/a11y/form-status-message";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { WorkflowFlowEditor } from "@/app/components/workflows/workflow-flow-editor";
import { WorkflowNodeInspector } from "@/app/components/workflows/workflow-node-inspector";
import { WorkflowPublishDialog } from "@/app/components/workflows/workflow-publish-dialog";
import { WorkflowToolbar } from "@/app/components/workflows/workflow-toolbar";
import { WorkflowValidationPanel } from "@/app/components/workflows/workflow-validation-panel";
import {
  createWorkflowActionDefinition,
  createWorkflowEntityId,
  createWorkflowConditionDefinition,
  syncWorkflowDraftCanvas,
  type WorkflowActionConfig,
  type WorkflowCanvas,
  type WorkflowConditionConfig,
  type WorkflowDetail,
  type WorkflowDraftDocument,
  type WorkflowDraftState,
  type WorkflowNodeType,
  type WorkflowTriggerConfig,
} from "@/lib/server/workflows/types";
import { validateWorkflowDraftDocument } from "@/lib/server/workflows/validation";

type WorkflowCanvasEditorProps = {
  orgSlug: string;
  detail: WorkflowDetail;
  initialDraft: WorkflowDraftState;
};

type DraftResponse = {
  draft?: WorkflowDraftState;
  error?: string;
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function cloneDraftDocument(draft: WorkflowDraftDocument): WorkflowDraftDocument {
  return JSON.parse(JSON.stringify(draft)) as WorkflowDraftDocument;
}

function ensureDraftHasRenderableCanvas(
  draft: WorkflowDraftDocument,
): WorkflowDraftDocument {
  const normalized = cloneDraftDocument(draft);

  if (
    !normalized.config.trigger &&
    normalized.config.conditions.length === 0 &&
    normalized.config.actions.length === 0
  ) {
    normalized.config.trigger = {
      id: createWorkflowEntityId("trigger"),
      type: "manual",
      label: "Manual trigger",
      description: "",
      config: {},
    };
  }

  const synced = syncWorkflowDraftCanvas(normalized);
  if (synced.canvas.nodes.length > 0) {
    return synced;
  }

  if (!synced.config.trigger) {
    synced.config.trigger = {
      id: createWorkflowEntityId("trigger"),
      type: "manual",
      label: "Manual trigger",
      description: "",
      config: {},
    };
  }

  return syncWorkflowDraftCanvas(synced);
}

function appendCanvasNode(
  canvas: WorkflowCanvas,
  node: WorkflowCanvas["nodes"][number],
): WorkflowCanvas {
  return {
    ...canvas,
    nodes: [...canvas.nodes, node],
  };
}

export function WorkflowCanvasEditor({
  orgSlug,
  detail,
  initialDraft,
}: WorkflowCanvasEditorProps) {
  const router = useRouter();
  const initialRenderableDraft = useMemo(
    () => ensureDraftHasRenderableCanvas(initialDraft.draft),
    [initialDraft.draft],
  );
  const [draft, setDraft] = useState<WorkflowDraftDocument>(
    initialRenderableDraft,
  );
  const [updatedAt, setUpdatedAt] = useState(initialDraft.updatedAt);
  const [updatedBy, setUpdatedBy] = useState(initialDraft.updatedBy);
  const [status, setStatus] = useState(initialDraft.status);
  const [latestVersionNumber, setLatestVersionNumber] = useState(
    initialDraft.latestVersionNumber,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialRenderableDraft.canvas.nodes[0]?.id ?? null,
  );
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    JSON.stringify(initialRenderableDraft),
  );

  useEffect(() => {
    if (!draft.canvas.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(draft.canvas.nodes[0]?.id ?? null);
    }
  }, [draft.canvas.nodes, selectedNodeId]);

  useEffect(() => {
    if (draft.canvas.nodes.length > 0) {
      return;
    }

    setDraft((current) => ensureDraftHasRenderableCanvas(current));
  }, [draft.canvas.nodes.length]);

  useEffect(() => {
    const selectedNodeStillExists =
      (draft.config.trigger?.id ?? null) === selectedNodeId ||
      draft.config.conditions.some((condition) => condition.id === selectedNodeId) ||
      draft.config.actions.some((action) => action.id === selectedNodeId);

    if (selectedNodeStillExists) {
      return;
    }

    setInspectorOpen(false);
  }, [draft.config.actions, draft.config.conditions, draft.config.trigger, selectedNodeId]);

  useEffect(() => {
    if (!inspectorOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setInspectorOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inspectorOpen]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== savedFingerprint,
    [draft, savedFingerprint],
  );
  const validationIssues = useMemo(
    () => validateWorkflowDraftDocument(draft),
    [draft],
  );

  const updateDraft = (
    updater: (current: WorkflowDraftDocument) => WorkflowDraftDocument,
  ) => {
    setDraft((current) =>
      ensureDraftHasRenderableCanvas(updater(cloneDraftDocument(current))),
    );
  };

  const handleChangeTrigger = (patch: Partial<WorkflowTriggerConfig>) => {
    updateDraft((current) => ({
      ...current,
      config: {
        ...current.config,
        trigger: current.config.trigger
          ? {
              ...current.config.trigger,
              ...patch,
              config:
                patch.config === undefined
                  ? current.config.trigger.config
                  : patch.config,
            }
          : null,
      },
    }));
  };

  const handleChangeCondition = (
    conditionId: string,
    patch: Partial<WorkflowConditionConfig>,
  ) => {
    updateDraft((current) => ({
      ...current,
      config: {
        ...current.config,
        conditions: current.config.conditions.map((condition) =>
          condition.id === conditionId ? { ...condition, ...patch } : condition,
        ),
      },
    }));
  };

  const handleChangeAction = (
    actionId: string,
    patch: Partial<WorkflowActionConfig>,
  ) => {
    updateDraft((current) => ({
      ...current,
      config: {
        ...current.config,
        actions: current.config.actions.map((action) =>
          action.id === actionId ? { ...action, ...patch } : action,
        ),
      },
    }));
  };

  const handleCanvasChange = (canvas: WorkflowCanvas) => {
    updateDraft((current) => ({
      ...current,
      canvas,
    }));
  };

  const handleAddTrigger = (
    position?: WorkflowCanvas["nodes"][number]["position"],
  ): string | null => {
    if (draft.config.trigger) {
      return null;
    }

    const newTriggerId = createWorkflowEntityId("trigger");
    updateDraft((current) => {
      const trigger: WorkflowTriggerConfig = {
        id: newTriggerId,
        type: "manual",
        label: "Manual trigger",
        description: "",
        config: {},
      };

      return {
        ...current,
        config: {
          ...current.config,
          trigger,
        },
        canvas: position
          ? appendCanvasNode(current.canvas, {
              id: newTriggerId,
              type: "trigger",
              label: trigger.label,
              description: trigger.description,
              position,
              config: trigger.config,
            })
          : current.canvas,
      };
    });
    setSelectedNodeId(newTriggerId);
    return newTriggerId;
  };

  const handleAddCondition = (
    position?: WorkflowCanvas["nodes"][number]["position"],
  ): string => {
    const newConditionId = createWorkflowEntityId("condition");
    const condition = createWorkflowConditionDefinition();
    updateDraft((current) => ({
      ...current,
      config: {
        ...current.config,
        conditions: [
          ...current.config.conditions,
          {
            ...condition,
            id: newConditionId,
          },
        ],
      },
      canvas: position
        ? appendCanvasNode(current.canvas, {
            id: newConditionId,
            type: "condition",
            label: condition.label,
            description: condition.description,
            position,
            config: {
              resolverScope: condition.resolver.scope,
              resolverPath: condition.resolver.path,
              operator: condition.operator,
              value: condition.value,
              legacyIssue: condition.legacyIssue,
            },
          })
        : current.canvas,
    }));
    setSelectedNodeId(newConditionId);
    return newConditionId;
  };

  const handleDeleteCondition = (conditionId: string) => {
    updateDraft((current) => ({
      ...current,
      config: {
        ...current.config,
        conditions: current.config.conditions.filter(
          (condition) => condition.id !== conditionId,
        ),
      },
    }));
  };

  const handleAddAction = (
    position?: WorkflowCanvas["nodes"][number]["position"],
  ): string => {
    const action = createWorkflowActionDefinition("send_email");
    const newActionId = action.id;
    updateDraft((current) => ({
      ...current,
      config: {
        ...current.config,
        actions: [
          ...current.config.actions,
          action,
        ],
      },
      canvas: position
        ? appendCanvasNode(current.canvas, {
            id: newActionId,
            type: "action",
            label: action.label,
            description: action.description,
            position,
            config: {
              actionType: action.type,
              ...action.config,
            },
          })
        : current.canvas,
    }));
    setSelectedNodeId(newActionId);
    setInspectorOpen(true);
    return newActionId;
  };

  const handleDeleteAction = (actionId: string) => {
    updateDraft((current) => ({
      ...current,
      config: {
        ...current.config,
        actions: current.config.actions.filter((action) => action.id !== actionId),
      },
    }));
  };

  const handleCreateNode = (
    nodeType: WorkflowNodeType,
    position?: WorkflowCanvas["nodes"][number]["position"],
  ): string | null => {
    switch (nodeType) {
      case "trigger":
        return handleAddTrigger(position);
      case "condition":
        return handleAddCondition(position);
      case "action":
        return handleAddAction(position);
      default:
        return null;
    }
  };

  const openInspectorForNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setInspectorOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/workflows/${detail.workflowId}/draft`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            metadata: draft.metadata,
            config: draft.config,
            canvas: draft.canvas,
          }),
        },
      );

      const payload = (await response.json()) as DraftResponse;
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error ?? "Failed to save workflow draft");
      }

      const normalizedDraft = ensureDraftHasRenderableCanvas(payload.draft.draft);
      setDraft(normalizedDraft);
      setUpdatedAt(payload.draft.updatedAt);
      setUpdatedBy(payload.draft.updatedBy);
      setStatus(payload.draft.status);
      setLatestVersionNumber(payload.draft.latestVersionNumber);
      setSavedFingerprint(JSON.stringify(normalizedDraft));
      setFeedback({
        tone: "success",
        message: "Draft saved successfully.",
      });
      toast.success("Workflow draft saved.");
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save workflow draft";
      setFeedback({
        tone: "error",
        message,
      });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <WorkflowToolbar
        title={`${detail.name} draft editor`}
        description="Edit the safe draft, validate trigger and action configuration, then publish a new immutable version when the checks pass."
        backHref={`/org/${orgSlug}/workflows/${detail.workflowId}`}
        backLabel="Back to workflow"
        actions={
          <>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/org/${orgSlug}/workflows/${detail.workflowId}/history`}>
                <History className="h-4 w-4" />
                History
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={loading}
              onClick={handleSave}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save draft
            </Button>
            <WorkflowPublishDialog
              orgSlug={orgSlug}
              workflowId={detail.workflowId}
              workflowName={draft.metadata.name || detail.name}
              latestVersionNumber={latestVersionNumber}
              issues={validationIssues}
            />
          </>
        }
      />

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,11rem))]">
        <div className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,rgba(11,28,48,0.98),rgba(0,95,158,0.88))] px-5 py-5 text-white shadow-[0_18px_48px_rgba(11,28,48,0.18)] sm:px-6">
          <p className="label-caps text-[rgba(255,255,255,0.72)]">
            Full-page draft workspace
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-white">
            {draft.metadata.name || "Untitled workflow"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[rgba(255,255,255,0.82)]">
            Build the entire flow here: drag nodes, connect pass paths, edit typed conditions and actions, inspect validation, and publish only when the graph is production-ready.
          </p>
        </div>

        <div className="glass-panel rounded-[1.75rem] px-4 py-4">
          <p className="label-caps">Status</p>
          <p className="mt-2 text-lg font-bold text-[var(--on-surface)]">
            {status.replaceAll("_", " ")}
          </p>
        </div>
        <div className="glass-panel rounded-[1.75rem] px-4 py-4">
          <p className="label-caps">Draft</p>
          <p className="mt-2 text-lg font-bold text-[var(--on-surface)]">
            {isDirty ? "Unsaved" : "Clean"}
          </p>
        </div>
        <div className="glass-panel rounded-[1.75rem] px-4 py-4">
          <p className="label-caps">Last saved</p>
          <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
            {formatDateTime(updatedAt)}
          </p>
        </div>
        <div className="glass-panel rounded-[1.75rem] px-4 py-4">
          <p className="label-caps">Saved by</p>
          <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
            {updatedBy?.name ?? updatedBy?.email ?? "Unknown"}
          </p>
        </div>
      </section>

      <FormStatusMessage
        id="workflow-editor-status"
        message={
          feedback?.message ??
          (isDirty
            ? "This draft has local changes that are not saved yet."
            : "All local edits are saved to the active draft.")
        }
        tone={feedback?.tone ?? (isDirty ? "info" : "success")}
      />

      <section className="flex flex-1 flex-col gap-4 xl:min-h-[calc(100vh-16rem)]">
        <div className="min-w-0 xl:min-h-0">
          <WorkflowFlowEditor
            canvas={draft.canvas}
            hasTrigger={Boolean(draft.config.trigger)}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onOpenInspector={openInspectorForNode}
            onCanvasChange={handleCanvasChange}
            onCreateNode={handleCreateNode}
          />
        </div>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="label-caps">Workflow metadata</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                  Definition settings
                </h2>
              </div>
              {!isDirty ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  Saved
                </div>
              ) : null}
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-editor-name">
                  Workflow name
                </label>
                <Input
                  id="workflow-editor-name"
                  value={draft.metadata.name}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      metadata: {
                        ...current.metadata,
                        name: event.target.value,
                      },
                    }))
                  }
                  placeholder="Workflow name"
                  className="input-field border-0 shadow-none"
                />
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-editor-category">
                    Category
                  </label>
                  <Input
                    id="workflow-editor-category"
                    value={draft.metadata.category}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        metadata: {
                          ...current.metadata,
                          category: event.target.value,
                        },
                      }))
                    }
                    placeholder="Operations"
                    className="input-field border-0 shadow-none"
                  />
                </div>
                <div>
                  <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-editor-tags">
                    Tags
                  </label>
                  <Input
                    id="workflow-editor-tags"
                    value={draft.metadata.tags.join(", ")}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        metadata: {
                          ...current.metadata,
                          tags: event.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                    placeholder="billing, finance, approvals"
                    className="input-field border-0 shadow-none"
                  />
                </div>
              </div>

              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-editor-description">
                  Description
                </label>
                <textarea
                  id="workflow-editor-description"
                  value={draft.metadata.description}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      metadata: {
                        ...current.metadata,
                        description: event.target.value,
                      },
                    }))
                  }
                  placeholder="Describe the operational goal of this workflow"
                  className="min-h-28 w-full rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>
          </section>

          <WorkflowValidationPanel
            issues={validationIssues}
            title="Draft validation"
            description="This side rail keeps the latest server-side checks visible while you work directly in the canvas."
            compact
          />

          <div className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
            <p className="label-caps">Node inspector</p>
            <h2 className="mt-2 text-xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
              Open node editing in a popup
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
              Double-click any trigger, condition, or action node in the canvas to open the inspector and edit that node in a focused popup.
            </p>
          </div>
        </section>
      </section>

      {inspectorOpen && selectedNodeId ? (
        <div
          className="fixed inset-0 z-[145] flex items-center justify-center bg-[rgba(11,28,48,0.54)] px-4 py-8 backdrop-blur-sm"
          role="presentation"
          onClick={() => setInspectorOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workflow-node-inspector-title"
            className="glass-panel-strong max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[1.85rem] p-6 shadow-[0_20px_44px_rgba(4,17,29,0.3)] sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="label-caps">Node inspector</p>
                <h2
                  id="workflow-node-inspector-title"
                  className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]"
                >
                  Edit selected workflow node
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
                  Update the selected trigger, condition, or action without leaving the canvas.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setInspectorOpen(false)}
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>

            <WorkflowNodeInspector
              draft={draft}
              selectedNodeId={selectedNodeId}
              validationIssues={validationIssues}
              disabled={loading}
              onChangeTrigger={handleChangeTrigger}
              onChangeCondition={handleChangeCondition}
              onChangeAction={handleChangeAction}
              onAddCondition={handleAddCondition}
              onAddAction={handleAddAction}
              onDeleteCondition={handleDeleteCondition}
              onDeleteAction={handleDeleteAction}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
