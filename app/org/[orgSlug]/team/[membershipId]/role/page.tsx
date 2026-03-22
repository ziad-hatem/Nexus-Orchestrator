import { notFound } from "next/navigation";
import { canManageMembers } from "@/lib/server/permissions";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import { listOrganizationMembers } from "@/lib/server/membership-service";
import { EditRoleForm } from "@/app/components/team/edit-role-form";

type EditRolePageProps = {
  params: Promise<{ orgSlug: string; membershipId: string }>;
};

export default async function EditRolePage({ params }: EditRolePageProps) {
  const { orgSlug, membershipId } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canManageMembers(candidate.membership.role),
  );
  const { members } = await listOrganizationMembers(context.organization.id, {});
  const member = members.find(
    (candidate) => candidate.membershipId === membershipId,
  );

  if (!member) {
    notFound();
  }

  return <EditRoleForm orgSlug={orgSlug} member={member} />;
}
