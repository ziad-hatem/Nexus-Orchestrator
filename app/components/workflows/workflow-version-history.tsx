import Link from "next/link";
import { ArrowRight, GitCommitHorizontal, PencilLine } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { WorkflowToolbar } from "@/app/components/workflows/workflow-toolbar";
import type {
  WorkflowDetail,
  WorkflowVersionSummary,
} from "@/lib/server/workflows/types";

type WorkflowVersionHistoryProps = {
  orgSlug: string;
  workflow: WorkflowDetail;
  versions: WorkflowVersionSummary[];
  canEditWorkflows: boolean;
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

export function WorkflowVersionHistory({
  orgSlug,
  workflow,
  versions,
  canEditWorkflows,
}: WorkflowVersionHistoryProps) {
  return (
    <div className="space-y-8">
      <WorkflowToolbar
        title={`${workflow.name} version history`}
        description="Published versions are immutable snapshots. Reviewing history here never mutates the active production definition."
        backHref={`/org/${orgSlug}/workflows/${workflow.workflowId}`}
        backLabel="Back to workflow"
        actions={
          canEditWorkflows && workflow.status !== "archived" ? (
            <Button asChild className="premium-gradient rounded-xl">
              <Link href={`/org/${orgSlug}/workflows/${workflow.workflowId}/draft`}>
                <PencilLine className="h-4 w-4" />
                {workflow.hasDraft ? "Continue draft" : "Open draft editor"}
              </Link>
            </Button>
          ) : null
        }
      />

      <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <GitCommitHorizontal className="h-5 w-5 text-primary" />
          <div>
            <p className="label-caps">Immutable snapshots</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
              Published versions
            </h2>
          </div>
        </div>

        {versions.length === 0 ? (
          <div className="mt-6 rounded-[1.5rem] bg-[var(--surface-container-low)] px-5 py-6 text-sm text-[var(--on-surface-variant)]">
            This workflow has not been published yet, so there are no immutable versions to review.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {versions.map((version) => (
              <article
                key={`${version.workflowId}:v${version.versionNumber}`}
                className="rounded-[1.5rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] bg-[var(--surface-container-lowest)] p-5"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
                        v{version.versionNumber}
                      </span>
                      {version.isCurrent ? (
                        <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                          Current production
                        </span>
                      ) : null}
                      <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-xs font-semibold text-[var(--on-surface-variant)]">
                        {version.validationIssueCount} validation issue
                        {version.validationIssueCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-[var(--on-surface)]">
                      Published by{" "}
                      {version.publishedBy?.name ??
                        version.publishedBy?.email ??
                        "Unknown"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                      {formatDateTime(version.createdAt)}
                    </p>
                    <p className="mt-4 text-sm leading-6 text-[var(--on-surface-variant)]">
                      {version.notes || "No release notes were attached to this version."}
                    </p>
                  </div>
                  <Button asChild className="premium-gradient rounded-xl">
                    <Link
                      href={`/org/${orgSlug}/workflows/${workflow.workflowId}/versions/${version.versionNumber}`}
                    >
                      View snapshot
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
