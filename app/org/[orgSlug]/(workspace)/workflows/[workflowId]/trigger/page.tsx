import { notFound } from "next/navigation";
import { WorkflowStoreHydrator } from "@/app/components/workflows/workflow-store-hydrator";
import { WorkflowTriggerConfig } from "@/app/components/workflows/workflow-trigger-config";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import {
  canEditWorkflows,
  canTriggerWorkflows,
  canViewWorkflows,
} from "@/lib/server/permissions";
import {
  getWorkflowTriggerDetails,
  WorkflowTriggerNotFoundError,
} from "@/lib/server/triggers/service";
import { getOrCreateWorkflowDraft } from "@/lib/server/workflows/service";

type WorkflowTriggerPageProps = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export default async function WorkflowTriggerPage({
  params,
}: WorkflowTriggerPageProps) {
  const { orgSlug, workflowId } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canViewWorkflows(candidate.membership.role),
  );
  let triggerDetails;
  let draft = null;

  try {
    [triggerDetails, draft] = await Promise.all([
      getWorkflowTriggerDetails({
        organizationId: context.organization.id,
        workflowId,
        canTriggerManually: canTriggerWorkflows(context.membership.role),
      }),
      canEditWorkflows(context.membership.role)
        ? getOrCreateWorkflowDraft({
            organizationId: context.organization.id,
            workflowId,
            userId: context.userId,
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

  } catch (error: unknown) {
    if (error instanceof WorkflowTriggerNotFoundError) {
      notFound();
    }

    throw error;
  }

  return (
    <>
      <WorkflowStoreHydrator trigger={triggerDetails} draft={draft} />
      <WorkflowTriggerConfig
        orgSlug={orgSlug}
        workflowId={workflowId}
        workflowName={triggerDetails.workflowName}
        triggerDetails={triggerDetails}
        draft={draft}
        canEdit={canEditWorkflows(context.membership.role)}
      />
    </>
  );
}
