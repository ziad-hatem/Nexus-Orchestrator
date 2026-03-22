import Link from "next/link";
import { ArrowRight, Layers3, SearchCode } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  FilterToolbar,
  type FilterSelectConfig,
} from "@/app/components/ui/filter-toolbar";
import { WorkflowArchiveDialog } from "@/app/components/workflows/workflow-archive-dialog";
import type {
  WorkflowLifecycleStatus,
  WorkflowSummary,
} from "@/lib/server/workflows/types";

type WorkflowDirectoryProps = {
  orgSlug: string;
  workflows: WorkflowSummary[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    query?: string;
    status?: WorkflowLifecycleStatus;
    category?: string;
  };
  categories: string[];
  canCreateWorkflows: boolean;
  canArchiveWorkflows: boolean;
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

function workflowStatusLabel(status: WorkflowLifecycleStatus): string {
  switch (status) {
    case "draft_only":
      return "Draft only";
    case "published":
      return "Published";
    case "published_with_draft":
      return "Published with draft";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}

function workflowStatusClasses(status: WorkflowLifecycleStatus): string {
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

function buildPageHref(params: {
  orgSlug: string;
  page: number;
  pageSize: number;
  query?: string;
  status?: WorkflowLifecycleStatus;
  category?: string;
}): string {
  const searchParams = new URLSearchParams();

  if (params.query) {
    searchParams.set("query", params.query);
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (params.category) {
    searchParams.set("category", params.category);
  }
  if (params.page > 1) {
    searchParams.set("page", String(params.page));
  }
  if (params.pageSize !== 12) {
    searchParams.set("pageSize", String(params.pageSize));
  }

  const query = searchParams.toString();
  return `/org/${params.orgSlug}/workflows${query ? `?${query}` : ""}`;
}

export function WorkflowDirectory({
  orgSlug,
  workflows,
  total,
  page,
  pageSize,
  filters,
  categories,
  canCreateWorkflows,
  canArchiveWorkflows,
}: WorkflowDirectoryProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const draftCount = workflows.filter(
    (workflow) =>
      workflow.status === "draft_only" ||
      workflow.status === "published_with_draft",
  ).length;
  const publishedCount = workflows.filter(
    (workflow) =>
      workflow.status === "published" ||
      workflow.status === "published_with_draft",
  ).length;

  const filterSelects: FilterSelectConfig[] = [
    {
      key: "status",
      label: "Filter workflows by lifecycle status",
      placeholder: "All statuses",
      value: filters.status,
      icon: "clock",
      options: [
        { label: "All statuses", value: "" },
        { label: "Draft only", value: "draft_only" },
        { label: "Published", value: "published" },
        { label: "Published with draft", value: "published_with_draft" },
        { label: "Archived", value: "archived" },
      ],
    },
    {
      key: "category",
      label: "Filter workflows by category",
      placeholder: "All categories",
      value: filters.category,
      icon: "filter",
      options: [
        { label: "All categories", value: "" },
        ...categories.map((category) => ({
          label: category,
          value: category,
        })),
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(11,28,48,0.98),rgba(0,95,158,0.88))] px-6 py-7 text-white shadow-[0_18px_48px_rgba(11,28,48,0.2)] sm:px-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="label-caps text-[rgba(255,255,255,0.72)]">
              Workflow directory
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white">
              Draft, publish, and archive workflows safely
            </h1>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.82)]">
              Every workflow stays inside the active organization boundary, with immutable version history and explicit archive controls.
            </p>
          </div>
          {canCreateWorkflows ? (
            <Button
              asChild
              className="rounded-xl bg-[var(--surface-container-lowest)] text-primary hover:bg-[var(--surface-container-high)]"
            >
              <Link href={`/org/${orgSlug}/workflows/new`}>
                <Layers3 className="h-4 w-4" />
                Create workflow
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="glass-panel rounded-[1.75rem] p-6">
          <p className="label-caps">Matching workflows</p>
          <p className="mt-4 text-3xl font-bold text-[var(--on-surface)]">{total}</p>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            Results after applying the current directory filters.
          </p>
        </div>
        <div className="glass-panel rounded-[1.75rem] p-6">
          <p className="label-caps">Draft activity</p>
          <p className="mt-4 text-3xl font-bold text-[var(--on-surface)]">
            {draftCount}
          </p>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            Visible workflows with an active draft ready for edits or publish.
          </p>
        </div>
        <div className="glass-panel rounded-[1.75rem] p-6">
          <p className="label-caps">Published coverage</p>
          <p className="mt-4 text-3xl font-bold text-[var(--on-surface)]">
            {publishedCount}
          </p>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            Visible workflows with at least one immutable published version.
          </p>
        </div>
      </section>

      <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
        <FilterToolbar
          key={`workflow-filters:${filters.query ?? ""}:${filters.status ?? ""}:${filters.category ?? ""}`}
          className="xl:grid-cols-[minmax(0,1.25fr)_minmax(14rem,0.8fr)_minmax(14rem,0.8fr)_auto]"
          resetHref={`/org/${orgSlug}/workflows`}
          search={{
            label: "Search workflows by id, name, description, or tag",
            placeholder: "Search workflows by id, name, or tag",
            value: filters.query,
          }}
          selects={filterSelects}
          submitLabel="Apply filters"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {workflows.length === 0 ? (
          <div className="glass-panel col-span-full rounded-[1.75rem] px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--surface-container-high)] text-primary">
              <SearchCode className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-[var(--on-surface)]">
              No workflows matched these filters
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--on-surface-variant)]">
              Reset the directory filters or create a new workflow draft to start building immutable lifecycle history.
            </p>
          </div>
        ) : (
          workflows.map((workflow) => (
            <article
              key={workflow.workflowId}
              className="glass-panel rounded-[1.75rem] p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
                      {workflow.workflowId}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${workflowStatusClasses(workflow.status)}`}
                    >
                      {workflowStatusLabel(workflow.status)}
                    </span>
                    {workflow.hasDraft ? (
                      <span className="rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
                        Draft open
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                    {workflow.name}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                    {workflow.description || "No description provided yet."}
                  </p>
                </div>
                {canArchiveWorkflows && workflow.status !== "archived" ? (
                  <WorkflowArchiveDialog
                    orgSlug={orgSlug}
                    workflowId={workflow.workflowId}
                    workflowName={workflow.name}
                    triggerLabel="Archive"
                    triggerVariant="outline"
                    triggerClassName="rounded-xl"
                  />
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--surface-container-low)] px-3 py-1 text-xs font-semibold text-[var(--on-surface)]">
                  {workflow.category}
                </span>
                {workflow.tags.map((tag) => (
                  <span
                    key={`${workflow.workflowId}:${tag}`}
                    className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-xs font-semibold text-[var(--on-surface-variant)]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                  <p className="label-caps">Latest version</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {workflow.latestVersionNumber
                      ? `v${workflow.latestVersionNumber}`
                      : "Not published"}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                  <p className="label-caps">Last modified</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {formatDateTime(workflow.lastModifiedAt)}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                  <p className="label-caps">Modified by</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {workflow.modifiedBy?.name ??
                      workflow.modifiedBy?.email ??
                      "Unknown"}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="premium-gradient rounded-xl">
                  <Link href={`/org/${orgSlug}/workflows/${workflow.workflowId}`}>
                    View details
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                {workflow.hasDraft ? (
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link href={`/org/${orgSlug}/workflows/${workflow.workflowId}/draft`}>
                      Continue draft
                    </Link>
                  </Button>
                ) : null}
              </div>
            </article>
          ))
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
                    query: filters.query,
                    status: filters.status,
                    category: filters.category,
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
                    query: filters.query,
                    status: filters.status,
                    category: filters.category,
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
