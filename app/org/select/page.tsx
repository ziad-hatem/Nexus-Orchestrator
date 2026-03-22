import Link from "next/link";
import { unauthorized } from "next/navigation";
import { Building2, PlusCircle, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { CreateOrgForm } from "@/app/components/workspace/create-org-form";
import { WorkspaceFooter } from "@/app/components/workspace/workspace-footer";
import { WorkspaceStoreHydrator } from "@/app/components/workspace/workspace-store-hydrator";
import { Button } from "@/app/components/ui/button";
import { MAIN_CONTENT_ID } from "@/lib/a11y";
import { ROLE_LABELS } from "@/lib/server/permissions";
import { listUserOrganizations } from "@/lib/server/org-service";

export default async function OrganizationSelectionPage() {
  const session = await auth();
  if (!session?.user?.id) {
    unauthorized();
  }

  const memberships = await listUserOrganizations(session.user.id);
  const activeMemberships = memberships.filter(
    (membership) => membership.status === "active",
  );
  const suspendedMemberships = memberships.filter(
    (membership) => membership.status === "suspended",
  );

  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="workspace-main flex min-h-screen flex-col px-4 py-8 sm:px-6 lg:px-8"
    >
      <WorkspaceStoreHydrator memberships={memberships} />
      <div className="w-full flex-1 space-y-8">
        <section className="overflow-hidden rounded-[2.25rem] bg-[linear-gradient(135deg,rgba(0,95,158,0.98),rgba(0,120,199,0.88))] px-6 py-8 text-white shadow-[0_18px_48px_rgba(0,95,158,0.22)] sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="label-caps text-[rgba(255,255,255,0.72)]">Organization access</p>
              <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-white">
                Choose the workspace you want to enter
              </h1>
              <p className="mt-3 text-sm text-[rgba(255,255,255,0.82)]">
                Every dashboard, role change, and audit event is scoped to the organization you select here.
              </p>
            </div>
            <div className="rounded-2xl bg-[rgba(255,255,255,0.12)] px-5 py-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(255,255,255,0.68)]">
                Active workspaces
              </p>
              <p className="mt-2 text-3xl font-bold">{activeMemberships.length}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <div className="grid gap-6 md:grid-cols-2">
            {activeMemberships.length === 0 ? (
              <div className="glass-panel rounded-[1.75rem] p-8 md:col-span-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--surface-container-high)] text-primary">
                  <Building2 className="h-7 w-7" />
                </div>
                <h2 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                  No active organizations yet
                </h2>
                <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
                  Create your first organization to start inviting teammates and securing access.
                </p>
              </div>
            ) : null}

            {activeMemberships.map((membership) => (
              <Link
                key={membership.membershipId}
                href={`/org/${membership.organizationSlug}`}
                className="glass-panel group rounded-[1.75rem] p-6 transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(11,28,48,0.08)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--surface-container-high)] text-primary">
                    <Building2 className="h-7 w-7" />
                  </div>
                  <span className="rounded-full bg-[rgba(0,95,158,0.1)] px-3 py-1 text-xs font-semibold text-primary">
                    {ROLE_LABELS[membership.role]}
                  </span>
                </div>
                <h2 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                  {membership.organizationName}
                </h2>
                <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
                  Enter this tenant to access dashboards, member access, and protected workflow surfaces.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition group-hover:translate-x-0.5">
                  Open workspace
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </Link>
            ))}

            {suspendedMemberships.length > 0 ? (
              <div className="glass-panel rounded-[1.75rem] p-6 md:col-span-2">
                <p className="label-caps text-[var(--error)]">Suspended access</p>
                <div className="mt-4 space-y-3">
                  {suspendedMemberships.map((membership) => (
                    <div
                      key={membership.membershipId}
                      className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4 text-sm text-[var(--on-surface-variant)]"
                    >
                      <span className="font-semibold text-[var(--on-surface)]">
                        {membership.organizationName}
                      </span>{" "}
                      access is suspended for your account. Contact an org admin to restore access.
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-6">
            <section className="glass-panel rounded-[1.75rem] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-[var(--surface-container-high)] text-primary">
                  <PlusCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="label-caps">Create organization</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
                    Start a new tenant
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-sm text-[var(--on-surface-variant)]">
                New organizations automatically grant you org admin access and create an isolated tenant scope.
              </p>
              <div className="mt-6">
                <CreateOrgForm />
              </div>
            </section>

            <section className="glass-panel rounded-[1.75rem] p-6">
              <p className="label-caps">Need a quick route?</p>
              <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
                If you already know where you want to go, the dashboard aliases also route into your last active organization.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href="/dashboard">Go to dashboard</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href="/profile">Open profile</Link>
                </Button>
              </div>
            </section>
          </aside>
        </section>
      </div>
      <WorkspaceFooter className="mt-6" />
    </main>
  );
}
