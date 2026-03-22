import { WorkflowStoreHydrator } from "@/app/components/workflows/workflow-store-hydrator";
import { WorkflowDirectory } from "@/app/components/workflows/workflow-directory";
import { firstSearchParam } from "@/lib/search-params";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import {
  canArchiveWorkflows,
  canEditWorkflows,
  canViewWorkflows,
} from "@/lib/server/permissions";
import { workflowListFilterSchema } from "@/lib/server/validation";
import { listWorkflows } from "@/lib/server/workflows/service";

type WorkflowDirectoryPageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkflowDirectoryPage({
  params,
  searchParams,
}: WorkflowDirectoryPageProps) {
  const { orgSlug } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canViewWorkflows(candidate.membership.role),
  );
  const resolvedSearchParams = await searchParams;
  const parsedFilters = workflowListFilterSchema.safeParse({
    query: firstSearchParam(resolvedSearchParams.query),
    status: firstSearchParam(resolvedSearchParams.status),
    category: firstSearchParam(resolvedSearchParams.category),
    page: firstSearchParam(resolvedSearchParams.page),
    pageSize: firstSearchParam(resolvedSearchParams.pageSize),
  });
  const filters = parsedFilters.success
    ? parsedFilters.data
    : {
        query: undefined,
        status: undefined,
        category: undefined,
        page: 1,
        pageSize: 12,
      };

  const result = await listWorkflows({
    organizationId: context.organization.id,
    filters,
  });

  return (
    <>
      <WorkflowStoreHydrator
        directory={{
          items: result.workflows,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          filters: {
            query: filters.query,
            status: filters.status,
            category: filters.category,
          },
          categories: result.categories,
        }}
      />
      <WorkflowDirectory
        orgSlug={orgSlug}
        workflows={result.workflows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        filters={{
          query: filters.query,
          status: filters.status,
          category: filters.category,
        }}
        categories={result.categories}
        canCreateWorkflows={canEditWorkflows(context.membership.role)}
        canArchiveWorkflows={canArchiveWorkflows(context.membership.role)}
      />
    </>
  );
}
