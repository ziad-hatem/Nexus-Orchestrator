import { notFound } from "next/navigation";
import { WorkflowStoreHydrator } from "@/app/components/workflows/workflow-store-hydrator";
import { WorkflowVersionViewer } from "@/app/components/workflows/workflow-version-viewer";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import { canViewWorkflows } from "@/lib/server/permissions";
import { workflowVersionNumberSchema } from "@/lib/server/validation";
import {
  getWorkflowDetail,
  getWorkflowVersionSnapshot,
  WorkflowNotFoundError,
} from "@/lib/server/workflows/service";

type WorkflowVersionPageProps = {
  params: Promise<{
    orgSlug: string;
    workflowId: string;
    versionNumber: string;
  }>;
};

export default async function WorkflowVersionPage({
  params,
}: WorkflowVersionPageProps) {
  const { orgSlug, workflowId, versionNumber } = await params;
  const parsedVersionNumber = workflowVersionNumberSchema.safeParse(versionNumber);
  if (!parsedVersionNumber.success) {
    notFound();
  }

  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canViewWorkflows(candidate.membership.role),
  );
  let detail;
  let snapshot;

  try {
    [detail, snapshot] = await Promise.all([
      getWorkflowDetail({
        organizationId: context.organization.id,
        workflowId,
      }),
      getWorkflowVersionSnapshot({
        organizationId: context.organization.id,
        workflowId,
        versionNumber: parsedVersionNumber.data,
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
      <WorkflowStoreHydrator detail={detail} version={snapshot} />
      <WorkflowVersionViewer
        orgSlug={orgSlug}
        workflowId={workflowId}
        workflowName={detail.name}
        snapshot={snapshot}
      />
    </>
  );
}
