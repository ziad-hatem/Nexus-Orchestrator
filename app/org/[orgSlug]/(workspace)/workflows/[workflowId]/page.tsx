import { notFound } from "next/navigation";
import { WorkflowStoreHydrator } from "@/app/components/workflows/workflow-store-hydrator";
import { WorkflowDetail } from "@/app/components/workflows/workflow-detail";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import {
  canArchiveWorkflows,
  canEditWorkflows,
  canViewWorkflows,
} from "@/lib/server/permissions";
import {
  getWorkflowDetail,
  WorkflowNotFoundError,
} from "@/lib/server/workflows/service";

type WorkflowDetailPageProps = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export default async function WorkflowDetailPage({
  params,
}: WorkflowDetailPageProps) {
  const { orgSlug, workflowId } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canViewWorkflows(candidate.membership.role),
  );
  let detail;

  try {
    detail = await getWorkflowDetail({
      organizationId: context.organization.id,
      workflowId,
    });
  } catch (error: unknown) {
    if (error instanceof WorkflowNotFoundError) {
      notFound();
    }

    throw error;
  }

  return (
    <>
      <WorkflowStoreHydrator detail={detail} />
      <WorkflowDetail
        orgSlug={orgSlug}
        detail={detail}
        canEditWorkflows={canEditWorkflows(context.membership.role)}
        canArchiveWorkflows={canArchiveWorkflows(context.membership.role)}
      />
    </>
  );
}
