import Link from "next/link";
import { unauthorized } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Crown,
  LayoutDashboard,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { auth } from "@/auth";
import { CreateOrgForm } from "@/app/components/workspace/create-org-form";
import { WorkspaceFooter } from "@/app/components/workspace/workspace-footer";
import { WorkspaceStoreHydrator } from "@/app/components/workspace/workspace-store-hydrator";
import { Button } from "@/app/components/ui/button";
import { MAIN_CONTENT_ID } from "@/lib/a11y";
import { ROLE_LABELS } from "@/lib/server/permissions";
import { listUserOrganizations } from "@/lib/server/org-service";

const ORG_ACCENT_COLORS = [
  "from-blue-600 to-cyan-500",
  "from-violet-600 to-purple-500",
  "from-emerald-600 to-teal-500",
  "from-orange-500 to-amber-500",
  "from-pink-600 to-rose-500",
  "from-indigo-600 to-blue-500",
];

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
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-8">
        {/* ── Hero section ── */}
        <section className="relative overflow-hidden rounded-[2.25rem] bg-[linear-gradient(135deg,rgba(0,95,158,0.98),rgba(0,120,199,0.88))] px-6 py-10 text-white shadow-[0_18px_48px_rgba(0,95,158,0.22)] sm:px-10 sm:py-12">
          {/* Decorative circles */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-white/[0.03]" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm">
                <Crown className="h-3.5 w-3.5" />
                Organization access
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">
                Choose your workspace
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-white/75">
                Every dashboard, role change, and audit event is scoped to the
                workspace you select here.
              </p>
            </div>

            <div className="flex gap-4">
              <div className="rounded-2xl bg-white/12 px-6 py-5 backdrop-blur-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                  Active
                </p>
                <p className="mt-2 text-4xl font-bold tabular-nums">
                  {activeMemberships.length}
                </p>
              </div>
              {suspendedMemberships.length > 0 ? (
                <div className="rounded-2xl bg-red-500/16 px-6 py-5 backdrop-blur-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Suspended
                  </p>
                  <p className="mt-2 text-4xl font-bold tabular-nums">
                    {suspendedMemberships.length}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── Main content grid ── */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
          {/* Left column — org cards */}
          <div className="space-y-6">
            {activeMemberships.length === 0 ? (
              <div className="glass-panel rounded-[1.75rem] p-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--surface-container-high)] text-primary">
                  <Building2 className="h-8 w-8" />
                </div>
                <h2 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                  No active organizations yet
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-[var(--on-surface-variant)]">
                  Create your first organization using the form on the right to
                  start inviting teammates and securing access.
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              {activeMemberships.map((membership, index) => {
                const gradient =
                  ORG_ACCENT_COLORS[index % ORG_ACCENT_COLORS.length];

                return (
                  <Link
                    key={membership.membershipId}
                    href={`/org/${membership.organizationSlug}`}
                    className="glass-panel group relative overflow-hidden rounded-[1.75rem] p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(11,28,48,0.12)]"
                  >
                    {/* Top gradient accent bar */}
                    <div
                      className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${gradient} opacity-60 transition-opacity duration-300 group-hover:opacity-100`}
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}
                      >
                        <Building2 className="h-5 w-5" />
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
                        <ShieldCheck className="h-3 w-3" />
                        {ROLE_LABELS[membership.role]}
                      </span>
                    </div>

                    <h2 className="mt-5 text-xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
                      {membership.organizationName}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
                      Access dashboards, manage members, and orchestrate
                      workflows.
                    </p>

                    <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-primary transition-all duration-300 group-hover:gap-3">
                      Open workspace
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Suspended memberships */}
            {suspendedMemberships.length > 0 ? (
              <div className="glass-panel rounded-[1.75rem] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--error-container)] text-[var(--error)]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--error)]">
                    Suspended access
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {suspendedMemberships.map((membership) => (
                    <div
                      key={membership.membershipId}
                      className="rounded-2xl border border-[var(--error)]/12 bg-[var(--error-container)]/40 px-4 py-3.5 text-sm text-[var(--on-surface-variant)]"
                    >
                      <span className="font-semibold text-[var(--on-surface)]">
                        {membership.organizationName}
                      </span>{" "}
                      — access suspended. Contact an org admin to restore
                      access.
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Right column — sidebar */}
          <aside className="space-y-6">
            {/* Create org */}
            <section className="glass-panel overflow-hidden rounded-[1.75rem]">
              <div className="bg-[linear-gradient(135deg,rgba(0,95,158,0.06),rgba(0,95,158,0.01))] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <PlusCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="label-caps">Create organization</p>
                    <h2 className="mt-1 text-lg font-bold tracking-[-0.02em] text-[var(--on-surface)]">
                      Start a new workspace
                    </h2>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                  New organizations grant you admin access and create an
                  isolated tenant scope.
                </p>
              </div>
              <div className="px-6 py-5">
                <CreateOrgForm />
              </div>
            </section>

            {/* Quick routes */}
            <section className="glass-panel rounded-[1.75rem] p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="label-caps">Quick routes</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                Jump straight to your last active organization via these
                shortcuts.
              </p>
              <div className="mt-5 flex flex-col gap-2.5">
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start rounded-xl"
                >
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    Go to dashboard
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start rounded-xl"
                >
                  <Link href="/profile">
                    <User className="h-4 w-4" />
                    Open profile
                  </Link>
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
