import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { ProfileSettingsClient } from "@/app/components/profile/profile-settings-client";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import { ROLE_LABELS } from "@/lib/server/permissions";

type ProfilePageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const session = await auth();
  if (!session?.user) {
    unauthorized();
  }

  const { orgSlug } = await params;
  const context = await requirePageOrgAccess(orgSlug);

  return (
    <ProfileSettingsClient
      organizationName={context.organization.name}
      roleLabel={ROLE_LABELS[context.membership.role]}
      fallbackUser={session.user}
    />
  );
}
