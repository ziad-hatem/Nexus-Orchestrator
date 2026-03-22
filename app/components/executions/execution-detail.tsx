import Link from "next/link";
import { Activity, ArrowRight, Clock3, GitCommitHorizontal, PlayCircle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { CancelRunDialog } from "@/app/components/executions/cancel-run-dialog";
import { ExecutionStepTimeline } from "@/app/components/executions/execution-step-timeline";
import { WorkflowToolbar } from "@/app/components/workflows/workflow-toolbar";
import type { WorkflowRunDetail } from "@/lib/server/workflows/types";

type ExecutionDetailProps = {
  orgSlug: string;
  detail: WorkflowRunDetail;
  canCancelRuns: boolean;
};

export function ExecutionDetail({
  orgSlug,
  detail,
  canCancelRuns,
}: ExecutionDetailProps) {
  const isTerminal = ["success", "failed", "cancelled"].includes(detail.status);

  return (
    <div className="space-y-8">
      <WorkflowToolbar
        title={detail.runId}
        description="Inspect lifecycle transitions, persisted step records, and the exact workflow version bound to this execution."
        backHref={`/org/${orgSlug}/executions`}
        backLabel="Back to executions"
        actions={
          <>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/org/${orgSlug}/workflows/${detail.workflowId}`}>
                <GitCommitHorizontal className="h-4 w-4" />
                Open workflow
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/org/${orgSlug}/workflows/${detail.workflowId}/versions/${detail.workflowVersionNumber}`}>
                <ArrowRight className="h-4 w-4" />
                View v{detail.workflowVersionNumber}
              </Link>
            </Button>
            {canCancelRuns && !isTerminal ? (
              <CancelRunDialog orgSlug={orgSlug} runId={detail.runId} />
            ) : null}
          </>
        }
      />

      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(11,28,48,0.98),rgba(0,95,158,0.88))] px-6 py-7 text-white shadow-[0_18px_48px_rgba(11,28,48,0.2)] sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="label-caps text-[rgba(255,255,255,0.72)]">Status</p>
            <p className="mt-3 text-3xl font-bold capitalize">{detail.status}</p>
          </div>
          <div>
            <p className="label-caps text-[rgba(255,255,255,0.72)]">Correlation id</p>
            <p className="mt-3 text-sm font-semibold">{detail.correlationId}</p>
          </div>
          <div>
            <p className="label-caps text-[rgba(255,255,255,0.72)]">Attempt</p>
            <p className="mt-3 text-3xl font-bold">
              {detail.attemptCount} / {detail.maxAttempts}
            </p>
          </div>
          <div>
            <p className="label-caps text-[rgba(255,255,255,0.72)]">Trigger source</p>
            <p className="mt-3 text-3xl font-bold capitalize">{detail.triggerSource}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
        <div className="space-y-6">
          <ExecutionStepTimeline steps={detail.steps} />

          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <PlayCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="label-caps">Run payload</p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                  Bound trigger input
                </h2>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-[#0b1c30] p-5">
              <pre className="overflow-x-auto text-xs text-blue-100">
                {JSON.stringify(detail.payload, null, 2)}
              </pre>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="glass-panel rounded-[1.75rem] p-6">
            <p className="label-caps">Run metadata</p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Workflow</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">{detail.workflowName}</p>
                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">{detail.workflowId}</p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Version</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">v{detail.workflowVersionNumber}</p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Created</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">{detail.createdAt}</p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Started</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">{detail.startedAt ?? "Waiting for worker"}</p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Completed</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">{detail.completedAt ?? "Still active"}</p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="label-caps">Cancel request</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">{detail.cancelRequestedAt ?? "Not requested"}</p>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-[1.75rem] p-6">
            <p className="label-caps">Source context</p>
            <div className="mt-5 rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
              <pre className="overflow-x-auto text-xs text-[var(--on-surface)]">
                {JSON.stringify(detail.sourceContext, null, 2)}
              </pre>
            </div>
          </section>

          {detail.failureMessage ? (
            <section className="glass-panel rounded-[1.75rem] p-6">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-destructive" />
                <div>
                  <p className="label-caps">Failure state</p>
                  <h2 className="mt-2 text-xl font-bold text-[var(--on-surface)]">
                    Last failure
                  </h2>
                </div>
              </div>
              <div className="mt-4 rounded-[1.5rem] bg-[var(--error-container)]/70 p-4 text-sm text-[var(--error)]">
                <p>{detail.failureMessage}</p>
                {detail.failureCode ? (
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em]">
                    {detail.failureCode}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="glass-panel rounded-[1.75rem] p-6">
            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-primary" />
              <div>
                <p className="label-caps">Validation snapshot</p>
                <h2 className="mt-2 text-xl font-bold text-[var(--on-surface)]">
                  Published version checks
                </h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {detail.versionValidationIssues.length > 0 ? (
                detail.versionValidationIssues.map((issue) => (
                  <div
                    key={`${issue.path}:${issue.code}`}
                    className="rounded-2xl bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]"
                  >
                    {issue.message}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]">
                  No validation issues were stored for this published version.
                </div>
              )}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
