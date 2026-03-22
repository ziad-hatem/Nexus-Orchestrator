import Link from "next/link";
import {
  Activity,
  Archive,
  ArrowRight,
  ClipboardList,
  GitCommitHorizontal,
  PencilLine,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { WorkflowArchiveDialog } from "@/app/components/workflows/workflow-archive-dialog";
import { WorkflowManualTriggerDialog } from "@/app/components/workflows/workflow-manual-trigger-dialog";
import { WorkflowToolbar } from "@/app/components/workflows/workflow-toolbar";
import { WorkflowValidationPanel } from "@/app/components/workflows/workflow-validation-panel";
import type {
  WorkflowDetail as WorkflowDetailModel,
  WorkflowTriggerDetails,
} from "@/lib/server/workflows/types";

type WorkflowDetailProps = {
  orgSlug: string;
  detail: WorkflowDetailModel;
  triggerDetails: WorkflowTriggerDetails | null;
  canEditWorkflows: boolean;
  canArchiveWorkflows: boolean;
  canTriggerWorkflows: boolean;
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: WorkflowDetailModel["status"]): string {
  switch (status) {
    case "draft_only":
      return "Draft only";
    case "published":
      return "Published";
    case "published_with_draft":
      return "Published with draft";
    case "archived":
    default:
      return "Archived";
  }
}

function statusClasses(status: WorkflowDetailModel["status"]): string {
  switch (status) {
    case "draft_only":
      return "bg-amber-500/12 text-amber-800 dark:text-amber-200";
    case "published":
      return "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200";
    case "published_with_draft":
      return "bg-primary/12 text-primary";
    case "archived":
    default:
      return "bg-slate-500/12 text-slate-700 dark:text-slate-200";
  }
}

export function WorkflowDetail({
  orgSlug,
  detail,
  triggerDetails,
  canEditWorkflows,
  canArchiveWorkflows,
  canTriggerWorkflows,
}: WorkflowDetailProps) {
  const draftHref = `/org/${orgSlug}/workflows/${detail.workflowId}/draft`;
  const historyHref = `/org/${orgSlug}/workflows/${detail.workflowId}/history`;
  const currentVersionHref = detail.latestVersionNumber
    ? `/org/${orgSlug}/workflows/${detail.workflowId}/versions/${detail.latestVersionNumber}`
    : null;
  const triggerHref = `/org/${orgSlug}/workflows/${detail.workflowId}/trigger`;
  const webhookHref = `/org/${orgSlug}/workflows/${detail.workflowId}/webhook`;

  return (
    <div className="space-y-8">
      <WorkflowToolbar
        title={detail.name}
        description="Inspect the safe draft, immutable version history, and current lifecycle state for this workflow."
        backHref={`/org/${orgSlug}/workflows`}
        backLabel="Back to workflows"
        actions={
          <>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={historyHref}>
                <ClipboardList className="h-4 w-4" />
                Version history
              </Link>
            </Button>
            {canEditWorkflows && detail.status !== "archived" ? (
              <Button asChild className="premium-gradient rounded-xl">
                <Link href={draftHref}>
                  <PencilLine className="h-4 w-4" />
                  {detail.hasDraft ? "Continue draft" : "Edit draft"}
                </Link>
              </Button>
            ) : null}
            {triggerDetails?.canTriggerManually && canTriggerWorkflows ? (
              <WorkflowManualTriggerDialog
                orgSlug={orgSlug}
                workflowId={detail.workflowId}
                workflowName={detail.name}
                disabled={detail.status === "archived"}
              />
            ) : null}
            {canArchiveWorkflows && detail.status !== "archived" ? (
              <WorkflowArchiveDialog
                orgSlug={orgSlug}
                workflowId={detail.workflowId}
                workflowName={detail.name}
                triggerLabel="Archive"
                triggerVariant="outline"
                triggerClassName="rounded-xl"
              />
            ) : null}
          </>
        }
      />

      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(11,28,48,0.98),rgba(0,95,158,0.88))] px-6 py-7 text-white shadow-[0_18px_48px_rgba(11,28,48,0.2)] sm:px-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="label-caps text-[rgba(255,255,255,0.72)]">
              Workflow lifecycle
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-[-0.03em] text-white">
                {detail.name}
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(detail.status)}`}
              >
                {statusLabel(detail.status)}
              </span>
            </div>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.82)]">
              {detail.description || "No description has been added yet."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(255,255,255,0.68)]">
                Latest version
              </p>
              <p className="mt-2 text-2xl font-bold">
                {detail.latestVersionNumber ? `v${detail.latestVersionNumber}` : "None"}
              </p>
            </div>
            <div className="rounded-2xl bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(255,255,255,0.68)]">
                Version count
              </p>
              <p className="mt-2 text-2xl font-bold">{detail.versionCount}</p>
            </div>
            <div className="rounded-2xl bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(255,255,255,0.68)]">
                Active draft
              </p>
              <p className="mt-2 text-2xl font-bold">
                {detail.hasDraft ? "Open" : "None"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(21rem,0.85fr)]">
        <div className="space-y-6">
          {detail.hasDraft ? (
            <WorkflowValidationPanel
              issues={detail.validationIssues}
              title="Active draft validation"
              description="These checks reflect the currently editable draft, not the last published snapshot."
            />
          ) : null}

          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <p className="label-caps">Workflow definition</p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                  Current metadata
                </h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Workflow id</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {detail.workflowId}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Category</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {detail.category}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Archived at</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {formatDateTime(detail.archivedAt)}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
              <p className="label-caps">Description</p>
              <p className="mt-3 text-sm leading-7 text-[var(--on-surface-variant)]">
                {detail.description || "No description has been recorded for this workflow yet."}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {detail.tags.length > 0 ? (
                detail.tags.map((tag) => (
                  <span
                    key={`${detail.workflowId}:${tag}`}
                    className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-xs font-semibold text-[var(--on-surface-variant)]"
                  >
                    #{tag}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-xs font-semibold text-[var(--on-surface-variant)]">
                  No tags
                </span>
              )}
            </div>
          </section>

          {detail.latestPublishedSnapshot ? (
            <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="label-caps">Published snapshot</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                    Production version v{detail.latestPublishedSnapshot.versionNumber}
                  </h2>
                </div>
                {currentVersionHref ? (
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link href={currentVersionHref}>
                      Open snapshot
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                  <p className="label-caps">Published at</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {formatDateTime(detail.latestPublishedSnapshot.publishedAt)}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                  <p className="label-caps">Published by</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {detail.latestPublishedSnapshot.publishedBy?.name ??
                      detail.latestPublishedSnapshot.publishedBy?.email ??
                      "Unknown"}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                  <p className="label-caps">Validation issues</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {detail.latestPublishedSnapshot.validationIssues.length}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
                <p className="label-caps">Release notes</p>
                <p className="mt-3 text-sm leading-7 text-[var(--on-surface-variant)]">
                  {detail.latestPublishedSnapshot.notes ||
                    "No release notes were supplied for this version."}
                </p>
              </div>
            </section>
          ) : null}

          {triggerDetails ? (
            <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="label-caps">Published trigger</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                    Phase three ingestion contract
                  </h2>
                </div>
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href={triggerHref}>
                    Open trigger config
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                  <p className="label-caps">Source</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {triggerDetails.trigger.sourceType ?? "Not published"}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                  <p className="label-caps">Binding</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {triggerDetails.trigger.hasPublishedBinding
                      ? "Active"
                      : "Publish required"}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                  <p className="label-caps">Recent attempts</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {triggerDetails.recentAttempts.length}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
                <p className="label-caps">Trigger summary</p>
                <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                  {triggerDetails.trigger.description ||
                    "No published trigger description is available yet."}
                </p>
                {triggerDetails.trigger.webhook?.endpointPath ? (
                  <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
                    Endpoint path:{" "}
                    <span className="font-mono text-[var(--on-surface)]">
                      {triggerDetails.trigger.webhook.endpointPath}
                    </span>
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section className="glass-panel rounded-[1.75rem] p-6">
            <p className="label-caps">Lifecycle summary</p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Created</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {formatDateTime(detail.createdAt)}
                </p>
                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                  {detail.createdBy?.name ?? detail.createdBy?.email ?? "Unknown"}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Draft updated</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {formatDateTime(detail.draftUpdatedAt)}
                </p>
                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                  {detail.draftUpdatedBy?.name ??
                    detail.draftUpdatedBy?.email ??
                    "No active draft"}
                </p>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-[1.75rem] p-6">
            <p className="label-caps">Quick routes</p>
            <div className="mt-5 grid gap-3">
              {canEditWorkflows && detail.status !== "archived" ? (
                <Button asChild variant="outline" className="justify-start rounded-xl">
                  <Link href={draftHref}>
                    <PencilLine className="h-4 w-4" />
                    {detail.hasDraft ? "Continue draft" : "Create draft"}
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" className="justify-start rounded-xl">
                <Link href={historyHref}>
                  <GitCommitHorizontal className="h-4 w-4" />
                  Open version history
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start rounded-xl">
                <Link href={triggerHref}>
                  <Activity className="h-4 w-4" />
                  Open trigger config
                </Link>
              </Button>
              {triggerDetails?.trigger.sourceType === "webhook" ? (
                <Button asChild variant="outline" className="justify-start rounded-xl">
                  <Link href={webhookHref}>
                    <Archive className="h-4 w-4" />
                    Webhook details
                  </Link>
                </Button>
              ) : null}
              {triggerDetails?.canTriggerManually && canTriggerWorkflows ? (
                <WorkflowManualTriggerDialog
                  orgSlug={orgSlug}
                  workflowId={detail.workflowId}
                  workflowName={detail.name}
                  disabled={detail.status === "archived"}
                />
              ) : null}
              {currentVersionHref ? (
                <Button asChild variant="outline" className="justify-start rounded-xl">
                  <Link href={currentVersionHref}>
                    <Archive className="h-4 w-4" />
                    View current snapshot
                  </Link>
                </Button>
              ) : null}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
