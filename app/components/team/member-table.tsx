import Link from "next/link";
import { ArrowUpRight, Clock3, UserPlus, Users2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  FilterToolbar,
  type FilterSelectConfig,
} from "@/app/components/ui/filter-toolbar";
import type {
  OrganizationMember,
  PendingOrganizationInvite,
} from "@/lib/server/membership-service";
import {
  ORGANIZATION_ROLES,
  ROLE_LABELS,
  type MembershipStatus,
  type OrganizationRole,
} from "@/lib/server/permissions";

type MemberTableProps = {
  orgSlug: string;
  members: OrganizationMember[];
  invites: PendingOrganizationInvite[];
  filters: {
    query?: string;
    role?: OrganizationRole;
    status?: MembershipStatus;
  };
};

function formatDate(value: string | null): string {
  if (!value) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function initialsForMember(name: string | null, email: string): string {
  const source = name?.trim() || email.split("@")[0] || "M";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function roleBadgeClasses(role: OrganizationRole): string {
  switch (role) {
    case "org_admin":
      return "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-primary";
    case "workflow_editor":
      return "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200";
    case "operator":
      return "bg-amber-500/12 text-amber-800 dark:text-amber-200";
    case "viewer":
    default:
      return "bg-slate-500/12 text-slate-700 dark:text-slate-200";
  }
}

function statusBadgeClasses(status: MembershipStatus | "invited"): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200";
    case "suspended":
      return "bg-[var(--error-container)] text-[var(--error)]";
    case "invited":
    default:
      return "bg-amber-500/12 text-amber-800 dark:text-amber-200";
  }
}

export function MemberTable({
  orgSlug,
  members,
  invites,
  filters,
}: MemberTableProps) {
  const filterSelects: FilterSelectConfig[] = [
    {
      key: "role",
      label: "Filter members by role",
      placeholder: "All roles",
      value: filters.role,
      icon: "shield",
      options: [
        { label: "All roles", value: "" },
        ...ORGANIZATION_ROLES.map((role) => ({
          label: ROLE_LABELS[role],
          value: role,
        })),
      ],
    },
    {
      key: "status",
      label: "Filter members by status",
      placeholder: "All statuses",
      value: filters.status,
      icon: "clock",
      options: [
        { label: "All statuses", value: "" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(0,95,158,0.98),rgba(0,120,199,0.88))] px-6 py-7 text-white shadow-[0_18px_48px_rgba(0,95,158,0.22)] sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="label-caps text-white">Team access</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white">
              Manage members and invitations
            </h1>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.82)]">
              Role changes, suspension controls, and pending invitations all stay inside the active organization boundary.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(255,255,255,0.68)]">
                Members
              </p>
              <p className="mt-2 text-2xl font-bold">{members.length}</p>
            </div>
            <div className="rounded-2xl bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(255,255,255,0.68)]">
                Pending invites
              </p>
              <p className="mt-2 text-2xl font-bold">{invites.length}</p>
            </div>
            <div className="rounded-2xl bg-[rgba(255,255,255,0.12)] px-4 py-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(255,255,255,0.68)]">
                Active members
              </p>
              <p className="mt-2 text-2xl font-bold">
                {members.filter((member) => member.status === "active").length}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
        <FilterToolbar
          key={`team-filters:${filters.query ?? ""}:${filters.role ?? ""}:${filters.status ?? ""}`}
          resetHref={`/org/${orgSlug}/team`}
          search={{
            label: "Search members by name or email",
            placeholder: "Search by name or email",
            value: filters.query,
          }}
          selects={filterSelects}
          submitLabel="Apply filters"
        />
      </section>

      <section className="glass-panel overflow-hidden rounded-[1.75rem]">
        <div className="flex items-center justify-between border-b border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] px-5 py-5 sm:px-6">
          <div>
            <p className="label-caps">Member directory</p>
            <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
              Organization members
            </h2>
          </div>
          <Button asChild className="premium-gradient rounded-xl">
            <Link href={`/org/${orgSlug}/team/invite`}>
              <UserPlus className="h-4 w-4" />
              Invite member
            </Link>
          </Button>
        </div>

        {members.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--surface-container-high)] text-primary">
              <Users2 className="h-8 w-8" />
            </div>
            <h3 className="mt-5 text-xl font-bold text-[var(--on-surface)]">
              No members matched these filters
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--on-surface-variant)]">
              Try widening the search or invite the first teammate into this workspace.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[rgba(192,199,211,0.14)]">
              <caption className="sr-only">
                Organization members and pending access details for the active workspace.
              </caption>
              <thead className="bg-[var(--surface-container-low)]/60">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                    Member
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                    Role
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                    Joined
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(192,199,211,0.14)]">
                {members.map((member) => (
                  <tr
                    key={member.membershipId}
                    className="transition-colors hover:bg-[var(--surface-container-low)]/45"
                  >
                    <th scope="row" className="px-6 py-5 text-left">
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-container-high)] text-sm font-bold text-primary">
                          {initialsForMember(member.name, member.email)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--on-surface)]">
                            {member.name ?? member.email}
                          </p>
                          <p className="text-xs text-[var(--on-surface-variant)]">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </th>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeClasses(member.role)}`}
                      >
                        {ROLE_LABELS[member.role]}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${statusBadgeClasses(member.status)}`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm text-[var(--on-surface-variant)]">
                      {formatDate(member.joinedAt ?? member.createdAt)}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Button asChild variant="ghost" className="rounded-xl">
                        <Link href={`/org/${orgSlug}/team/${member.membershipId}/role`}>
                          Edit access
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <Clock3 className="h-5 w-5 text-primary" />
          <div>
            <p className="label-caps">Pending invitations</p>
            <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
              Outstanding access requests
            </h2>
          </div>
        </div>

        {invites.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--on-surface-variant)]">
            No active invitations are waiting for acceptance.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {invites.map((invite) => (
              <article
                key={invite.id}
                className="rounded-2xl border border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] bg-[var(--surface-container-lowest)] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--on-surface)]">
                      {invite.name ?? invite.email}
                    </p>
                    <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                      {invite.email}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeClasses(invite.role)}`}
                  >
                    {ROLE_LABELS[invite.role]}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--on-surface-variant)]">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 font-semibold uppercase tracking-[0.12em] ${statusBadgeClasses("invited")}`}
                  >
                    Invited
                  </span>
                  <span>Sent {formatDate(invite.createdAt)}</span>
                  <span>Expires {formatDate(invite.expiresAt)}</span>
                </div>
                {invite.isExpired ? (
                  <p className="mt-4 text-xs font-semibold text-[var(--error)]">
                    This invite has expired and should be resent.
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
