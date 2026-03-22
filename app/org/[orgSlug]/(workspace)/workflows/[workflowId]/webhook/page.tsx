import { notFound } from "next/navigation";
import { WorkflowStoreHydrator } from "@/app/components/workflows/workflow-store-hydrator";
import { WorkflowWebhookDetails } from "@/app/components/workflows/workflow-webhook-details";
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

type WorkflowWebhookPageProps = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export default async function WorkflowWebhookPage({
  params,
}: WorkflowWebhookPageProps) {
  const { orgSlug, workflowId } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canViewWorkflows(candidate.membership.role),
  );
  let triggerDetails;

  try {
    triggerDetails = await getWorkflowTriggerDetails({
      organizationId: context.organization.id,
      workflowId,
      canTriggerManually: canTriggerWorkflows(context.membership.role),
    });
  } catch (error: unknown) {
    if (error instanceof WorkflowTriggerNotFoundError) {
      notFound();
    }

    throw error;
  }

  return (
    <>
      <WorkflowStoreHydrator trigger={triggerDetails} />
      <WorkflowWebhookDetails
        orgSlug={orgSlug}
        workflowId={workflowId}
        triggerDetails={triggerDetails}
        canRotateSecret={canEditWorkflows(context.membership.role)}
      />
    </>
  );
}
