"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
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

  const activeProfile =
    hydrated && (profile.name || profile.email || profile.avatarUrl)
      ? profile
      : {
          name: fallbackUser.name,
          email: fallbackUser.email,
          avatarUrl: fallbackUser.image,
        };

  return (
    <Link
      href={`/org/${organizationSlug}/profile`}
      aria-label={`Open profile settings for ${activeProfile.name ?? activeProfile.email ?? "current user"}`}
      className={cn(
        "mt-8 rounded-2xl bg-[var(--surface-container-lowest)] shadow-[0_12px_32px_rgba(11,28,48,0.04)] transition-[background-color,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--surface-container-low)]",
        collapsed ? "flex items-center justify-center p-3" : "flex items-center gap-4 p-4",
      )}
      title={collapsed ? "Open profile settings" : undefined}
    >
      <Avatar
        ariaLabel={`${activeProfile.name ?? activeProfile.email ?? "Workspace user"} profile image`}
        className={cn(
          "rounded-2xl",
          collapsed ? "h-12 w-12" : "h-11 w-11",
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
          "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed
            ? "ml-0 max-w-0 -translate-x-2 opacity-0"
            : "ml-0 max-w-[12rem] translate-x-0 opacity-100",
        )}
      >
        <p className="truncate text-sm font-semibold text-[var(--on-surface)]">
          {activeProfile.name ?? activeProfile.email ?? "Workspace user"}
        </p>
        <p className="truncate text-xs text-[var(--on-surface-variant)]">
          {activeProfile.email ?? "Open profile settings"}
        </p>
      </div>
      <UserRound
        aria-hidden={collapsed}
        className={cn(
          "shrink-0 text-[var(--outline)] transition-[opacity,transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed ? "w-0 scale-90 opacity-0" : "h-4 w-4 scale-100 opacity-100",
        )}
      />
    </Link>
  );
}
