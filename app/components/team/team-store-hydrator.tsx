"use client";

import { useEffect } from "react";
import type {
  OrganizationMember,
  PendingOrganizationInvite,
} from "@/lib/server/membership-service";
import type {
  MembershipStatus,
  OrganizationRole,
} from "@/lib/server/permissions";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

type TeamStoreHydratorProps = {
  members: OrganizationMember[];
  invites: PendingOrganizationInvite[];
  filters: {
    query?: string;
    role?: OrganizationRole;
    status?: MembershipStatus;
  };
};

export function TeamStoreHydrator({
  members,
  invites,
  filters,
}: TeamStoreHydratorProps) {
  const setTeamDirectory = useWorkspaceStore((state) => state.setTeamDirectory);

  useEffect(() => {
    setTeamDirectory({
      members,
      invites,
      filters,
    });
  }, [filters, invites, members, setTeamDirectory]);

  return null;
}
