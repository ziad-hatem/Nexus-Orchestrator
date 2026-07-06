import { NextResponse } from "next/server";
import { createRequestLogger, writeLog } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getFirstAvailableEnv, getOptionalEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const demoResetRouteDeps = {
  createRequestLogger,
  handleRouteError,
  getFirstAvailableEnv,
  getOptionalEnv,
  createSupabaseAdminClient,
  writeLog,
};

// Only organizations where the demo user is the sole member are safe to wipe —
// this guards against ever deleting a workspace a real invited user shares.
export function selectSoleMemberOrgIds(
  demoUserId: string,
  memberships: { organization_id: string; user_id: string }[],
): string[] {
  const membersByOrg = new Map<string, Set<string>>();
  for (const row of memberships) {
    const members = membersByOrg.get(row.organization_id) ?? new Set<string>();
    members.add(row.user_id);
    membersByOrg.set(row.organization_id, members);
  }

  const demoOrgIds = new Set(
    memberships
      .filter((row) => row.user_id === demoUserId)
      .map((row) => row.organization_id),
  );

  return Array.from(demoOrgIds).filter((orgId) => {
    const members = membersByOrg.get(orgId);
    return members?.size === 1 && members.has(demoUserId);
  });
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
}

async function handleReset(request: Request) {
  const logger = demoResetRouteDeps.createRequestLogger(request, {
    route: "api.internal.demo.reset",
  });

  let expectedSecret: string;
  try {
    expectedSecret = demoResetRouteDeps.getFirstAvailableEnv(["CRON_SECRET"]);
  } catch (error: unknown) {
    return demoResetRouteDeps.handleRouteError(error, {
      request,
      logger,
      fallbackMessage: "Demo reset secret is not configured",
    });
  }

  const token =
    getBearerToken(request) ?? request.headers.get("x-worker-secret")?.trim() ?? null;

  if (!token || token !== expectedSecret) {
    demoResetRouteDeps.writeLog(logger, "warn", "Rejected demo reset request", {
      securityEvent: "demo_reset_unauthorized",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const demoEmail = demoResetRouteDeps
    .getOptionalEnv("NEXT_PUBLIC_DEMO_EMAIL")
    ?.trim()
    .toLowerCase();

  if (!demoEmail) {
    return NextResponse.json({ ok: true, skipped: "demo_not_configured" });
  }

  try {
    const supabase = demoResetRouteDeps.createSupabaseAdminClient();

    const { data: demoUser, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", demoEmail)
      .maybeSingle<{ id: string }>();

    if (userError) {
      throw new Error(`Failed to load demo user: ${userError.message}`);
    }

    if (!demoUser) {
      return NextResponse.json({ ok: true, skipped: "demo_user_not_found" });
    }

    const { data: demoMemberships, error: demoMembershipError } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", demoUser.id)
      .returns<{ organization_id: string }[]>();

    if (demoMembershipError) {
      throw new Error(`Failed to load demo memberships: ${demoMembershipError.message}`);
    }

    const orgIds = Array.from(
      new Set((demoMemberships ?? []).map((row) => row.organization_id)),
    );

    if (orgIds.length === 0) {
      return NextResponse.json({ ok: true, deletedOrgs: 0 });
    }

    const { data: allMemberships, error: allMembershipError } = await supabase
      .from("organization_memberships")
      .select("organization_id, user_id")
      .in("organization_id", orgIds)
      .returns<{ organization_id: string; user_id: string }[]>();

    if (allMembershipError) {
      throw new Error(`Failed to load organization memberships: ${allMembershipError.message}`);
    }

    const orgIdsToDelete = selectSoleMemberOrgIds(demoUser.id, allMemberships ?? []);

    if (orgIdsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("organizations")
        .delete()
        .in("id", orgIdsToDelete);

      if (deleteError) {
        throw new Error(`Failed to delete demo organizations: ${deleteError.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      deletedOrgs: orgIdsToDelete.length,
      skippedSharedOrgs: orgIds.length - orgIdsToDelete.length,
    });
  } catch (error: unknown) {
    return demoResetRouteDeps.handleRouteError(error, {
      request,
      logger,
      fallbackMessage: "Failed to reset demo data",
    });
  }
}

export async function GET(request: Request) {
  return handleReset(request);
}

export async function POST(request: Request) {
  return handleReset(request);
}
