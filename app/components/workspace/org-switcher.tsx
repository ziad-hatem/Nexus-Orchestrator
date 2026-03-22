"use client";

import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { ChevronDown, Building2 } from "lucide-react";
import { ROLE_LABELS } from "@/lib/server/permissions";
import type { UserOrganizationMembership } from "@/lib/server/org-service";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

type OrgSwitcherProps = {
  currentOrgSlug: string;
  memberships: UserOrganizationMembership[];
};

export function OrgSwitcher({
  currentOrgSlug,
  memberships,
}: OrgSwitcherProps) {
  const hydrated = useWorkspaceStore((state) => state.hydrated);
  const storeCurrentOrganizationSlug = useWorkspaceStore(
    (state) => state.currentOrganizationSlug,
  );
  const storeMemberships = useWorkspaceStore((state) => state.memberships);
  const setCurrentOrganization = useWorkspaceStore(
    (state) => state.setCurrentOrganization,
  );
  const resolvedMemberships =
    hydrated && storeMemberships.length > 0 ? storeMemberships : memberships;
  const resolvedCurrentOrgSlug =
    hydrated && storeCurrentOrganizationSlug
      ? storeCurrentOrganizationSlug
      : currentOrgSlug;
  const activeMembership =
    resolvedMemberships.find(
      (membership) => membership.organizationSlug === resolvedCurrentOrgSlug,
    ) ?? resolvedMemberships[0];

  if (!activeMembership) {
    return null;
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Current organization: ${activeMembership.organizationName}. Open organization switcher.`}
          className="micro-interactive flex min-w-[15rem] items-center justify-between rounded-2xl bg-[var(--surface-container-lowest)] px-4 py-3 text-left shadow-[0_12px_32px_rgba(11,28,48,0.06)]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-container-high)] text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--on-surface)]">
                {activeMembership.organizationName}
              </p>
              <p className="text-xs text-[var(--on-surface-variant)]">
                {ROLE_LABELS[activeMembership.role]}
              </p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-[var(--outline)] transition-transform data-[state=open]:rotate-180" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          className="glass-panel-strong z-[120] w-[20rem] rounded-[1.5rem] p-3 shadow-[0_16px_40px_rgba(11,28,48,0.14)]"
          collisionPadding={16}
          side="right"
          sideOffset={12}
        >
          <div className="mb-2 px-2 py-1">
            <p className="label-caps">Organizations</p>
          </div>
          <ul className="space-y-2">
            {resolvedMemberships.map((membership) => (
              <li key={membership.membershipId}>
                <Popover.Close asChild>
                  <Link
                    href={`/org/${membership.organizationSlug}`}
                    className="flex items-center justify-between rounded-2xl px-3 py-3 transition-colors hover:bg-[var(--surface-container-low)]"
                    onClick={() =>
                      setCurrentOrganization({
                        organizationSlug: membership.organizationSlug,
                        organizationName: membership.organizationName,
                        role: membership.role,
                      })
                    }
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--on-surface)]">
                        {membership.organizationName}
                      </p>
                      <p className="text-xs text-[var(--on-surface-variant)]">
                        {ROLE_LABELS[membership.role]}
                        {membership.status !== "active" ? " - Suspended" : ""}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-primary">
                      {membership.organizationSlug === resolvedCurrentOrgSlug
                        ? "Current"
                        : "Open"}
                    </span>
                  </Link>
                </Popover.Close>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] pt-3">
            <Popover.Close asChild>
              <Link
                href="/org/select"
                className="text-sm font-semibold text-primary transition-colors hover:text-[var(--primary-container)]"
              >
                Manage organizations
              </Link>
            </Popover.Close>
          </div>
          <Popover.Arrow
            className="fill-[var(--glass-panel-strong)]"
            height={12}
            width={18}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
