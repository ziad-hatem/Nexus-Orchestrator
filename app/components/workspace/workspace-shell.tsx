import Link from "next/link";
import type { ReactNode } from "react";
import { OrgSwitcher } from "@/app/components/workspace/org-switcher";
import { WorkspaceNav } from "@/app/components/workspace/workspace-nav";
import { WorkspaceStoreHydrator } from "@/app/components/workspace/workspace-store-hydrator";
import { WorkspaceFooter } from "@/app/components/workspace/workspace-footer";
import { WorkspaceUserCard } from "@/app/components/workspace/workspace-user-card";
import { MAIN_CONTENT_ID } from "@/lib/a11y";
import type { UserOrganizationMembership } from "@/lib/server/org-service";
import { ROLE_LABELS } from "@/lib/server/permissions";

type WorkspaceShellProps = {
  children: ReactNode;
  organizationName: string;
  organizationSlug: string;
  role: keyof typeof ROLE_LABELS;
  memberships: UserOrganizationMembership[];
  canManageMembers: boolean;
  canViewAuditLogs: boolean;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
};

export function WorkspaceShell({
  children,
  organizationName,
  organizationSlug,
  role,
  memberships,
  canManageMembers,
  canViewAuditLogs,
  user,
}: WorkspaceShellProps) {
  return (
    <div className="workspace-main flex min-h-screen flex-col px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid flex-1 gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside
          aria-label={`${organizationName} workspace sidebar`}
          className="glass-panel rounded-[2rem] p-5"
        >
          <WorkspaceStoreHydrator
            currentOrganizationSlug={organizationSlug}
            currentOrganizationName={organizationName}
            currentRole={role}
            memberships={memberships}
            profile={{
              name: user.name,
              email: user.email,
              avatarUrl: user.image,
            }}
          />

          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Nexus Orchestrator
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
              {organizationName}
            </h1>
            <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
              Signed in as {ROLE_LABELS[role]}
            </p>
          </div>

          <OrgSwitcher
            currentOrgSlug={organizationSlug}
            memberships={memberships}
          />

          <WorkspaceNav
            organizationSlug={organizationSlug}
            canManageMembers={canManageMembers}
            canViewAuditLogs={canViewAuditLogs}
          />

          <div className="glass-pill mt-8 rounded-2xl p-4">
            <p className="label-caps">Workspace access</p>
            <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
              {
                memberships.filter((membership) => membership.status === "active")
                  .length
              }{" "}
              active organizations
            </p>
            <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
              Stay inside the correct tenant by switching organizations before you manage people, roles, or audit data.
            </p>
            <Link
              href="/org/select"
              className="mt-4 inline-flex text-sm font-semibold text-primary transition-colors hover:text-[var(--primary-container)]"
            >
              Open organization selector
            </Link>
          </div>

          <WorkspaceUserCard
            organizationSlug={organizationSlug}
            fallbackUser={user}
          />
        </aside>

        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="glass-panel-soft rounded-[2rem] p-5 sm:p-6"
        >
          {children}
        </main>
      </div>
      <WorkspaceFooter className="mt-6" />
    </div>
  );
}
