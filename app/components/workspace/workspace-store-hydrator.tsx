"use client";

import { useEffect } from "react";
import type { OrganizationRole } from "@/lib/server/permissions";
import type { UserOrganizationMembership } from "@/lib/server/org-service";
import {
  type WorkspaceProfile,
  useWorkspaceStore,
} from "@/lib/stores/workspace-store";

type WorkspaceStoreHydratorProps = {
  currentOrganizationSlug?: string;
  currentOrganizationName?: string;
  currentRole?: OrganizationRole;
  memberships: UserOrganizationMembership[];
  profile?: WorkspaceProfile;
};

export function WorkspaceStoreHydrator({
  currentOrganizationSlug,
  currentOrganizationName,
  currentRole,
  memberships,
  profile,
}: WorkspaceStoreHydratorProps) {
  const setMemberships = useWorkspaceStore((state) => state.setMemberships);
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace);
  const setProfile = useWorkspaceStore((state) => state.setProfile);

  useEffect(() => {
    if (currentOrganizationSlug && currentOrganizationName && currentRole) {
      setWorkspace({
        currentOrganizationSlug,
        currentOrganizationName,
        currentRole,
        memberships,
      });
      return;
    }

    setMemberships(memberships);
  }, [
    currentOrganizationName,
    currentOrganizationSlug,
    currentRole,
    memberships,
    setMemberships,
    setWorkspace,
  ]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setProfile(profile);
  }, [profile, setProfile]);

  return null;
}
