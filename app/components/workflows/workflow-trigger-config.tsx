"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Radio,
  Save,
  Webhook,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { FormStatusMessage } from "@/app/components/a11y/form-status-message";
import { WorkflowTriggerAttempts } from "@/app/components/workflows/workflow-trigger-attempts";
import type {
  SupportedWorkflowTriggerType,
  WorkflowDraftState,
  WorkflowTriggerDetails,
} from "@/lib/server/workflows/types";
import { normalizeWebhookPath } from "@/lib/server/validation";

type WorkflowTriggerConfigProps = {
  orgSlug: string;
  workflowId: string;
  workflowName: string;
  triggerDetails: WorkflowTriggerDetails;
  draft: WorkflowDraftState | null;
  canEdit: boolean;
};

type DraftPatchResponse = {
  error?: string;
  draft?: WorkflowDraftState;
};

const TRIGGER_OPTIONS: Array<{
  value: SupportedWorkflowTriggerType;
  label: string;
  description: string;
}> = [
  {
    value: "manual",
    label: "Manual",
    description: "Run from the workspace UI or a protected API call.",
  },
  {
    value: "webhook",
    label: "Webhook",
    description:
      "Accept inbound POST deliveries on an API key protected endpoint.",
  },
  {
    value: "internal_event",
    label: "Internal event",
    description:
      "Fan out trusted Nexus events like organization.created and membership.suspended.",
  },
];

function defaultTriggerForType(type: SupportedWorkflowTriggerType) {
  if (type === "webhook") {
    return {
      type,
      label: "Webhook trigger",
      description: "",
      config: {
        method: "POST",
        path: "/hooks/new-workflow-trigger",
      },
    };
  }

  if (type === "internal_event") {
    return {
      type,
      label: "Internal event trigger",
      description: "",
      config: {
        eventKey: "organization.created",
      },
    };
  }

  return {
    type,
    label: "Manual trigger",
    description: "",
    config: {},
  };
}

function buildInitialTrigger(params: {
  workflowId: string;
  triggerDetails: WorkflowTriggerDetails;
  draft: WorkflowDraftState | null;
}) {
  if (params.draft?.draft.config.trigger) {
    return params.draft.draft.config.trigger;
  }

  if (params.triggerDetails.trigger.draftTrigger) {
    return params.triggerDetails.trigger.draftTrigger;
  }

  if (params.triggerDetails.trigger.sourceType) {
    return {
      id: `trigger-${params.workflowId}`,
      type: params.triggerDetails.trigger.sourceType,
      label: params.triggerDetails.trigger.label ?? "Workflow trigger",
      description: params.triggerDetails.trigger.description ?? "",
      config: params.triggerDetails.trigger.config,
    };
  }

  return {
    id: `trigger-${params.workflowId}`,
    ...defaultTriggerForType("manual"),
  };
}

export function WorkflowTriggerConfig({
  orgSlug,
  workflowId,
  workflowName,
  triggerDetails,
  draft,
  canEdit,
}: WorkflowTriggerConfigProps) {
  const router = useRouter();
  const initialTrigger = buildInitialTrigger({
    workflowId,
    triggerDetails,
    draft,
  });
  const [trigger, setTrigger] = useState(initialTrigger);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);

  const endpointPath = useMemo(
    () =>
      trigger.type === "webhook"
        ? normalizeWebhookPath(String(trigger.config.path ?? ""))
        : null,
    [trigger.config.path, trigger.type],
  );

  const handleSave = async () => {
    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/workflows/${workflowId}/draft`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            config: {
              trigger,
            },
          }),
        },
      );

      const payload = (await response.json()) as DraftPatchResponse;
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error ?? "Failed to save trigger draft");
      }

      setTrigger(payload.draft.draft.config.trigger ?? trigger);
      setFeedback({
        tone: "success",
        message: "Trigger draft updated successfully.",
      });
      toast.success("Trigger draft updated.");
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save trigger draft";
      setFeedback({
        tone: "error",
        message,
      });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(11,28,48,0.98),rgba(0,95,158,0.88))] px-6 py-7 text-white shadow-[0_18px_48px_rgba(11,28,48,0.2)] sm:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="label-caps text-[rgba(255,255,255,0.72)]">
              Trigger configuration
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white">
              Configure how {workflowName} starts
            </h1>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.82)]">
              Keep new workflows on manual, webhook, or internal event sources.
              Legacy scheduled drafts stay readable but cannot be published.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/16"
            >
              <Link href={`/org/${orgSlug}/workflows/${workflowId}`}>
                Back to workflow
              </Link>
            </Button>
            <Button
              asChild
              className="rounded-xl bg-[var(--surface-container-lowest)] text-primary hover:bg-[var(--surface-container-high)]"
            >
              <Link href={`/org/${orgSlug}/workflows/${workflowId}/draft`}>
                Open draft editor
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
        <div className="space-y-6">
          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <p className="label-caps">Trigger source</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
              Select the published routing contract
            </h2>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {TRIGGER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    setTrigger((current) => ({
                      ...current,
                      ...defaultTriggerForType(option.value),
                    }))
                  }
                  className={`rounded-[1.5rem] border p-5 text-left transition ${
                    trigger.type === option.value
                      ? "border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                      : "border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)]"
                  } ${!canEdit ? "opacity-60" : ""}`}
                >
                  <p className="text-base font-semibold text-[var(--on-surface)]">
                    {option.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-4">
              <div>
                <label
                  className="label-caps mb-2 ml-1 block"
                  htmlFor="trigger-label"
                >
                  Trigger label
                </label>
                <Input
                  id="trigger-label"
                  value={trigger.label}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setTrigger((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  className="input-field border-0 shadow-none"
                />
              </div>
              <div>
                <label
                  className="label-caps mb-2 ml-1 block"
                  htmlFor="trigger-description"
                >
                  Description
                </label>
                <textarea
                  id="trigger-description"
                  value={trigger.description}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setTrigger((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-28 w-full rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                />
              </div>

              {trigger.type === "webhook" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="label-caps mb-2 ml-1 block">Method</label>
                    <Input
                      value="POST"
                      disabled
                      className="input-field border-0 shadow-none"
                    />
                  </div>
                  <div>
                    <label
                      className="label-caps mb-2 ml-1 block"
                      htmlFor="trigger-webhook-path"
                    >
                      Request path
                    </label>
                    <Input
                      id="trigger-webhook-path"
                      value={String(trigger.config.path ?? "")}
                      disabled={!canEdit}
                      onChange={(event) =>
                        setTrigger((current) => ({
                          ...current,
                          config: {
                            ...current.config,
                            path: event.target.value,
                            method: "POST",
                          },
                        }))
                      }
                      placeholder="/hooks/payment-failed"
                      className="input-field border-0 shadow-none"
                    />
                  </div>
                </div>
              ) : null}

              {trigger.type === "internal_event" ? (
                <div>
                  <label
                    className="label-caps mb-2 ml-1 block"
                    htmlFor="trigger-event-key"
                  >
                    Supported event
                  </label>
                  <Select
                    value={String(
                      trigger.config.eventKey ?? "organization.created",
                    )}
                    disabled={!canEdit}
                    onValueChange={(value) =>
                      setTrigger((current) => ({
                        ...current,
                        config: {
                          ...current.config,
                          eventKey: value,
                        },
                      }))
                    }
                  >
                    <SelectTrigger id="trigger-event-key">
                      <SelectValue placeholder="Choose an internal event" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organization.created">
                        organization.created
                      </SelectItem>
                      <SelectItem value="organization.updated">
                        organization.updated
                      </SelectItem>
                      <SelectItem value="membership.created">
                        membership.created
                      </SelectItem>
                      <SelectItem value="membership.updated">
                        membership.updated
                      </SelectItem>
                      <SelectItem value="membership.suspended">
                        membership.suspended
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <FormStatusMessage
              id="trigger-config-status"
              message={feedback?.message}
              tone={feedback?.tone}
              className="mt-5"
            />

            {canEdit ? (
              <div className="mt-6 flex justify-end">
                <Button
                  type="button"
                  className="premium-gradient rounded-xl"
                  disabled={submitting}
                  onClick={handleSave}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save trigger draft
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </section>

          <WorkflowTriggerAttempts attempts={triggerDetails.recentAttempts} />
        </div>

        <aside className="space-y-6">
          <section className="glass-panel rounded-[1.75rem] p-6">
            <p className="label-caps">Published binding</p>
            <h2 className="mt-2 text-xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
              Current production trigger
            </h2>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Source</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {triggerDetails.trigger.sourceType ?? "Not published"}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Version</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {triggerDetails.publishedVersionNumber
                    ? `v${triggerDetails.publishedVersionNumber}`
                    : "Publish required"}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Binding state</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {triggerDetails.trigger.hasPublishedBinding ? (
                    <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Active
                    </span>
                  ) : (
                    "Publish a draft to activate"
                  )}
                </p>
              </div>
            </div>
          </section>

          {trigger.type === "webhook" ? (
            <section className="glass-panel rounded-[1.75rem] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <Webhook className="h-5 w-5" />
                </div>
                <div>
                  <p className="label-caps">Webhook endpoint</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                    API key protected delivery
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--on-surface-variant)]">
                Endpoint path:{" "}
                <span className="font-mono text-[var(--on-surface)]">
                  {endpointPath || "Set a request path in the draft"}
                </span>
              </p>
              <div className="mt-5">
                <Button asChild variant="outline" className="rounded-xl">
                  <Link
                    href={`/org/${orgSlug}/workflows/${workflowId}/webhook`}
                  >
                    Open webhook details
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </section>
          ) : (
            <section className="glass-panel rounded-[1.75rem] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <Radio className="h-5 w-5" />
                </div>
                <div>
                  <p className="label-caps">Routing notes</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                    Trigger source behavior
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--on-surface-variant)]">
                {trigger.type === "manual"
                  ? "Manual triggers create runs only when called from the secured workspace API."
                  : "Internal events fan out from the private ingestion route to every published workflow subscribed to that event key."}
              </p>
            </section>
          )}
        </aside>
      </section>
    </div>
  );
}
