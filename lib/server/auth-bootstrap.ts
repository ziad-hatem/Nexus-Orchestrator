import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { normalizeAvatarUrl } from "@/lib/avatar-url";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { claimPendingInvitesForUser } from "@/lib/server/invite-service";
import {
  createOrganizationForUser,
  listUserOrganizations,
} from "@/lib/server/org-service";
import { normalizeOptionalText } from "@/lib/server/validation";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
};

function buildDisplayName(user: SupabaseAuthUser): string | null {
  const firstName = normalizeOptionalText(user.user_metadata?.first_name, 80);
  const lastName = normalizeOptionalText(user.user_metadata?.last_name, 80);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return (
    fullName ||
    normalizeOptionalText(user.user_metadata?.name, 160) ||
    normalizeOptionalText(user.email?.split("@")[0], 120)
  );
}

function resolveOrganizationName(user: SupabaseAuthUser): string {
  const metadataCompany = normalizeOptionalText(user.user_metadata?.company, 120);
  if (metadataCompany) {
    return metadataCompany;
  }

  const displayName = buildDisplayName(user);
  if (displayName) {
    return `${displayName}'s Workspace`;
  }

  return "My Workspace";
}

async function ensureUserRow(user: SupabaseAuthUser): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("Authenticated user is missing an email address.");
  }

  const nextName = buildDisplayName(user);
  const nextAvatarUrl = normalizeAvatarUrl(user.user_metadata?.avatar_url);

  const { data: existingUser, error: existingUserError } = await supabase
    .from("users")
    .select("id, name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle<UserRow>();

  if (existingUserError) {
    throw new Error(`Failed to load app user row: ${existingUserError.message}`);
  }

  if (!existingUser) {
    const { error: insertError } = await supabase.from("users").insert({
      id: user.id,
      name: nextName,
      email,
      avatar_url: nextAvatarUrl,
      email_verified_at: user.email_confirmed_at ?? null,
    });

    if (insertError) {
      throw new Error(`Failed to create app user row: ${insertError.message}`);
    }

    return;
  }

  const updates: Record<string, string | null> = {};
  if (existingUser.email !== email) {
    updates.email = email;
  }
  if ((existingUser.name ?? null) !== (nextName ?? null)) {
    updates.name = nextName;
  }
  if ((existingUser.avatar_url ?? null) !== (nextAvatarUrl ?? null)) {
    updates.avatar_url = nextAvatarUrl;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    throw new Error(`Failed to sync app user row: ${updateError.message}`);
  }
}

async function ensureDefaultOrganizationMembership(
  user: SupabaseAuthUser,
): Promise<void> {
  const memberships = await listUserOrganizations(user.id);
  if (memberships.length > 0) {
    return;
  }

  await createOrganizationForUser({
    userId: user.id,
    name: resolveOrganizationName(user),
  });
}

export async function ensureAuthUserAppBootstrap(
  user: SupabaseAuthUser,
): Promise<void> {
  await ensureUserRow(user);
  await claimPendingInvitesForUser(user);
  await ensureDefaultOrganizationMembership(user);
}
