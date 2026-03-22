import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { WorkflowToolbar } from "@/app/components/workflows/workflow-toolbar";
import type { WorkflowRunSummary } from "@/lib/server/workflows/types";

type ExecutionDirectoryProps = {
  orgSlug: string;
  items: WorkflowRunSummary[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    query?: string;
    status?: WorkflowRunSummary["status"];
    source?: WorkflowRunSummary["triggerSource"];
    workflowId?: string;
  };
};

function buildHref(
  orgSlug: string,
  filters: ExecutionDirectoryProps["filters"],
  page: number,
) {
  const searchParams = new URLSearchParams();
  if (filters.query) searchParams.set("query", filters.query);
  if (filters.status) searchParams.set("status", filters.status);
  if (filters.source) searchParams.set("source", filters.source);
  if (filters.workflowId) searchParams.set("workflowId", filters.workflowId);
  searchParams.set("page", String(page));
  return `/org/${orgSlug}/executions?${searchParams.toString()}`;
}

export function ExecutionDirectory({
  orgSlug,
  items,
  total,
  page,
  pageSize,
  filters,
}: ExecutionDirectoryProps) {
  const runningCount = items.filter((item) => item.status === "running").length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const retryingCount = items.filter((item) => item.status === "retrying").length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-8">
      <WorkflowToolbar
        title="Executions"
        description="Inspect queued, running, retried, failed, and cancelled workflow runs with version-locked execution context."
        backHref={`/org/${orgSlug}`}
        backLabel="Back to dashboard"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass-panel rounded-[1.5rem] p-5">
          <p className="label-caps">Total runs</p>
          <p className="mt-3 text-3xl font-bold text-[var(--on-surface)]">{total}</p>
        </div>
        <div className="glass-panel rounded-[1.5rem] p-5">
          <p className="label-caps">Running</p>
          <p className="mt-3 text-3xl font-bold text-primary">{runningCount}</p>
        </div>
        <div className="glass-panel rounded-[1.5rem] p-5">
          <p className="label-caps">Retrying</p>
          <p className="mt-3 text-3xl font-bold text-amber-500">{retryingCount}</p>
        </div>
        <div className="glass-panel rounded-[1.5rem] p-5">
          <p className="label-caps">Failed</p>
          <p className="mt-3 text-3xl font-bold text-destructive">{failedCount}</p>
        </div>
      </section>

      <section className="glass-panel rounded-[1.75rem] p-6">
        <form className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_14rem_14rem_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-variant)]" />
            <input
              type="text"
              name="query"
              defaultValue={filters.query ?? ""}
              placeholder="Search by run id, workflow, or correlation id"
              className="input-field h-12 w-full border-0 pl-10 shadow-none"
            />
          </div>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="input-field h-12 w-full border-0 shadow-none"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="retrying">Retrying</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            name="source"
            defaultValue={filters.source ?? ""}
            className="input-field h-12 w-full border-0 shadow-none"
          >
            <option value="">All sources</option>
            <option value="manual">Manual</option>
            <option value="webhook">Webhook</option>
            <option value="internal_event">Internal event</option>
          </select>
          <div className="flex gap-3">
            <Button type="submit" className="premium-gradient rounded-xl">
              Apply filters
            </Button>
            <Button asChild type="button" variant="outline" className="rounded-xl">
              <Link href={`/org/${orgSlug}/executions`}>Reset</Link>
            </Button>
          </div>
        </form>
      </section>

      <section className="glass-panel rounded-[1.75rem] p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:color-mix(in_srgb,var(--outline-variant)_24%,transparent)]">
            <thead>
              <tr className="text-left">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">Run</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">Workflow</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">Status</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">Trigger</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">Version</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">Created</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:color-mix(in_srgb,var(--outline-variant)_16%,transparent)]">
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.runId}>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[var(--on-surface)]">{item.runId}</p>
                      <p className="mt-1 text-xs text-[var(--on-surface-variant)]">{item.correlationId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[var(--on-surface)]">{item.workflowName}</p>
                      <p className="mt-1 text-xs text-[var(--on-surface-variant)]">{item.workflowId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-xs font-semibold capitalize text-[var(--on-surface)]">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--on-surface-variant)]">{item.triggerSource}</td>
                    <td className="px-6 py-4 text-sm text-[var(--on-surface-variant)]">v{item.workflowVersionNumber}</td>
                    <td className="px-6 py-4 text-sm text-[var(--on-surface-variant)]">{item.createdAt}</td>
                    <td className="px-6 py-4 text-right">
                      <Button asChild variant="outline" className="rounded-xl">
                        <Link href={`/org/${orgSlug}/executions/${item.runId}`}>
                          View details
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center text-sm text-[var(--on-surface-variant)]">
                    No executions matched the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-[color:color-mix(in_srgb,var(--outline-variant)_24%,transparent)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--on-surface-variant)]">
            Showing page {page} of {lastPage}
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="rounded-xl" disabled={page <= 1}>
              <Link href={buildHref(orgSlug, filters, Math.max(1, page - 1))}>Previous</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl" disabled={page >= lastPage}>
              <Link href={buildHref(orgSlug, filters, Math.min(lastPage, page + 1))}>Next</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
