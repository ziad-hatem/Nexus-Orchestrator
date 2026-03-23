"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import * as Popover from "@radix-ui/react-popover";
import { LogOut, Settings, UserRound } from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import { cn } from "@/app/components/ui/utils";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

type WorkspaceUserCardProps = {
  organizationSlug: string;
  fallbackUser: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
  collapsed?: boolean;
};

export function WorkspaceUserCard({
  organizationSlug,
  fallbackUser,
  collapsed = false,
}: WorkspaceUserCardProps) {
  const hydrated = useWorkspaceStore((state) => state.hydrated);
  const profile = useWorkspaceStore((state) => state.profile);
  const clearWorkspace = useWorkspaceStore((state) => state.clearWorkspace);

  const activeProfile =
    hydrated && (profile.name || profile.email || profile.avatarUrl)
      ? profile
      : {
          name: fallbackUser.name,
          email: fallbackUser.email,
          avatarUrl: fallbackUser.image,
        };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          aria-label={`Open user menu for ${activeProfile.name ?? activeProfile.email ?? "current user"}`}
          className={cn(
            "mt-8 rounded-2xl bg-[var(--surface-container-lowest)] shadow-[0_12px_32px_rgba(11,28,48,0.04)] transition-[background-color,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--surface-container-low)] outline-none focus-visible:ring-2 focus-visible:ring-primary",
            collapsed
              ? "flex w-full items-center justify-center p-3"
              : "flex w-full items-center gap-4 p-4",
          )}
          title={collapsed ? "Open user menu" : undefined}
        >
          <Avatar
            ariaLabel={`${activeProfile.name ?? activeProfile.email ?? "Workspace user"} profile image`}
            className={cn(
              "rounded-2xl shrink-0 transition-all duration-300",
              collapsed ? "h-10 w-10 sm:h-12 sm:w-12" : "h-11 w-11",
            )}
            email={activeProfile.email}
            fallbackClassName="bg-[var(--surface-container-high)] text-primary"
            imageUrl={activeProfile.avatarUrl}
            name={activeProfile.name}
            textClassName="text-sm font-bold"
          />
          <div
            aria-hidden={collapsed}
            className={cn(
              "min-w-0 flex-1 overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity,margin,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              collapsed
                ? "ml-0 max-w-0 -translate-x-2 opacity-0"
                : "ml-0 max-w-[12rem] translate-x-0 opacity-100",
            )}
          >
            <p className="truncate text-sm font-semibold text-[var(--on-surface)]">
              {activeProfile.name ?? activeProfile.email ?? "Workspace user"}
            </p>
            <p className="truncate text-xs text-[var(--on-surface-variant)]">
              {activeProfile.email ?? "Open user menu"}
            </p>
          </div>
          <UserRound
            aria-hidden={collapsed}
            className={cn(
              "shrink-0 text-[var(--outline)] transition-[opacity,transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              collapsed
                ? "w-0 scale-90 opacity-0"
                : "h-4 w-4 scale-100 opacity-100",
            )}
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          side="top"
          sideOffset={12}
          className="z-50 w-56 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 rounded-2xl border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--surface-container-lowest)] p-1.5 shadow-[0_12px_48px_rgba(0,0,0,0.12)] outline-none"
        >
          <div className="flex flex-col">
            <Link
              href={`/org/${organizationSlug}/profile`}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--on-surface)] transition-colors hover:bg-[var(--surface-container-low)] outline-none focus-visible:bg-[var(--surface-container-low)] focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <Settings className="h-4 w-4 text-[var(--on-surface-variant)]" />
              Profile settings
            </Link>

            <div className="my-1.5 mx-2 h-px bg-[color:color-mix(in_srgb,var(--outline-variant)_32%,transparent)]" />

            <button
              onClick={async () => {
                clearWorkspace();
                await signOut({ callbackUrl: "/login" });
              }}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--on-surface)] transition-colors hover:bg-[var(--error-container)] hover:text-[var(--on-error-container)] outline-none focus-visible:bg-[var(--error-container)] focus-visible:text-[var(--on-error-container)] focus-visible:ring-2 focus-visible:ring-[var(--error)]/20 text-left w-full"
            >
              <LogOut className="h-4 w-4 text-[var(--on-surface-variant)] group-hover:text-[var(--on-error-container)]" />
              Sign out
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
