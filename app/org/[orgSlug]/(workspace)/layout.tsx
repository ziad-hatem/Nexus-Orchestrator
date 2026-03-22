import type { ReactNode } from "react";
import { auth } from "@/auth";
import {
  canManageMembers,
  canViewAuditLogs,
  canViewStreams,
} from "@/lib/server/permissions";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import { listUserOrganizations } from "@/lib/server/org-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { WorkspaceShell } from "@/app/components/workspace/workspace-shell";

type OrgLayoutProps = {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
};

type WorkspaceUserRow = {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
};

export default async function OrganizationLayout({
  children,
  params,
}: OrgLayoutProps) {
  const session = await auth();
  const { orgSlug } = await params;
  const context = await requirePageOrgAccess(orgSlug);
  const memberships = await listUserOrganizations(context.userId);
  let workspaceUser: WorkspaceUserRow | null = null;

  if (session?.user?.id) {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("users")
      .select("id, name, email, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle<WorkspaceUserRow>();
    workspaceUser = data ?? null;
  }

  return (
    <WorkspaceShell
      organizationName={context.organization.name}
      organizationSlug={context.organization.slug}
      role={context.membership.role}
      memberships={memberships}
      canManageMembers={canManageMembers(context.membership.role)}
      canViewAuditLogs={canViewAuditLogs(context.membership.role)}
      canViewStreams={canViewStreams(context.membership.role)}
      user={{
        name: workspaceUser?.name ?? session?.user?.name ?? null,
        email: workspaceUser?.email ?? session?.user?.email ?? null,
        image: workspaceUser?.avatar_url ?? session?.user?.image ?? null,
      }}
    >
      {children}
    </WorkspaceShell>
  );
}
