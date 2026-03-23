import { ExecutionDirectory } from "@/app/components/executions/execution-directory";
import { ExecutionStoreHydrator } from "@/app/components/executions/execution-store-hydrator";
import { OrgRealtimeRefresh } from "@/app/components/realtime/org-realtime-refresh";
import { firstSearchParam } from "@/lib/search-params";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import { canViewExecutions } from "@/lib/server/permissions";
import { executionListFilterSchema } from "@/lib/server/validation";
import { listWorkflowRunSummaries } from "@/lib/server/executions/service";

type ExecutionDirectoryPageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExecutionDirectoryPage({
  params,
  searchParams,
}: ExecutionDirectoryPageProps) {
  const { orgSlug } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canViewExecutions(candidate.membership.role),
  );
  const resolvedSearchParams = await searchParams;
  const parsedFilters = executionListFilterSchema.safeParse({
    query: firstSearchParam(resolvedSearchParams.query),
    status: firstSearchParam(resolvedSearchParams.status),
    source: firstSearchParam(resolvedSearchParams.source),
    workflowId: firstSearchParam(resolvedSearchParams.workflowId),
    page: firstSearchParam(resolvedSearchParams.page),
    pageSize: firstSearchParam(resolvedSearchParams.pageSize),
  });

  const filters = parsedFilters.success
    ? parsedFilters.data
    : {
        query: undefined,
        status: undefined,
        source: undefined,
        workflowId: undefined,
        page: 1,
        pageSize: 20,
      };

  const result = await listWorkflowRunSummaries({
    organizationId: context.organization.id,
    filters,
  });

  return (
    <>
      <OrgRealtimeRefresh orgSlug={orgSlug} channel="executions" />
      <ExecutionStoreHydrator
        directory={{
          items: result.items,
          summary: result.summary,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          filters: {
            query: filters.query,
            status: filters.status,
            source: filters.source,
            workflowId: filters.workflowId,
          },
        }}
      />
      <ExecutionDirectory
        orgSlug={orgSlug}
        items={result.items}
        summary={result.summary}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        filters={{
          query: filters.query,
          status: filters.status,
          source: filters.source,
          workflowId: filters.workflowId,
        }}
      />
    </>
  );
}
