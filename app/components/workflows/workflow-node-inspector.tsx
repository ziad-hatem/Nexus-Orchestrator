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
  WorkflowActionType,
  WorkflowConditionConfig,
  WorkflowDraftDocument,
  WorkflowTriggerConfig,
  ValidationIssue,
} from "@/lib/server/workflows/types";
import {
  createDefaultWorkflowActionConfig,
  getWorkflowActionTypeLabel,
} from "@/lib/server/workflows/types";

type WorkflowNodeInspectorProps = {
  draft: WorkflowDraftDocument;
  selectedNodeId: string | null;
  validationIssues: ValidationIssue[];
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

function filterRelevantValidationIssues(
  issues: ValidationIssue[],
  selectedNodeId: string | null,
): ValidationIssue[] {
  if (!selectedNodeId) {
    return [];
  }

  return issues.filter((issue) => issue.path.includes(selectedNodeId));
}

function getActionCompletionState(action: WorkflowActionConfig): {
  complete: boolean;
  missing: string[];
} {
  if (action.type === "legacy_custom") {
    return {
      complete: false,
      missing: ["convert this legacy action to a supported type"],
    };
  }

  const config = action.config;
  const missing: string[] = [];

  switch (action.type) {
    case "notify":
      if (!String(config.recipient ?? "").trim()) {
        missing.push("recipient");
      }
      if (
        !String(config.template ?? "").trim() &&
        !String(config.message ?? "").trim()
      ) {
        missing.push("message or template");
      }
      break;
    case "webhook_request":
      if (!String(config.url ?? "").trim()) {
        missing.push("destination URL");
      }
      if (!String(config.payloadTemplate ?? "").trim()) {
        missing.push("payload template");
      }
      break;
    case "ticket_update":
      if (!String(config.value ?? "").trim()) {
        missing.push("update value");
      }
      break;
    default:
      break;
  }

  return {
    complete: missing.length === 0,
    missing,
  };
}

export function WorkflowNodeInspector({
  draft,
  selectedNodeId,
  validationIssues,
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
  const relevantIssues = useMemo(
    () => filterRelevantValidationIssues(validationIssues, selectedNodeId),
    [selectedNodeId, validationIssues],
  );
  const selectedActionCompletion = useMemo(
    () =>
      selectedAction
        ? getActionCompletionState(selectedAction)
        : { complete: false, missing: [] },
    [selectedAction],
  );
  const selectedConditionBranchState = useMemo(() => {
    if (!selectedCondition) {
      return null;
    }

    const trueCount = draft.canvas.edges.filter(
      (edge) =>
        edge.source === selectedCondition.id && edge.branchKey === "true",
    ).length;
    const falseCount = draft.canvas.edges.filter(
      (edge) =>
        edge.source === selectedCondition.id && edge.branchKey === "false",
    ).length;

    return {
      trueCount,
      falseCount,
      ready: trueCount === 1 && falseCount === 1,
    };
  }, [draft.canvas.edges, selectedCondition]);

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

      {selectedKind && relevantIssues.length > 0 ? (
        <div className="mt-5 rounded-[1.5rem] border border-[color:color-mix(in_srgb,var(--error)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--error-container)_82%,transparent)] p-5">
          <p className="label-caps text-[var(--error)]">Selected node issues</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--on-surface)]">
            {relevantIssues.map((issue) => (
              <li key={`${issue.path}:${issue.code}`}>{issue.message}</li>
            ))}
          </ul>
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
                    value === "webhook"
                      ? { method: "POST", path: "" }
                      : value === "internal_event"
                        ? { eventKey: "ticket.created" }
                      : {},
                })
              }
            >
              <SelectTrigger id="workflow-trigger-type">
                <SelectValue placeholder="Choose a trigger type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="internal_event">Internal event</SelectItem>
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
            <div className="rounded-[1.5rem] bg-[var(--error-container)] p-4 text-sm text-[var(--error)]">
              Scheduled triggers are legacy-only in phase three. Switch this draft to manual, webhook, or internal event before publishing.
            </div>
          ) : null}

          {trigger.type === "webhook" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-trigger-method">
                    Method
                  </label>
                  <Input
                    id="workflow-trigger-method"
                    value="POST"
                    readOnly
                    className="input-field border-0 shadow-none"
                  />
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
                      POST
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {trigger.type === "internal_event" ? (
            <div>
              <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-trigger-event-key">
                Supported internal event
              </label>
              <Select
                value={String(trigger.config.eventKey ?? "ticket.created")}
                disabled={disabled}
                onValueChange={(value) =>
                  onChangeTrigger({
                    config: updateConfigRecord(
                      trigger.config,
                      "eventKey",
                      value,
                    ),
                  })
                }
              >
                <SelectTrigger id="workflow-trigger-event-key">
                  <SelectValue placeholder="Choose an internal event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ticket.created">ticket.created</SelectItem>
                  <SelectItem value="payment.failed">payment.failed</SelectItem>
                </SelectContent>
              </Select>
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

          {selectedConditionBranchState ? (
            <div className="rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
              <p className="label-caps">Branch contract</p>
              <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                {selectedConditionBranchState.ready
                  ? "True and false branches are both connected."
                  : "This condition still needs one true branch and one false branch."}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[var(--surface-container-lowest)] p-4">
                  <p className="label-caps">True path</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {selectedConditionBranchState.trueCount} connected
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-lowest)] p-4">
                  <p className="label-caps">False path</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {selectedConditionBranchState.falseCount} connected
                  </p>
                </div>
              </div>
            </div>
          ) : null}
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

          <div className="rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="label-caps">Completeness</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {selectedActionCompletion.complete
                    ? "This action is fully configured."
                    : "This action still needs required fields."}
                </p>
              </div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  selectedActionCompletion.complete
                    ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200"
                    : "bg-amber-500/12 text-amber-800 dark:text-amber-200"
                }`}
              >
                {selectedActionCompletion.complete ? "Complete" : "Needs attention"}
              </span>
            </div>

            {!selectedActionCompletion.complete ? (
              <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                Missing: {selectedActionCompletion.missing.join(", ")}.
              </p>
            ) : null}
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

          <div>
            <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-type">
              Action type
            </label>
            <Select
              value={selectedAction.type}
              disabled={disabled}
              onValueChange={(value) =>
                onChangeAction(selectedAction.id, {
                  type: value as WorkflowActionType,
                  label:
                    value === "legacy_custom"
                      ? "Legacy action"
                      : getWorkflowActionTypeLabel(value as WorkflowActionType),
                  config:
                    value === "legacy_custom"
                      ? selectedAction.config
                      : createDefaultWorkflowActionConfig(
                          value as Exclude<WorkflowActionType, "legacy_custom">,
                        ),
                })
              }
            >
              <SelectTrigger id="workflow-action-type">
                <SelectValue placeholder="Choose an action type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="notify">Notify</SelectItem>
                <SelectItem value="webhook_request">Webhook request</SelectItem>
                <SelectItem value="ticket_update">Ticket update</SelectItem>
                <SelectItem value="legacy_custom">Legacy custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedAction.type === "legacy_custom" ? (
            <div className="rounded-[1.5rem] bg-[var(--error-container)] p-4 text-sm text-[var(--error)]">
              This action came from the older free-form model. Switch it to Notify, Webhook request, or Ticket update before publishing.
            </div>
          ) : null}

          {selectedAction.type === "notify" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-notify-channel">
                  Channel
                </label>
                <Select
                  value={String(selectedAction.config.channel ?? "email")}
                  disabled={disabled}
                  onValueChange={(value) =>
                    onChangeAction(selectedAction.id, {
                      config: updateConfigRecord(selectedAction.config, "channel", value),
                    })
                  }
                >
                  <SelectTrigger id="workflow-action-notify-channel">
                    <SelectValue placeholder="Choose a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="in_app">In app</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-notify-recipient">
                  Recipient
                </label>
                <Input
                  id="workflow-action-notify-recipient"
                  value={String(selectedAction.config.recipient ?? "")}
                  disabled={disabled}
                  onChange={(event) =>
                    onChangeAction(selectedAction.id, {
                      config: updateConfigRecord(
                        selectedAction.config,
                        "recipient",
                        event.target.value,
                      ),
                    })
                  }
                  placeholder="support@nexus.dev"
                  className="input-field border-0 shadow-none"
                />
              </div>

              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-notify-template">
                  Template
                </label>
                <Input
                  id="workflow-action-notify-template"
                  value={String(selectedAction.config.template ?? "")}
                  disabled={disabled}
                  onChange={(event) =>
                    onChangeAction(selectedAction.id, {
                      config: updateConfigRecord(
                        selectedAction.config,
                        "template",
                        event.target.value,
                      ),
                    })
                  }
                  placeholder="payment-failed-alert"
                  className="input-field border-0 shadow-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-notify-message">
                  Message
                </label>
                <textarea
                  id="workflow-action-notify-message"
                  value={String(selectedAction.config.message ?? "")}
                  disabled={disabled}
                  onChange={(event) =>
                    onChangeAction(selectedAction.id, {
                      config: updateConfigRecord(
                        selectedAction.config,
                        "message",
                        event.target.value,
                      ),
                    })
                  }
                  placeholder="Payment failed for {{payload.customerEmail}}."
                  className="min-h-24 w-full rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>
          ) : null}

          {selectedAction.type === "webhook_request" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-webhook-method">
                  Method
                </label>
                <Select
                  value={String(selectedAction.config.method ?? "POST")}
                  disabled={disabled}
                  onValueChange={(value) =>
                    onChangeAction(selectedAction.id, {
                      config: updateConfigRecord(selectedAction.config, "method", value),
                    })
                  }
                >
                  <SelectTrigger id="workflow-action-webhook-method">
                    <SelectValue placeholder="Choose a method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-webhook-url">
                  Destination URL
                </label>
                <Input
                  id="workflow-action-webhook-url"
                  value={String(selectedAction.config.url ?? "")}
                  disabled={disabled}
                  onChange={(event) =>
                    onChangeAction(selectedAction.id, {
                      config: updateConfigRecord(
                        selectedAction.config,
                        "url",
                        event.target.value,
                      ),
                    })
                  }
                  placeholder="https://api.example.com/hooks/payments"
                  className="input-field border-0 shadow-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-webhook-payload">
                  Payload template
                </label>
                <textarea
                  id="workflow-action-webhook-payload"
                  value={String(selectedAction.config.payloadTemplate ?? "")}
                  disabled={disabled}
                  onChange={(event) =>
                    onChangeAction(selectedAction.id, {
                      config: updateConfigRecord(
                        selectedAction.config,
                        "payloadTemplate",
                        event.target.value,
                      ),
                    })
                  }
                  placeholder='{"ticketId":"{{payload.ticketId}}","status":"failed"}'
                  className="min-h-24 w-full rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 py-3 text-sm font-mono text-[var(--on-surface)] outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>
          ) : null}

          {selectedAction.type === "ticket_update" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-ticket-field">
                  Ticket field
                </label>
                <Select
                  value={String(selectedAction.config.field ?? "status")}
                  disabled={disabled}
                  onValueChange={(value) =>
                    onChangeAction(selectedAction.id, {
                      config: updateConfigRecord(selectedAction.config, "field", value),
                    })
                  }
                >
                  <SelectTrigger id="workflow-action-ticket-field">
                    <SelectValue placeholder="Choose a ticket field" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="assignee">Assignee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-ticket-value">
                  Value
                </label>
                <Input
                  id="workflow-action-ticket-value"
                  value={String(selectedAction.config.value ?? "")}
                  disabled={disabled}
                  onChange={(event) =>
                    onChangeAction(selectedAction.id, {
                      config: updateConfigRecord(
                        selectedAction.config,
                        "value",
                        event.target.value,
                      ),
                    })
                  }
                  placeholder="high"
                  className="input-field border-0 shadow-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-action-ticket-note">
                  Note
                </label>
                <textarea
                  id="workflow-action-ticket-note"
                  value={String(selectedAction.config.note ?? "")}
                  disabled={disabled}
                  onChange={(event) =>
                    onChangeAction(selectedAction.id, {
                      config: updateConfigRecord(
                        selectedAction.config,
                        "note",
                        event.target.value,
                      ),
                    })
                  }
                  placeholder="Escalated automatically after payment failure."
                  className="min-h-24 w-full rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
