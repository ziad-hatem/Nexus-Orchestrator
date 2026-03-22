import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  getRolePermissions,
  type MembershipStatus,
  type OrganizationRole,
} from "@/lib/server/permissions";

type MembershipRow = {
  id: string;
  user_id: string;
  organization_id: string;
  role: OrganizationRole;
  status: MembershipStatus | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
};

export type OrganizationMember = {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: OrganizationRole;
  status: MembershipStatus;
  joinedAt: string | null;
  createdAt: string;
  permissions: ReturnType<typeof getRolePermissions>;
};

type OrganizationInviteRow = {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  display_name: string | null;
  expires_at: string;
  created_at: string;
};

export type PendingOrganizationInvite = {
  id: string;
  organizationId: string;
  email: string;
  name: string | null;
  role: OrganizationRole;
  expiresAt: string;
  createdAt: string;
  isExpired: boolean;
};

export type MemberFilters = {
  query?: string;
  role?: OrganizationRole;
  status?: MembershipStatus;
};

function matchesMemberQuery(member: OrganizationMember, query: string): boolean {
  const lowered = query.toLowerCase();
  return (
    member.name?.toLowerCase().includes(lowered) === true ||
    member.email.toLowerCase().includes(lowered)
  );
}

function matchesInviteQuery(invite: PendingOrganizationInvite, query: string): boolean {
  const lowered = query.toLowerCase();
  return (
    invite.name?.toLowerCase().includes(lowered) === true ||
    invite.email.toLowerCase().includes(lowered)
  );
}

export async function listOrganizationMembers(
  organizationId: string,
  filters: MemberFilters,
): Promise<{
  members: OrganizationMember[];
  invites: PendingOrganizationInvite[];
}> {
  const supabase = createSupabaseAdminClient();

  const { data: memberships, error: membershipsError } = await supabase
    .from("organization_memberships")
    .select("id, user_id, organization_id, role, status, joined_at, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .returns<MembershipRow[]>();

  if (membershipsError) {
    throw new Error(`Failed to load organization members: ${membershipsError.message}`);
  }

  const userIds = Array.from(new Set((memberships ?? []).map((membership) => membership.user_id)));
  const usersById = new Map<string, UserRow>();

  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, email, avatar_url")
      .in("id", userIds)
      .returns<UserRow[]>();

    if (usersError) {
      throw new Error(`Failed to load user records: ${usersError.message}`);
    }

    for (const user of users ?? []) {
      usersById.set(user.id, user);
    }
  }

  let members = (memberships ?? [])
    .map((membership) => {
      const user = usersById.get(membership.user_id);
      if (!user) {
        return null;
      }

      return {
        membershipId: membership.id,
        userId: membership.user_id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
        role: membership.role,
        status: membership.status ?? "active",
        joinedAt: membership.joined_at,
        createdAt: membership.created_at,
        permissions: getRolePermissions(membership.role),
      } satisfies OrganizationMember;
    })
    .filter((member): member is OrganizationMember => member !== null);

  if (filters.role) {
    members = members.filter((member) => member.role === filters.role);
  }
  if (filters.status) {
    members = members.filter((member) => member.status === filters.status);
  }
  if (filters.query) {
    members = members.filter((member) => matchesMemberQuery(member, filters.query ?? ""));
  }

  const { data: invites, error: invitesError } = await supabase
    .from("organization_invites")
    .select("id, organization_id, email, role, display_name, expires_at, created_at")
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .returns<OrganizationInviteRow[]>();

  if (invitesError) {
    throw new Error(`Failed to load organization invites: ${invitesError.message}`);
  }

  let pendingInvites = (invites ?? []).map((invite) => ({
    id: invite.id,
    organizationId: invite.organization_id,
    email: invite.email,
    name: invite.display_name,
    role: invite.role,
    expiresAt: invite.expires_at,
    createdAt: invite.created_at,
    isExpired: Date.parse(invite.expires_at) <= Date.now(),
  }));

  if (filters.role) {
    pendingInvites = pendingInvites.filter((invite) => invite.role === filters.role);
  }
  if (filters.query) {
    pendingInvites = pendingInvites.filter((invite) =>
      matchesInviteQuery(invite, filters.query ?? ""),
    );
  }

  return {
    members,
    invites: pendingInvites,
  };
}

async function countActiveAdmins(organizationId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("organization_memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("role", "org_admin")
    .eq("status", "active");

  if (error) {
    throw new Error(`Failed to count organization admins: ${error.message}`);
  }

  return count ?? 0;
}

export async function updateOrganizationMembership(params: {
  organizationId: string;
  membershipId: string;
  actorUserId: string;
  role?: OrganizationRole;
  status?: MembershipStatus;
  request?: Request | null;
}): Promise<OrganizationMember> {
  const supabase = createSupabaseAdminClient();
  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("id, user_id, organization_id, role, status, joined_at, created_at, updated_at")
    .eq("organization_id", params.organizationId)
    .eq("id", params.membershipId)
    .maybeSingle<MembershipRow>();

  if (membershipError) {
    throw new Error(`Failed to load membership: ${membershipError.message}`);
  }
  if (!membership) {
    throw new Error("Membership not found");
  }

  const nextRole = params.role ?? membership.role;
  const nextStatus = params.status ?? membership.status ?? "active";
  const currentStatus = membership.status ?? "active";

  const removesAdminAccess =
    membership.role === "org_admin" &&
    currentStatus === "active" &&
    (nextRole !== "org_admin" || nextStatus !== "active");

  if (removesAdminAccess) {
    const activeAdminCount = await countActiveAdmins(params.organizationId);
    if (activeAdminCount <= 1) {
      throw new Error(
        "This organization must always have at least one active org admin.",
      );
    }
  }

  const updatePayload: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };
  if (params.role) {
    updatePayload.role = params.role;
  }
  if (params.status) {
    updatePayload.status = params.status;
  }

  const { error: updateError } = await supabase
    .from("organization_memberships")
    .update(updatePayload)
    .eq("id", membership.id);

  if (updateError) {
    throw new Error(`Failed to update membership: ${updateError.message}`);
  }

  if (membership.role !== nextRole) {
    await writeAuditLog({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: "membership.role_changed",
      entityType: "membership",
      entityId: membership.id,
      metadata: {
        targetUserId: membership.user_id,
        previousRole: membership.role,
        nextRole,
      },
      request: params.request,
    });
  }

  if (currentStatus !== nextStatus) {
    await writeAuditLog({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action:
        nextStatus === "suspended"
          ? "membership.suspended"
          : "membership.reactivated",
      entityType: "membership",
      entityId: membership.id,
      metadata: {
        targetUserId: membership.user_id,
        previousStatus: currentStatus,
        nextStatus,
      },
      request: params.request,
    });
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, email, avatar_url")
    .eq("id", membership.user_id)
    .single<UserRow>();

  if (userError) {
    throw new Error(`Failed to load membership user: ${userError.message}`);
  }

  return {
    membershipId: membership.id,
    userId: membership.user_id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url,
    role: nextRole,
    status: nextStatus,
    joinedAt: membership.joined_at,
    createdAt: membership.created_at,
    permissions: getRolePermissions(nextRole),
  };
}
