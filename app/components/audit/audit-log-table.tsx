import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { AuditLogDetailsDialog } from "@/app/components/audit/audit-log-details-dialog";
import { Button } from "@/app/components/ui/button";
import {
  FilterToolbar,
  type FilterSelectConfig,
} from "@/app/components/ui/filter-toolbar";
import type {
  AuditLogSummary,
  AuditLogWithActor,
} from "@/lib/server/audit-log";

type AuditLogTableProps = {
  orgSlug: string;
  logs: AuditLogWithActor[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    query?: string;
    action?: string;
  };
  availableActions: string[];
  summary: AuditLogSummary;
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

function formatMetadata(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata ?? {}).slice(0, 3);
  if (entries.length === 0) {
    return "No metadata";
  }

  return entries
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" | ");
}

function buildPageHref(params: {
  orgSlug: string;
  page: number;
  pageSize: number;
  query?: string;
  action?: string;
}): string {
  const searchParams = new URLSearchParams();
  if (params.query) {
    searchParams.set("query", params.query);
  }
  if (params.action) {
    searchParams.set("action", params.action);
  }
  if (params.page > 1) {
    searchParams.set("page", String(params.page));
  }
  if (params.pageSize !== 20) {
    searchParams.set("pageSize", String(params.pageSize));
  }

  const query = searchParams.toString();
  return `/org/${params.orgSlug}/audit${query ? `?${query}` : ""}`;
}

export function AuditLogTable({
  orgSlug,
  logs,
  total,
  page,
  pageSize,
  filters,
  availableActions,
  summary,
}: AuditLogTableProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const canGoBack = page > 1;
  const canGoForward = page < pageCount;
  const filterSelects: FilterSelectConfig[] = [
    {
      key: "action",
      label: "Filter audit events by action",
      placeholder: "All actions",
      value: filters.action,
      icon: "filter",
      options: [
        { label: "All actions", value: "" },
        ...availableActions.map((action) => ({
          label: action,
          value: action,
        })),
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(11,28,48,0.98),rgba(0,95,158,0.88))] px-6 py-7 text-white shadow-[0_18px_48px_rgba(11,28,48,0.2)] sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="label-caps text-[rgba(255,255,255,0.72)]">Audit trail</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white">
              Organization security and admin activity
            </h1>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.82)]">
              Search, filter, and review role changes, invites, and administrative mutations for this tenant.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(255,255,255,0.68)]">
                Matching events
              </p>
              <p className="mt-2 text-2xl font-bold">{total}</p>
            </div>
            <div className="rounded-2xl bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(255,255,255,0.68)]">
                Unique actors
              </p>
              <p className="mt-2 text-2xl font-bold">{summary.uniqueActorCount}</p>
            </div>
            <div className="rounded-2xl bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(255,255,255,0.68)]">
                Coverage
              </p>
              <p className="mt-2 text-2xl font-bold">
                {summary.coverage.coveredCount}/{summary.coverage.totalRequired}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
          <p className="label-caps">Top actions</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {summary.topActions.length > 0 ? (
              summary.topActions.map((item) => (
                <div
                  key={item.action}
                  className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-3"
                >
                  <p className="label-caps">{item.action}</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {item.count} event{item.count === 1 ? "" : "s"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
                No matching audit actions yet.
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
          <p className="label-caps">Coverage gaps</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {summary.coverage.missingActions.length > 0 ? (
              summary.coverage.missingActions.map((action) => (
                <div
                  key={action}
                  className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-3"
                >
                  <p className="text-sm font-semibold text-[var(--on-surface)]">
                    {action}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
                All required privileged audit actions are represented in this dataset.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
        <FilterToolbar
          key={`audit-filters:${filters.query ?? ""}:${filters.action ?? ""}`}
          className="xl:grid-cols-[minmax(0,1.6fr)_minmax(14rem,0.8fr)_auto]"
          resetHref={`/org/${orgSlug}/audit`}
          search={{
            label: "Search audit events",
            placeholder: "Search action, entity, or metadata",
            value: filters.query,
          }}
          selects={filterSelects}
          submitLabel="Apply filters"
        />
      </section>

      <section className="glass-panel overflow-hidden rounded-[1.75rem]">
        <div className="flex items-center justify-between border-b border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] px-5 py-5 sm:px-6">
          <div>
            <p className="label-caps">Latest events</p>
            <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
              Activity feed
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--on-surface-variant)]">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Tenant-scoped server logs
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <h3 className="text-xl font-bold text-[var(--on-surface)]">
              No audit events matched the current filters
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--on-surface-variant)]">
              Broaden the filter set or perform an administrative action to populate this view.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[rgba(192,199,211,0.14)]">
              <caption className="sr-only">
                Audit log events for the current organization including actors, actions, and request context.
              </caption>
              <thead className="bg-[var(--surface-container-low)]/60">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                    Time
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                    Actor
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                    Action
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                    Entity
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                    Context
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(192,199,211,0.14)]">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top transition-colors hover:bg-[var(--surface-container-low)]/45">
                    <th scope="row" className="px-6 py-5 text-left text-sm font-normal text-[var(--on-surface-variant)]">
                      {formatDateTime(log.created_at)}
                    </th>
                    <td className="px-6 py-5">
                      <p className="text-sm font-semibold text-[var(--on-surface)]">
                        {log.actor?.name ?? log.actor?.email ?? "System"}
                      </p>
                      <p className="text-xs text-[var(--on-surface-variant)]">
                        {log.actor?.email ?? "Internal action"}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <span className="inline-flex rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-3 py-1 text-xs font-semibold text-primary">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm text-[var(--on-surface)]">
                      <p className="font-semibold">{log.entity_type ?? "system"}</p>
                      <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                        {log.entity_id ?? "No entity id"}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm text-[var(--on-surface-variant)]">
                        {formatMetadata(log.metadata)}
                      </p>
                      <AuditLogDetailsDialog
                        action={log.action}
                        createdAt={log.created_at}
                        actorName={log.actor?.name ?? null}
                        actorEmail={log.actor?.email ?? null}
                        entityType={log.entity_type ?? null}
                        entityId={log.entity_id ?? null}
                        ipAddress={log.ip_address ?? null}
                        userAgent={log.user_agent ?? null}
                        metadata={log.metadata}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-[var(--on-surface-variant)]">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-3">
            <Button
              asChild={canGoBack}
              variant="outline"
              className="rounded-xl"
              disabled={!canGoBack}
            >
              {canGoBack ? (
                <Link
                  href={buildPageHref({
                    orgSlug,
                    page: page - 1,
                    pageSize,
                    query: filters.query,
                    action: filters.action,
                  })}
                >
                  Previous
                </Link>
              ) : (
                <span>Previous</span>
              )}
            </Button>
            <Button
              asChild={canGoForward}
              className="premium-gradient rounded-xl"
              disabled={!canGoForward}
            >
              {canGoForward ? (
                <Link
                  href={buildPageHref({
                    orgSlug,
                    page: page + 1,
                    pageSize,
                    query: filters.query,
                    action: filters.action,
                  })}
                >
                  Next
                </Link>
              ) : (
                <span>Next</span>
              )}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
