import { OperationsDashboard } from "@/app/components/operations/operations-dashboard";
import { OperationsStoreHydrator } from "@/app/components/operations/operations-store-hydrator";
import { OrgRealtimeRefresh } from "@/app/components/realtime/org-realtime-refresh";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import { getOperationsDashboardData } from "@/lib/server/operations/service";
import { canViewOperations } from "@/lib/server/permissions";

type OperationsPageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function OperationsPage({
  params,
}: OperationsPageProps) {
  const { orgSlug } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canViewOperations(candidate.membership.role),
  );

  const data = await getOperationsDashboardData({
    organizationId: context.organization.id,
    organizationSlug: context.organization.slug,
    emitAlerts: true,
  });

  return (
    <>
      <OrgRealtimeRefresh orgSlug={orgSlug} channel="operations" />
      <OperationsStoreHydrator snapshot={data} />
      <OperationsDashboard orgSlug={orgSlug} data={data} />
    </>
  );
}
