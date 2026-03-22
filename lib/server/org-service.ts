import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  type MembershipStatus,
  type OrganizationRole,
} from "@/lib/server/permissions";
import { normalizeOrgSlug } from "@/lib/server/validation";

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

type OrganizationMembershipRow = {
  id: string;
  organization_id: string;
  role: OrganizationRole;
  status: MembershipStatus | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserOrganizationMembership = {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationLogoUrl: string | null;
  role: OrganizationRole;
  status: MembershipStatus;
  joinedAt: string | null;
  createdAt: string;
};

export type DashboardSummary = {
  memberCount: number;
  activeMemberCount: number;
  pendingInviteCount: number;
  recentAuditCount: number;
};

function isDuplicateSlugError(message: string): boolean {
  const lowered = message.toLowerCase();
  return lowered.includes("duplicate") || lowered.includes("unique");
}

export async function getOrganizationBySlug(
  orgSlug: string,
): Promise<OrganizationRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, created_at, updated_at")
    .eq("slug", orgSlug)
    .maybeSingle<OrganizationRecord>();

  if (error) {
    throw new Error(`Failed to load organization: ${error.message}`);
  }

  return data ?? null;
}

export async function listUserOrganizations(
  userId: string,
): Promise<UserOrganizationMembership[]> {
  const supabase = createSupabaseAdminClient();
  const { data: memberships, error: membershipsError } = await supabase
    .from("organization_memberships")
    .select("id, organization_id, role, status, joined_at, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<OrganizationMembershipRow[]>();

  if (membershipsError) {
    throw new Error(`Failed to load memberships: ${membershipsError.message}`);
  }

  const organizationIds = Array.from(
    new Set((memberships ?? []).map((membership) => membership.organization_id)),
  );

  if (organizationIds.length === 0) {
    return [];
  }

  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, created_at, updated_at")
    .in("id", organizationIds)
    .returns<OrganizationRecord[]>();

  if (organizationsError) {
    throw new Error(`Failed to load organizations: ${organizationsError.message}`);
  }

  const organizationsById = new Map(
    (organizations ?? []).map((organization) => [organization.id, organization]),
  );

  return (memberships ?? [])
    .map((membership) => {
      const organization = organizationsById.get(membership.organization_id);
      if (!organization) {
        return null;
      }

      return {
        membershipId: membership.id,
        organizationId: organization.id,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        organizationLogoUrl: organization.logo_url,
        role: membership.role,
        status: membership.status ?? "active",
        joinedAt: membership.joined_at,
        createdAt: membership.created_at,
      } satisfies UserOrganizationMembership;
    })
    .filter((membership): membership is UserOrganizationMembership => membership !== null)
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "active" ? -1 : 1;
      }

      return left.organizationName.localeCompare(right.organizationName);
    });
}

export async function createOrganizationWithUniqueSlug(
  name: string,
): Promise<OrganizationRecord> {
  const supabase = createSupabaseAdminClient();
  const baseSlug = normalizeOrgSlug(name);

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name, slug })
      .select("id, name, slug, logo_url, created_at, updated_at")
      .single<OrganizationRecord>();

    if (!error && data) {
      return data;
    }

    if (!isDuplicateSlugError(error?.message ?? "")) {
      throw new Error(`Failed to create organization: ${error?.message ?? "Unknown error"}`);
    }
  }

  throw new Error("Failed to reserve a unique organization slug.");
}

export async function createOrganizationForUser(params: {
  userId: string;
  name: string;
  request?: Request | null;
}): Promise<UserOrganizationMembership> {
  const organization = await createOrganizationWithUniqueSlug(params.name);
  const supabase = createSupabaseAdminClient();

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .insert({
      user_id: params.userId,
      organization_id: organization.id,
      role: "org_admin",
      status: "active",
      joined_at: new Date().toISOString(),
    })
    .select("id, organization_id, role, status, joined_at, created_at, updated_at")
    .single<OrganizationMembershipRow>();

  if (membershipError || !membership) {
    throw new Error(
      `Failed to create organization membership: ${membershipError?.message ?? "Unknown error"}`,
    );
  }

  await writeAuditLog({
    organizationId: organization.id,
    actorUserId: params.userId,
    action: "organization.created",
    entityType: "organization",
    entityId: organization.id,
    metadata: {
      organizationName: organization.name,
      organizationSlug: organization.slug,
    },
    request: params.request,
  });

  return {
    membershipId: membership.id,
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    organizationLogoUrl: organization.logo_url,
    role: membership.role,
    status: membership.status ?? "active",
    joinedAt: membership.joined_at,
    createdAt: membership.created_at,
  };
}

export async function getPostAuthRedirectPath(
  userId: string,
  preferredOrgSlug?: string | null,
): Promise<string> {
  const organizations = await listUserOrganizations(userId);
  const activeMemberships = organizations.filter(
    (membership) => membership.status === "active",
  );

  if (activeMemberships.length === 0) {
    return "/org/select";
  }

  if (preferredOrgSlug) {
    const preferredMembership = activeMemberships.find(
      (membership) => membership.organizationSlug === preferredOrgSlug,
    );
    if (preferredMembership) {
      return `/org/${preferredMembership.organizationSlug}`;
    }
  }

  if (activeMemberships.length === 1) {
    return `/org/${activeMemberships[0].organizationSlug}`;
  }

  return "/org/select";
}

export async function getOrganizationDashboardSummary(
  organizationId: string,
): Promise<DashboardSummary> {
  const supabase = createSupabaseAdminClient();

  const [
    membershipCountResult,
    activeMembershipCountResult,
    inviteCountResult,
    auditCountResult,
  ] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("organization_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "active"),
    supabase
      .from("organization_invites")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .is("revoked_at", null),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
  ]);

  if (membershipCountResult.error) {
    throw new Error(`Failed to count memberships: ${membershipCountResult.error.message}`);
  }
  if (activeMembershipCountResult.error) {
    throw new Error(
      `Failed to count active memberships: ${activeMembershipCountResult.error.message}`,
    );
  }
  if (inviteCountResult.error) {
    throw new Error(`Failed to count invites: ${inviteCountResult.error.message}`);
  }
  if (auditCountResult.error) {
    throw new Error(`Failed to count audit logs: ${auditCountResult.error.message}`);
  }

  return {
    memberCount: membershipCountResult.count ?? 0,
    activeMemberCount: activeMembershipCountResult.count ?? 0,
    pendingInviteCount: inviteCountResult.count ?? 0,
    recentAuditCount: auditCountResult.count ?? 0,
  };
}
