import { canCreateInvites } from "@/lib/server/permissions";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import { InviteMemberForm } from "@/app/components/team/invite-member-form";

type InvitePageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function InviteMemberPage({ params }: InvitePageProps) {
  const { orgSlug } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canCreateInvites(candidate.membership.role),
  );

  return (
    <InviteMemberForm
      orgSlug={orgSlug}
      organizationName={context.organization.name}
    />
  );
}
