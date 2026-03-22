import { WorkflowCreateForm } from "@/app/components/workflows/workflow-create-form";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import { canEditWorkflows } from "@/lib/server/permissions";

type WorkflowCreatePageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function WorkflowCreatePage({
  params,
}: WorkflowCreatePageProps) {
  const { orgSlug } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canEditWorkflows(candidate.membership.role),
  );

  return (
    <WorkflowCreateForm
      orgSlug={orgSlug}
      organizationName={context.organization.name}
    />
  );
}
