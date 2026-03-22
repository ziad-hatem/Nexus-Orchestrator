import Link from "next/link";
import { ArrowRight, ShieldCheck, UserRoundPlus, Users2 } from "lucide-react";
import { DashboardStoreHydrator } from "@/app/components/workspace/dashboard-store-hydrator";
import { Button } from "@/app/components/ui/button";
import { getOrganizationDashboardSummary } from "@/lib/server/org-service";
import { listAuditLogs } from "@/lib/server/audit-log";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import {
  canCreateInvites,
  canManageMembers,
  canViewAuditLogs,
  ROLE_LABELS,
} from "@/lib/server/permissions";

type DashboardPageProps = {
  params: Promise<{ orgSlug: string }>;
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function OrganizationDashboardPage({
  params,
}: DashboardPageProps) {
  const { orgSlug } = await params;
  const context = await requirePageOrgAccess(orgSlug);
  const [summary, recentAudit] = await Promise.all([
    getOrganizationDashboardSummary(context.organization.id),
    listAuditLogs(context.organization.id, {
      page: 1,
      pageSize: 2,
    }),
  ]);

  const allowMemberManagement = canManageMembers(context.membership.role);
  const allowAuditAccess = canViewAuditLogs(context.membership.role);
  const allowInvites = canCreateInvites(context.membership.role);

  return (
    <>
      <DashboardStoreHydrator
        summary={summary}
        recentActivity={recentAudit.logs}
      />
      <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(0,95,158,0.98),rgba(0,120,199,0.88))] px-6 py-7 text-white shadow-[0_18px_48px_rgba(0,95,158,0.22)] sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="label-caps text-[rgba(255,255,255,0.72)]">Protected workspace</p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-white">
              {context.organization.name}
            </h1>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.82)]">
              Signed in as {ROLE_LABELS[context.membership.role]}. Every action on this page is tenant-scoped and enforced on the server.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {allowInvites ? (
              <Button
                asChild
                className="rounded-xl bg-[var(--surface-container-lowest)] text-primary hover:bg-[var(--surface-container-high)]"
              >
                <Link href={`/org/${orgSlug}/team/invite`}>
                  <UserRoundPlus className="h-4 w-4" />
                  Invite teammate
                </Link>
              </Button>
            ) : null}
            {allowAuditAccess ? (
              <Button
                asChild
                variant="secondary"
                className="rounded-xl bg-[rgba(255,255,255,0.14)] text-white hover:bg-[rgba(255,255,255,0.22)]"
              >
                <Link href={`/org/${orgSlug}/audit`}>
                  <ShieldCheck className="h-4 w-4" />
                  View audit
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="glass-panel rounded-[1.75rem] p-6">
              <p className="label-caps">Members</p>
              <p className="mt-4 text-3xl font-bold text-[var(--on-surface)]">
                {summary.memberCount}
              </p>
              <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                {summary.activeMemberCount} active user accounts in this tenant.
              </p>
            </div>
            <div className="glass-panel rounded-[1.75rem] p-6">
              <p className="label-caps">Pending invites</p>
              <p className="mt-4 text-3xl font-bold text-[var(--on-surface)]">
                {summary.pendingInviteCount}
              </p>
              <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                Waiting for invited users to accept their access grants.
              </p>
            </div>
            <div className="glass-panel rounded-[1.75rem] p-6">
              <p className="label-caps">Audit events</p>
              <p className="mt-4 text-3xl font-bold text-[var(--on-surface)]">
                {summary.recentAuditCount}
              </p>
              <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                Server-written admin and security events in this organization.
              </p>
            </div>
          </div>

          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="label-caps">Recent activity</p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                  Latest server-side events
                </h2>
              </div>
              {allowAuditAccess ? (
                <Button asChild variant="ghost" className="rounded-xl text-primary">
                  <Link href={`/org/${orgSlug}/audit`}>
                    Full audit log
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </div>

            <div className="mt-6 space-y-4">
              {recentAudit.logs.length === 0 ? (
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-5 text-sm text-[var(--on-surface-variant)]">
                  No organization events have been recorded yet.
                </div>
              ) : (
                recentAudit.logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl bg-[var(--surface-container-low)] p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--on-surface)]">
                          {log.action}
                        </p>
                        <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                          {log.actor?.name ?? log.actor?.email ?? "System"} - {formatDateTime(log.created_at)}
                        </p>
                      </div>
                      <span className="rounded-full bg-[rgba(0,95,158,0.1)] px-3 py-1 text-xs font-semibold text-primary">
                        {log.entity_type ?? "system"}
                      </span>
                    </div>
                    {Object.keys(log.metadata ?? {}).length > 0 ? (
                      <pre className="mt-4 overflow-x-auto rounded-2xl bg-[var(--surface-container-lowest)] p-4 text-xs text-[var(--on-surface-variant)]">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="glass-panel rounded-[1.75rem] p-6">
            <p className="label-caps">Access profile</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
              What you can do here
            </h2>
            <div className="mt-5 space-y-3 text-sm text-[var(--on-surface-variant)]">
              <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4">
                Dashboard access is active for your role.
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4">
                Team management: {allowMemberManagement ? "enabled" : "not available"}.
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4">
                Audit log access: {allowAuditAccess ? "enabled" : "not available"}.
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-[1.75rem] p-6">
            <p className="label-caps">Quick routes</p>
            <div className="mt-5 grid gap-3">
              <Button asChild variant="outline" className="justify-start rounded-xl">
                <Link href={`/org/${orgSlug}/profile`}>Update profile</Link>
              </Button>
              {allowMemberManagement ? (
                <Button asChild variant="outline" className="justify-start rounded-xl">
                  <Link href={`/org/${orgSlug}/team`}>
                    <Users2 className="h-4 w-4" />
                    Manage team
                  </Link>
                </Button>
              ) : null}
              {allowAuditAccess ? (
                <Button asChild variant="outline" className="justify-start rounded-xl">
                  <Link href={`/org/${orgSlug}/audit`}>
                    <ShieldCheck className="h-4 w-4" />
                    Review audit
                  </Link>
                </Button>
              ) : null}
            </div>
          </section>
        </aside>
      </section>
      </div>
    </>
  );
}
