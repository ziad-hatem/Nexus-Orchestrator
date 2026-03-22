import Link from "next/link";
import { Radio, SearchCode } from "lucide-react";
import {
  FilterToolbar,
  type FilterSelectConfig,
} from "@/app/components/ui/filter-toolbar";
import { Button } from "@/app/components/ui/button";
import type { WorkflowIngestionEventSummary } from "@/lib/server/workflows/types";

type WorkflowStreamTableProps = {
  orgSlug: string;
  items: WorkflowIngestionEventSummary[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    query?: string;
    source?: "manual" | "webhook" | "internal_event";
    status?: "accepted" | "rejected" | "duplicate" | "rate_limited";
    workflowId?: string;
    eventKey?: "ticket.created" | "payment.failed";
  };
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

function buildPageHref(params: {
  orgSlug: string;
  page: number;
  pageSize: number;
  query?: string;
  source?: string;
  status?: string;
  workflowId?: string;
  eventKey?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set("query", params.query);
  if (params.source) searchParams.set("source", params.source);
  if (params.status) searchParams.set("status", params.status);
  if (params.workflowId) searchParams.set("workflowId", params.workflowId);
  if (params.eventKey) searchParams.set("eventKey", params.eventKey);
  if (params.page > 1) searchParams.set("page", String(params.page));
  if (params.pageSize !== 20) searchParams.set("pageSize", String(params.pageSize));

  const query = searchParams.toString();
  return `/org/${params.orgSlug}/streams${query ? `?${query}` : ""}`;
}

export function WorkflowStreamTable({
  orgSlug,
  items,
  total,
  page,
  pageSize,
  filters,
}: WorkflowStreamTableProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const filterSelects: FilterSelectConfig[] = [
    {
      key: "source",
      label: "Filter streams by source type",
      placeholder: "All sources",
      value: filters.source,
      icon: "filter",
      options: [
        { label: "All sources", value: "" },
        { label: "Manual", value: "manual" },
        { label: "Webhook", value: "webhook" },
        { label: "Internal event", value: "internal_event" },
      ],
    },
    {
      key: "status",
      label: "Filter streams by ingestion status",
      placeholder: "All statuses",
      value: filters.status,
      icon: "shield",
      options: [
        { label: "All statuses", value: "" },
        { label: "Accepted", value: "accepted" },
        { label: "Rejected", value: "rejected" },
        { label: "Duplicate", value: "duplicate" },
        { label: "Rate limited", value: "rate_limited" },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(11,28,48,0.98),rgba(0,95,158,0.88))] px-6 py-7 text-white shadow-[0_18px_48px_rgba(11,28,48,0.2)] sm:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="label-caps text-[rgba(255,255,255,0.72)]">Event streams</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white">
              Track inbound trigger traffic across this organization
            </h1>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.82)]">
              Review accepted, rejected, duplicate, and rate-limited deliveries for manual runs, webhooks, and internal system events.
            </p>
          </div>
          <div className="rounded-full bg-emerald-500/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
            {total} captured events
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
        <FilterToolbar
          key={`streams-filters:${filters.query ?? ""}:${filters.source ?? ""}:${filters.status ?? ""}`}
          resetHref={`/org/${orgSlug}/streams`}
          search={{
            label: "Search streams by workflow, match key, event key, or error message",
            placeholder: "Search streams",
            value: filters.query,
          }}
          selects={filterSelects}
          submitLabel="Apply filters"
        />
      </section>

      <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
        {items.length === 0 ? (
          <div className="rounded-[1.5rem] bg-[var(--surface-container-low)] px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--surface-container-high)] text-primary">
              <SearchCode className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-[var(--on-surface)]">
              No trigger stream events matched these filters
            </h2>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <details
                key={item.eventId}
                className="rounded-[1.5rem] bg-[var(--surface-container-low)] p-5"
              >
                <summary className="flex cursor-pointer list-none flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
                        {item.sourceType}
                      </span>
                      <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-xs font-semibold text-[var(--on-surface-variant)]">
                        {item.status.replaceAll("_", " ")}
                      </span>
                      {item.eventKey ? (
                        <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-xs font-semibold text-[var(--on-surface-variant)]">
                          {item.eventKey}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <p className="text-sm font-semibold text-[var(--on-surface)]">
                        {item.workflowName}
                      </p>
                      <span className="text-xs text-[var(--on-surface-variant)]">
                        {item.workflowId}
                      </span>
                      <span className="text-xs text-[var(--on-surface-variant)]">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                      {item.matchKey}
                    </p>
                  </div>

                  <Button asChild variant="outline" className="rounded-xl">
                    <Link href={`/org/${orgSlug}/workflows/${item.workflowId}`}>
                      <Radio className="h-4 w-4" />
                      Open workflow
                    </Link>
                  </Button>
                </summary>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[1.25rem] bg-[var(--surface-container-lowest)] p-4">
                    <p className="label-caps">Source context</p>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-[var(--on-surface-variant)]">
                      {JSON.stringify(item.sourceContext, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-[1.25rem] bg-[var(--surface-container-lowest)] p-4">
                    <p className="label-caps">Payload snapshot</p>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-[var(--on-surface-variant)]">
                      {JSON.stringify(item.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="glass-panel rounded-[1.75rem] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--on-surface-variant)]">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-3">
            <Button
              asChild={page > 1}
              variant="outline"
              className="rounded-xl"
              disabled={page <= 1}
            >
              {page > 1 ? (
                <Link
                  href={buildPageHref({
                    orgSlug,
                    page: page - 1,
                    pageSize,
                    ...filters,
                  })}
                >
                  Previous
                </Link>
              ) : (
                <span>Previous</span>
              )}
            </Button>
            <Button
              asChild={page < pageCount}
              className="premium-gradient rounded-xl"
              disabled={page >= pageCount}
            >
              {page < pageCount ? (
                <Link
                  href={buildPageHref({
                    orgSlug,
                    page: page + 1,
                    pageSize,
                    ...filters,
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
