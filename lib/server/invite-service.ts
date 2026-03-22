import { createHash, randomBytes } from "node:crypto";
import { Resend } from "resend";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import OrganizationInviteEmail from "@/app/emails/OrganizationInviteEmail";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  type MembershipStatus,
  type OrganizationRole,
} from "@/lib/server/permissions";
import { normalizeEmail } from "@/lib/server/validation";

type OrganizationInviteRow = {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  display_name: string | null;
  token_hash: string;
  expires_at: string;
  invited_by: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type MembershipRow = {
  id: string;
  user_id: string;
  organization_id: string;
  role: OrganizationRole;
  status: MembershipStatus | null;
  joined_at: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
};

type AuthUserRow = {
  id: string;
  email: string;
};

export type InvitePreview = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  email: string;
  role: OrganizationRole;
  displayName: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  isExpired: boolean;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function getAppBaseUrl(): string {
  const base =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function sendOrganizationInviteEmail(params: {
  toEmail: string;
  inviteLink: string;
  organizationName: string;
  role: OrganizationRole;
  inviteeName?: string | null;
}): Promise<void> {
  const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));
  const fromAddress =
    process.env.RESEND_FROM_EMAIL ?? "Nexus Orchestrator <onboarding@resend.dev>";

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [params.toEmail],
    subject: `You're invited to ${params.organizationName} on Nexus Orchestrator`,
    react: await OrganizationInviteEmail({
      organizationName: params.organizationName,
      inviteLink: params.inviteLink,
      inviteeEmail: params.toEmail,
      inviteeName: params.inviteeName ?? null,
      role: params.role,
    }),
  });

  if (error) {
    throw new Error(error.message ?? "Failed to send organization invite email");
  }
}

async function loadOrganization(organizationId: string): Promise<OrganizationRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", organizationId)
    .single<OrganizationRow>();

  if (error || !data) {
    throw new Error(`Failed to load organization: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

async function upsertMembershipFromInvite(params: {
  invite: OrganizationInviteRow;
  userId: string;
}): Promise<MembershipRow> {
  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data: existingMembership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("id, user_id, organization_id, role, status, joined_at")
    .eq("organization_id", params.invite.organization_id)
    .eq("user_id", params.userId)
    .maybeSingle<MembershipRow>();

  if (membershipError) {
    throw new Error(`Failed to load invite membership: ${membershipError.message}`);
  }

  if (existingMembership) {
    const { data: updatedMembership, error: updateError } = await supabase
      .from("organization_memberships")
      .update({
        role: params.invite.role,
        status: "active",
        joined_at: existingMembership.joined_at ?? nowIso,
        updated_at: nowIso,
      })
      .eq("id", existingMembership.id)
      .select("id, user_id, organization_id, role, status, joined_at")
      .single<MembershipRow>();

    if (updateError || !updatedMembership) {
      throw new Error(
        `Failed to update membership from invite: ${updateError?.message ?? "Unknown error"}`,
      );
    }

    return updatedMembership;
  }

  const { data: insertedMembership, error: insertError } = await supabase
    .from("organization_memberships")
    .insert({
      user_id: params.userId,
      organization_id: params.invite.organization_id,
      role: params.invite.role,
      status: "active",
      joined_at: nowIso,
    })
    .select("id, user_id, organization_id, role, status, joined_at")
    .single<MembershipRow>();

  if (insertError || !insertedMembership) {
    throw new Error(
      `Failed to create membership from invite: ${insertError?.message ?? "Unknown error"}`,
    );
  }

  return insertedMembership;
}

async function markInviteAccepted(inviteId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("organization_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", inviteId);

  if (error) {
    throw new Error(`Failed to mark invite accepted: ${error.message}`);
  }
}

export async function previewInviteByToken(token: string): Promise<InvitePreview | null> {
  const supabase = createSupabaseAdminClient();
  const tokenHash = hashInviteToken(token);
  const { data: invite, error } = await supabase
    .from("organization_invites")
    .select(
      "id, organization_id, email, role, display_name, token_hash, expires_at, invited_by, accepted_at, revoked_at, created_at",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle<OrganizationInviteRow>();

  if (error) {
    throw new Error(`Failed to load invite preview: ${error.message}`);
  }
  if (!invite) {
    return null;
  }

  const organization = await loadOrganization(invite.organization_id);

  return {
    id: invite.id,
    organizationId: invite.organization_id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    email: invite.email,
    role: invite.role,
    displayName: invite.display_name,
    expiresAt: invite.expires_at,
    acceptedAt: invite.accepted_at,
    revokedAt: invite.revoked_at,
    isExpired: Date.parse(invite.expires_at) <= Date.now(),
  };
}

export async function createOrganizationInvite(params: {
  organizationId: string;
  actorUserId: string;
  email: string;
  name?: string | null;
  role: OrganizationRole;
  request?: Request | null;
}): Promise<InvitePreview> {
  const supabase = createSupabaseAdminClient();
  const email = normalizeEmail(params.email);
  if (!email) {
    throw new Error("A valid invite email is required.");
  }

  const organization = await loadOrganization(params.organizationId);

  const { data: pendingInvites, error: pendingInvitesError } = await supabase
    .from("organization_invites")
    .select(
      "id, organization_id, email, role, display_name, token_hash, expires_at, invited_by, accepted_at, revoked_at, created_at",
    )
    .eq("organization_id", params.organizationId)
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .returns<OrganizationInviteRow[]>();

  if (pendingInvitesError) {
    throw new Error(`Failed to check existing invites: ${pendingInvitesError.message}`);
  }

  const hasPendingInvite = (pendingInvites ?? []).some(
    (invite) => Date.parse(invite.expires_at) > Date.now(),
  );
  if (hasPendingInvite) {
    throw new Error("An active invitation already exists for this email.");
  }

  const { data: matchingUsers, error: matchingUsersError } = await supabase
    .from("users")
    .select("id, email")
    .eq("email", email)
    .returns<AuthUserRow[]>();

  if (matchingUsersError) {
    throw new Error(`Failed to validate invite recipient: ${matchingUsersError.message}`);
  }

  if ((matchingUsers ?? []).length > 0) {
    const matchingUserIds = matchingUsers.map((user) => user.id);
    const { data: memberships, error: membershipsError } = await supabase
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", params.organizationId)
      .in("user_id", matchingUserIds);

    if (membershipsError) {
      throw new Error(`Failed to validate invite membership: ${membershipsError.message}`);
    }

    if ((memberships ?? []).length > 0) {
      throw new Error("This user is already a member of the organization.");
    }
  }

  const token = randomBytes(24).toString("hex");
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: createdInvite, error: insertError } = await supabase
    .from("organization_invites")
    .insert({
      organization_id: params.organizationId,
      email,
      role: params.role,
      display_name: params.name ?? null,
      token_hash: tokenHash,
      expires_at: expiresAt,
      invited_by: params.actorUserId,
    })
    .select(
      "id, organization_id, email, role, display_name, token_hash, expires_at, invited_by, accepted_at, revoked_at, created_at",
    )
    .single<OrganizationInviteRow>();

  if (insertError || !createdInvite) {
    throw new Error(
      `Failed to create invite: ${insertError?.message ?? "Unknown error"}`,
    );
  }

  const inviteLink = `${getAppBaseUrl()}/invite/${token}`;
  await sendOrganizationInviteEmail({
    toEmail: email,
    inviteLink,
    organizationName: organization.name,
    role: params.role,
    inviteeName: params.name ?? null,
  });

  await writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    action: "invite.sent",
    entityType: "invite",
    entityId: createdInvite.id,
    metadata: {
      email,
      displayName: params.name ?? null,
      role: params.role,
      expiresAt,
    },
    request: params.request,
  });

  return {
    id: createdInvite.id,
    organizationId: createdInvite.organization_id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    email: createdInvite.email,
    role: createdInvite.role,
    displayName: createdInvite.display_name,
    expiresAt: createdInvite.expires_at,
    acceptedAt: createdInvite.accepted_at,
    revokedAt: createdInvite.revoked_at,
    isExpired: false,
  };
}

export async function acceptOrganizationInvite(params: {
  token: string;
  userId: string;
  request?: Request | null;
}): Promise<{ organizationSlug: string; organizationName: string }> {
  const preview = await previewInviteByToken(params.token);
  if (!preview) {
    throw new Error("Invite not found.");
  }
  if (preview.acceptedAt) {
    return {
      organizationSlug: preview.organizationSlug,
      organizationName: preview.organizationName,
    };
  }
  if (preview.revokedAt) {
    throw new Error("This invite has been revoked.");
  }
  if (preview.isExpired) {
    throw new Error("This invite has expired.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(
    params.userId,
  );

  if (authUserError || !authUser.user?.email) {
    throw new Error("Could not verify the authenticated account.");
  }

  if (normalizeEmail(authUser.user.email) !== normalizeEmail(preview.email)) {
    throw new Error("This invite belongs to a different email address.");
  }

  const { data: invite, error: inviteError } = await supabase
    .from("organization_invites")
    .select(
      "id, organization_id, email, role, display_name, token_hash, expires_at, invited_by, accepted_at, revoked_at, created_at",
    )
    .eq("id", preview.id)
    .single<OrganizationInviteRow>();

  if (inviteError || !invite) {
    throw new Error(`Failed to reload invite: ${inviteError?.message ?? "Unknown error"}`);
  }

  await upsertMembershipFromInvite({
    invite,
    userId: params.userId,
  });
  await markInviteAccepted(invite.id);

  await writeAuditLog({
    organizationId: preview.organizationId,
    actorUserId: params.userId,
    action: "invite.accepted",
    entityType: "invite",
    entityId: invite.id,
    metadata: {
      email: invite.email,
      role: invite.role,
    },
    request: params.request,
  });

  return {
    organizationSlug: preview.organizationSlug,
    organizationName: preview.organizationName,
  };
}

export async function claimPendingInvitesForUser(
  user: SupabaseAuthUser,
): Promise<void> {
  const email = normalizeEmail(user.email);
  if (!email) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data: invites, error } = await supabase
    .from("organization_invites")
    .select(
      "id, organization_id, email, role, display_name, token_hash, expires_at, invited_by, accepted_at, revoked_at, created_at",
    )
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .returns<OrganizationInviteRow[]>();

  if (error) {
    throw new Error(`Failed to load pending invites: ${error.message}`);
  }

  const claimableInvites = (invites ?? []).filter(
    (invite) => Date.parse(invite.expires_at) > Date.now(),
  );

  for (const invite of claimableInvites) {
    await upsertMembershipFromInvite({ invite, userId: user.id });
    await markInviteAccepted(invite.id);
    await writeAuditLog({
      organizationId: invite.organization_id,
      actorUserId: user.id,
      action: "invite.accepted",
      entityType: "invite",
      entityId: invite.id,
      metadata: {
        email: invite.email,
        role: invite.role,
        claimedDuringBootstrap: true,
      },
    });
  }
}
