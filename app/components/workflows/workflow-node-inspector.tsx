"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Copy,
  GitBranch,
  Link2,
  Plus,
  RadioTower,
  Trash2,
  Workflow,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import type {
  WorkflowActionConfig,
  WorkflowConditionConfig,
  WorkflowDraftDocument,
  WorkflowTriggerConfig,
} from "@/lib/server/workflows/types";

type WorkflowNodeInspectorProps = {
  draft: WorkflowDraftDocument;
  selectedNodeId: string | null;
  disabled?: boolean;
  onChangeTrigger: (patch: Partial<WorkflowTriggerConfig>) => void;
  onChangeCondition: (
    conditionId: string,
    patch: Partial<WorkflowConditionConfig>,
  ) => void;
  onChangeAction: (
    actionId: string,
    patch: Partial<WorkflowActionConfig>,
  ) => void;
  onAddCondition: () => void;
  onAddAction: () => void;
  onDeleteCondition: (conditionId: string) => void;
  onDeleteAction: (actionId: string) => void;
};

function updateConfigRecord(
  current: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  return {
    ...current,
    [key]: value,
  };
}

function normalizeWebhookPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function WorkflowNodeInspector({
  draft,
  selectedNodeId,
  disabled = false,
  onChangeTrigger,
  onChangeCondition,
  onChangeAction,
  onAddCondition,
  onAddAction,
  onDeleteCondition,
  onDeleteAction,
}: WorkflowNodeInspectorProps) {
  const trigger = draft.config.trigger;
  const selectedCondition = draft.config.conditions.find(
    (condition) => condition.id === selectedNodeId,
  );
  const selectedAction = draft.config.actions.find(
    (action) => action.id === selectedNodeId,
  );
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const browserOrigin = useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => "",
  );

  const selectedKind =
    trigger?.id === selectedNodeId
      ? "trigger"
      : selectedCondition
        ? "condition"
        : selectedAction
          ? "action"
          : null;
  const webhookPath = useMemo(
    () =>
      trigger?.type === "webhook"
        ? normalizeWebhookPath(String(trigger.config.path ?? ""))
        : "",
    [trigger],
  );
  const webhookUrl = useMemo(() => {
    if (!browserOrigin || !webhookPath) {
      return "";
    }

    return new URL(webhookPath, browserOrigin).toString();
  }, [browserOrigin, webhookPath]);

  useEffect(() => {
    if (!copiedWebhookUrl) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopiedWebhookUrl(false);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [copiedWebhookUrl]);

  const handleCopyWebhookUrl = async () => {
    if (!webhookUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhookUrl(true);
    } catch {
      setCopiedWebhookUrl(false);
    }
  };

  return (
    <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-caps">Node inspector</p>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
            {selectedKind
              ? `Edit ${selectedKind} configuration`
              : "Select a workflow node"}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={disabled}
            onClick={onAddCondition}
          >
            <GitBranch className="h-4 w-4" />
            Condition
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={disabled}
            onClick={onAddAction}
          >
            <Plus className="h-4 w-4" />
            Action
          </Button>
        </div>
      </div>

      {!selectedKind ? (
        <div className="mt-5 rounded-[1.5rem] bg-[var(--surface-container-low)] p-5 text-sm leading-6 text-[var(--on-surface-variant)]">
          Choose a trigger, condition, or action node from the canvas to configure its safe draft fields.
        </div>
      ) : null}

      {selectedKind === "trigger" && trigger ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white">
                <RadioTower className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--on-surface)]">
                  Trigger node
                </p>
                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                  Exactly one trigger starts each workflow version.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-trigger-type">
              Trigger type
            </label>
            <Select
              value={trigger.type}
              disabled={disabled}
              onValueChange={(value) =>
                onChangeTrigger({
                  type: value as WorkflowTriggerConfig["type"],
                  config:
                    value === "schedule"
                      ? { cron: "" }
                      : value === "webhook"
                        ? { method: "POST", path: "" }
                        : {},
                })
              }
            >
              <SelectTrigger id="workflow-trigger-type">
                <SelectValue placeholder="Choose a trigger type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="schedule">Schedule</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-trigger-label">
              Label
            </label>
            <Input
              id="workflow-trigger-label"
              value={trigger.label}
              disabled={disabled}
              onChange={(event) => onChangeTrigger({ label: event.target.value })}
              placeholder="Daily schedule trigger"
              className="input-field border-0 shadow-none"
            />
          </div>

          <div>
            <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-trigger-description">
              Description
            </label>
            <textarea
              id="workflow-trigger-description"
              value={trigger.description}
              disabled={disabled}
              onChange={(event) =>
                onChangeTrigger({ description: event.target.value })
              }
              placeholder="Explain what starts this workflow"
              className="min-h-24 w-full rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            />
          </div>

          {trigger.type === "schedule" ? (
            <div>
              <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-trigger-cron">
                Cron schedule
              </label>
              <Input
                id="workflow-trigger-cron"
                value={String(trigger.config.cron ?? "")}
                disabled={disabled}
                onChange={(event) =>
                  onChangeTrigger({
                    config: updateConfigRecord(
                      trigger.config,
                      "cron",
                      event.target.value,
                    ),
                  })
                }
                placeholder="0 0 * * *"
                className="input-field border-0 shadow-none"
              />
            </div>
          ) : null}

          {trigger.type === "webhook" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-trigger-method">
                    Method
                  </label>
                  <Select
                    value={String(trigger.config.method ?? "POST")}
                    disabled={disabled}
                    onValueChange={(value) =>
                      onChangeTrigger({
                        config: updateConfigRecord(trigger.config, "method", value),
                      })
                    }
                  >
                    <SelectTrigger id="workflow-trigger-method">
                      <SelectValue placeholder="HTTP method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-trigger-path">
                    Request path
                  </label>
                  <Input
                    id="workflow-trigger-path"
                    value={String(trigger.config.path ?? "")}
                    disabled={disabled}
                    onChange={(event) =>
                      onChangeTrigger({
                        config: updateConfigRecord(
                          trigger.config,
                          "path",
                          event.target.value,
                        ),
                      })
                    }
                    placeholder="/hooks/order-created"
                    className="input-field border-0 shadow-none"
                  />
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <Link2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--on-surface)]">
                        Direct webhook URL
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--on-surface-variant)]">
                        Use this exact URL when posting into this webhook trigger.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      value={webhookUrl || "Set a request path to generate the webhook URL"}
                      readOnly
                      className="input-field border-0 shadow-none font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      disabled={!webhookUrl}
                      onClick={handleCopyWebhookUrl}
                    >
                      <Copy className="h-4 w-4" />
                      {copiedWebhookUrl ? "Copied" : "Copy URL"}
                    </Button>
                  </div>

                  <p className="text-xs leading-5 text-[var(--on-surface-variant)]">
                    Method:{" "}
                    <span className="font-semibold text-[var(--on-surface)]">
                      {String(trigger.config.method ?? "POST")}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedKind === "condition" && selectedCondition ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/14 text-amber-800 dark:text-amber-200">
                  <GitBranch className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--on-surface)]">
                    Condition node
                  </p>
                  <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                    Conditions define the rule gates between the trigger and downstream actions.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-[var(--error)]"
                disabled={disabled}
                onClick={() => onDeleteCondition(selectedCondition.id)}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>
          </div>

          <div>
            <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-condition-label">
              Label
            </label>
            <Input
              id="workflow-condition-label"
              value={selectedCondition.label}
              disabled={disabled}
              onChange={(event) =>
                onChangeCondition(selectedCondition.id, {
                  label: event.target.value,
                })
              }
              placeholder="Validate order size"
              className="input-field border-0 shadow-none"
            />
          </div>

          <div>
            <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-condition-description">
              Description
            </label>
            <textarea
              id="workflow-condition-description"
              value={selectedCondition.description}
              disabled={disabled}
              onChange={(event) =>
                onChangeCondition(selectedCondition.id, {
                  description: event.target.value,
                })
              }
              placeholder="Describe what this branch checks before continuing"
              className="min-h-24 w-full rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            />
          </div>

          <div>
            <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-condition-expression">
              Expression
            </label>
            <Input
              id="workflow-condition-expression"
              value={selectedCondition.expression}
              disabled={disabled}
              onChange={(event) =>
                onChangeCondition(selectedCondition.id, {
                  expression: event.target.value,
                })
              }
              placeholder="payload.amount > 1000"
              className="input-field border-0 shadow-none font-mono"
            />
          </div>
        </div>
      ) : null}

      {selectedKind === "action" && selectedAction ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-800 dark:text-emerald-200">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--on-surface)]">
                    Action node
                  </p>
                  <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                    Actions perform the final work once validation conditions pass.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-[var(--error)]"
                disabled={disabled}
                onClick={() => onDeleteAction(selectedAction.id)}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>
          </div>

          <div>
            <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-label">
              Label
            </label>
            <Input
              id="workflow-action-label"
              value={selectedAction.label}
              disabled={disabled}
              onChange={(event) =>
                onChangeAction(selectedAction.id, {
                  label: event.target.value,
                })
              }
              placeholder="Send customer notification"
              className="input-field border-0 shadow-none"
            />
          </div>

          <div>
            <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-description">
              Description
            </label>
            <textarea
              id="workflow-action-description"
              value={selectedAction.description}
              disabled={disabled}
              onChange={(event) =>
                onChangeAction(selectedAction.id, {
                  description: event.target.value,
                })
              }
              placeholder="Summarize what this action sends or mutates"
              className="min-h-24 w-full rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-operation">
                Operation
              </label>
              <Input
                id="workflow-action-operation"
                value={selectedAction.operation}
                disabled={disabled}
                onChange={(event) =>
                  onChangeAction(selectedAction.id, {
                    operation: event.target.value,
                  })
                }
                placeholder="notify"
                className="input-field border-0 shadow-none"
              />
            </div>
            <div>
              <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-target">
                Target
              </label>
              <Input
                id="workflow-action-target"
                value={selectedAction.target}
                disabled={disabled}
                onChange={(event) =>
                  onChangeAction(selectedAction.id, {
                    target: event.target.value,
                  })
                }
                placeholder="customer-email"
                className="input-field border-0 shadow-none"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
