
import { AuditStoreHydrator } from "@/app/components/audit/audit-store-hydrator";
import { AuditLogTable } from "@/app/components/audit/audit-log-table";
import { listAuditLogs } from "@/lib/server/audit-log";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import { canViewAuditLogs } from "@/lib/server/permissions";
import { auditFilterSchema } from "@/lib/server/validation";
import { firstSearchParam } from "@/lib/search-params";

type AuditPageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuditPage({
  params,
  searchParams,
}: AuditPageProps) {
  const { orgSlug } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canViewAuditLogs(candidate.membership.role),
  );
  const resolvedSearchParams = await searchParams;
  const parsedFilters = auditFilterSchema.safeParse({
    query: firstSearchParam(resolvedSearchParams.query),
    action: firstSearchParam(resolvedSearchParams.action),
    page: firstSearchParam(resolvedSearchParams.page),
    pageSize: firstSearchParam(resolvedSearchParams.pageSize),
  });
  const filters = parsedFilters.success
    ? parsedFilters.data
    : {
        query: undefined,
        action: undefined,
        page: 1,
        pageSize: 20,
      };
  const { logs, total, summary, availableActions } = await listAuditLogs(
    context.organization.id,
    filters,
  );

  return (
    <>
      <AuditStoreHydrator
        logs={logs}
        total={total}
        page={filters.page}
        pageSize={filters.pageSize}
        filters={{
          query: filters.query,
          action: filters.action,
        }}
        availableActions={availableActions}
        summary={summary}
      />
      <AuditLogTable
        orgSlug={orgSlug}
        logs={logs}
        total={total}
        page={filters.page}
        pageSize={filters.pageSize}
        filters={{
          query: filters.query,
          action: filters.action,
        }}
        availableActions={availableActions}
        summary={summary}
      />
    </>
  );
}
