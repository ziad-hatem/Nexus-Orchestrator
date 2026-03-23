import Link from "next/link";
import { AlertRulesPanel } from "@/app/components/operations/alert-rules-panel";
import { QueueBacklogCard } from "@/app/components/operations/queue-backlog-card";
import { ReadinessChecklist } from "@/app/components/operations/readiness-checklist";
import { Button } from "@/app/components/ui/button";
import { WorkflowToolbar } from "@/app/components/workflows/workflow-toolbar";
import type { OperationsDashboardData } from "@/lib/server/operations/types";

export function OperationsDashboard({
  orgSlug,
  data,
}: {
  orgSlug: string;
  data: OperationsDashboardData;
}) {
  return (
    <div className="space-y-8">
      <WorkflowToolbar
        title="Operations"
        description="Monitor queue backlog, retry pressure, webhook security outcomes, audit coverage, and pilot readiness from one tenant-scoped surface."
        backHref={`/org/${orgSlug}`}
        backLabel="Back to dashboard"
        actions={
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={`/org/${orgSlug}/audit`}>Open audit trail</Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass-panel rounded-[1.5rem] p-5">
          <p className="label-caps">Runs</p>
          <p className="mt-3 text-3xl font-bold text-[var(--on-surface)]">
            {data.metrics.runs.total}
          </p>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            Pending {data.metrics.runs.pending} | Running {data.metrics.runs.running}
          </p>
        </div>
        <div className="glass-panel rounded-[1.5rem] p-5">
          <p className="label-caps">Webhook accepted</p>
          <p className="mt-3 text-3xl font-bold text-emerald-600">
            {data.metrics.webhooks.accepted}
          </p>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            Last {data.lookbackMinutes} minutes
          </p>
        </div>
        <div className="glass-panel rounded-[1.5rem] p-5">
          <p className="label-caps">Webhook rejected</p>
          <p className="mt-3 text-3xl font-bold text-destructive">
            {data.metrics.webhooks.rejected}
          </p>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            Duplicate {data.metrics.webhooks.duplicate} | Rate-limited {data.metrics.webhooks.rateLimited}
          </p>
        </div>
        <div className="glass-panel rounded-[1.5rem] p-5">
          <p className="label-caps">Audit coverage</p>
          <p className="mt-3 text-3xl font-bold text-[var(--on-surface)]">
            {data.metrics.audit.coverage.coveredCount}/{data.metrics.audit.coverage.totalRequired}
          </p>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            Required privileged actions observed
          </p>
        </div>
      </section>

      <QueueBacklogCard queue={data.queue} />
      <AlertRulesPanel alerts={data.alerts} />

      <section className="glass-panel rounded-[1.75rem] p-6">
        <p className="label-caps">Failure summary</p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
          Top run failures
        </h2>

        <div className="mt-5 flex flex-wrap gap-3">
          {data.metrics.topFailureCodes.length > 0 ? (
            data.metrics.topFailureCodes.map((item) => (
              <div
                key={item.failureCode}
                className="rounded-[1.35rem] bg-[var(--surface-container-low)] px-4 py-4"
              >
                <p className="label-caps">{item.failureCode}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {item.count} run{item.count === 1 ? "" : "s"}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-[1.35rem] bg-[var(--surface-container-low)] px-4 py-4 text-sm text-[var(--on-surface-variant)]">
              No failed runs were found in the current tenant snapshot.
            </div>
          )}
        </div>
      </section>

      <section className="glass-panel rounded-[1.75rem] p-6">
        <p className="label-caps">Retention policy</p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
          Cleanup schedule
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.35rem] bg-[var(--surface-container-low)] p-4">
            <p className="label-caps">Audit logs</p>
            <p className="mt-2 text-xl font-bold text-[var(--on-surface)]">
              {data.retention.auditLogDays} days
            </p>
          </div>
          <div className="rounded-[1.35rem] bg-[var(--surface-container-low)] p-4">
            <p className="label-caps">Execution logs</p>
            <p className="mt-2 text-xl font-bold text-[var(--on-surface)]">
              {data.retention.executionLogDays} days
            </p>
          </div>
          <div className="rounded-[1.35rem] bg-[var(--surface-container-low)] p-4">
            <p className="label-caps">Ingestion events</p>
            <p className="mt-2 text-xl font-bold text-[var(--on-surface)]">
              {data.retention.ingestionEventDays} days
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-[1.35rem] bg-[#0b1c30] p-5 text-xs text-blue-100">
          <p>{data.retention.dryRunCommand}</p>
          <p className="mt-2">{data.retention.applyCommand}</p>
        </div>
      </section>

      <ReadinessChecklist checklist={data.checklist} />
    </div>
  );
}
