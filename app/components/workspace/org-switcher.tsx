"use client";

import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { ChevronDown, Building2 } from "lucide-react";
import { cn } from "@/app/components/ui/utils";
import { ROLE_LABELS } from "@/lib/server/permissions";
import type { UserOrganizationMembership } from "@/lib/server/org-service";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

type OrgSwitcherProps = {
  currentOrgSlug: string;
  memberships: UserOrganizationMembership[];
  collapsed?: boolean;
};

export function OrgSwitcher({
  currentOrgSlug,
  memberships,
  collapsed = false,
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
          className={cn(
            "micro-interactive flex items-center rounded-2xl bg-[var(--surface-container-lowest)] text-left shadow-[0_12px_32px_rgba(11,28,48,0.06)] transition-[width,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            collapsed
              ? "h-14 w-14 justify-center"
              : "min-w-[15rem] justify-between px-4 py-3",
          )}
          title={collapsed ? activeMembership.organizationName : undefined}
        >
          <div
            className={cn(
              "flex min-w-0 items-center",
              collapsed ? "justify-center" : "gap-3",
            )}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-container-high)] text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div
              aria-hidden={collapsed}
              className={cn(
                "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                collapsed
                  ? "ml-0 max-w-0 -translate-x-2 opacity-0"
                  : "ml-3 max-w-[11rem] translate-x-0 opacity-100",
              )}
            >
              <p className="truncate text-sm font-semibold text-[var(--on-surface)]">
                {activeMembership.organizationName}
              </p>
              <p className="text-xs text-[var(--on-surface-variant)]">
                {ROLE_LABELS[activeMembership.role]}
              </p>
            </div>
          </div>
          <ChevronDown
            aria-hidden={collapsed}
            className={cn(
              "h-4 w-4 shrink-0 text-[var(--outline)] transition-[opacity,transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=open]:rotate-180",
              collapsed ? "w-0 scale-90 opacity-0" : "w-4 scale-100 opacity-100",
            )}
          />
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
