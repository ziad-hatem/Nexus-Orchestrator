"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

type WorkspaceUserCardProps = {
  organizationSlug: string;
  fallbackUser: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
};

export function WorkspaceUserCard({
  organizationSlug,
  fallbackUser,
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
      className="mt-8 flex items-center gap-4 rounded-2xl bg-[var(--surface-container-lowest)] p-4 shadow-[0_12px_32px_rgba(11,28,48,0.04)] transition-colors hover:bg-[var(--surface-container-low)]"
    >
      <Avatar
        ariaLabel={`${activeProfile.name ?? activeProfile.email ?? "Workspace user"} profile image`}
        className="h-11 w-11 rounded-2xl"
        email={activeProfile.email}
        fallbackClassName="bg-[var(--surface-container-high)] text-primary"
        imageUrl={activeProfile.avatarUrl}
        name={activeProfile.name}
        textClassName="text-sm font-bold"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--on-surface)]">
          {activeProfile.name ?? activeProfile.email ?? "Workspace user"}
        </p>
        <p className="truncate text-xs text-[var(--on-surface-variant)]">
          {activeProfile.email ?? "Open profile settings"}
        </p>
      </div>
      <UserRound className="h-4 w-4 shrink-0 text-[var(--outline)]" />
    </Link>
  );
}
