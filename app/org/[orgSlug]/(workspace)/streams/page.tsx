import { WorkflowTriggerStoreHydrator } from "@/app/components/workflows/workflow-trigger-store-hydrator";
import { WorkflowStreamTable } from "@/app/components/workflows/workflow-stream-table";
import { firstSearchParam } from "@/lib/search-params";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import { canViewStreams } from "@/lib/server/permissions";
import { streamFilterSchema } from "@/lib/server/validation";
import { listWorkflowStreams } from "@/lib/server/triggers/service";

type StreamsPageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StreamsPage({
  params,
  searchParams,
}: StreamsPageProps) {
  const { orgSlug } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canViewStreams(candidate.membership.role),
  );
  const resolvedSearchParams = await searchParams;
  const parsedFilters = streamFilterSchema.safeParse({
    query: firstSearchParam(resolvedSearchParams.query),
    source: firstSearchParam(resolvedSearchParams.source),
    status: firstSearchParam(resolvedSearchParams.status),
    workflowId: firstSearchParam(resolvedSearchParams.workflowId),
    eventKey: firstSearchParam(resolvedSearchParams.eventKey),
    page: firstSearchParam(resolvedSearchParams.page),
    pageSize: firstSearchParam(resolvedSearchParams.pageSize),
  });

  const filters = parsedFilters.success
    ? parsedFilters.data
    : {
        query: undefined,
        source: undefined,
        status: undefined,
        workflowId: undefined,
        eventKey: undefined,
        page: 1,
        pageSize: 20,
      };

  const streams = await listWorkflowStreams({
    organizationId: context.organization.id,
    filters,
  });

  return (
    <>
      <WorkflowTriggerStoreHydrator
        streams={{
          items: streams.items,
          total: streams.total,
          page: streams.page,
          pageSize: streams.pageSize,
        }}
      />
      <WorkflowStreamTable
        orgSlug={orgSlug}
        items={streams.items}
        total={streams.total}
        page={streams.page}
        pageSize={streams.pageSize}
        filters={{
          query: filters.query,
          source: filters.source,
          status: filters.status,
          workflowId: filters.workflowId,
          eventKey: filters.eventKey,
        }}
      />
    </>
  );
}
