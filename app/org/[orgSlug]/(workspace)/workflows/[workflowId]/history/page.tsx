import { notFound } from "next/navigation";
import { WorkflowStoreHydrator } from "@/app/components/workflows/workflow-store-hydrator";
import { WorkflowVersionHistory } from "@/app/components/workflows/workflow-version-history";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import { canEditWorkflows, canViewWorkflows } from "@/lib/server/permissions";
import {
  getWorkflowDetail,
  listWorkflowVersions,
  WorkflowNotFoundError,
} from "@/lib/server/workflows/service";

type WorkflowHistoryPageProps = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export default async function WorkflowHistoryPage({
  params,
}: WorkflowHistoryPageProps) {
  const { orgSlug, workflowId } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canViewWorkflows(candidate.membership.role),
  );
  let detail;
  let versions;

  try {
    [detail, versions] = await Promise.all([
      getWorkflowDetail({
        organizationId: context.organization.id,
        workflowId,
      }),
      listWorkflowVersions({
        organizationId: context.organization.id,
        workflowId,
      }),
    ]);
  } catch (error: unknown) {
    if (error instanceof WorkflowNotFoundError) {
      notFound();
    }

    throw error;
  }

  return (
    <>
      <WorkflowStoreHydrator detail={detail} versions={versions} />
      <WorkflowVersionHistory
        orgSlug={orgSlug}
        workflow={detail}
        versions={versions}
        canEditWorkflows={canEditWorkflows(context.membership.role)}
      />
    </>
  );
}
