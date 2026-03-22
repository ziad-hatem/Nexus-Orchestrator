import Link from "next/link";
import { GitCommitHorizontal } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { WorkflowCanvasVisual } from "@/app/components/workflows/workflow-canvas-visual";
import { WorkflowToolbar } from "@/app/components/workflows/workflow-toolbar";
import { WorkflowValidationPanel } from "@/app/components/workflows/workflow-validation-panel";
import type { WorkflowPublishedSnapshot } from "@/lib/server/workflows/types";

type WorkflowVersionViewerProps = {
  orgSlug: string;
  workflowId: string;
  workflowName: string;
  snapshot: WorkflowPublishedSnapshot;
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

export function WorkflowVersionViewer({
  orgSlug,
  workflowId,
  workflowName,
  snapshot,
}: WorkflowVersionViewerProps) {
  return (
    <div className="space-y-8">
      <WorkflowToolbar
        title={`${workflowName} · v${snapshot.versionNumber}`}
        description="This is a read-only immutable snapshot. Published versions never change after release."
        backHref={`/org/${orgSlug}/workflows/${workflowId}/history`}
        backLabel="Back to history"
        actions={
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={`/org/${orgSlug}/workflows/${workflowId}`}>
              <GitCommitHorizontal className="h-4 w-4" />
              Workflow overview
            </Link>
          </Button>
        }
      />

      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(11,28,48,0.98),rgba(0,95,158,0.88))] px-6 py-7 text-white shadow-[0_18px_48px_rgba(11,28,48,0.2)] sm:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)]">
          <div>
            <p className="label-caps text-[rgba(255,255,255,0.72)]">
              Published snapshot
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white">
              Version v{snapshot.versionNumber}
            </h1>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.82)]">
              {snapshot.metadata.description || "No description was captured for this published version."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(255,255,255,0.68)]">
                Published at
              </p>
              <p className="mt-2 text-sm font-semibold">
                {formatDateTime(snapshot.publishedAt)}
              </p>
            </div>
            <div className="rounded-2xl bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(255,255,255,0.68)]">
                Published by
              </p>
              <p className="mt-2 text-sm font-semibold">
                {snapshot.publishedBy?.name ??
                  snapshot.publishedBy?.email ??
                  "Unknown"}
              </p>
            </div>
            <div className="rounded-2xl bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(255,255,255,0.68)]">
                Category
              </p>
              <p className="mt-2 text-sm font-semibold">
                {snapshot.metadata.category}
              </p>
            </div>
          </div>
        </div>
      </section>

      <WorkflowCanvasVisual canvas={snapshot.canvas} readOnly />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,0.85fr)]">
        <div className="space-y-6">
          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <p className="label-caps">Release notes</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
              What changed in this version
            </h2>
            <div className="mt-6 rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
              <p className="text-sm leading-7 text-[var(--on-surface-variant)]">
                {snapshot.notes || "No release notes were recorded for this version."}
              </p>
            </div>
          </section>

          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <p className="label-caps">Snapshot metadata</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Trigger</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {snapshot.config.trigger?.label || "No trigger"}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Conditions</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {snapshot.config.conditions.length}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Actions</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {snapshot.config.actions.length}
                </p>
              </div>
            </div>
          </section>
        </div>

        <WorkflowValidationPanel
          issues={snapshot.validationIssues}
          title="Captured validation results"
          description="These results were stored at publish time alongside the immutable version."
        />
      </section>
    </div>
  );
}
