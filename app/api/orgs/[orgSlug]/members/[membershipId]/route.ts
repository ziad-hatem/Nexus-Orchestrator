import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { updateOrganizationMembership } from "@/lib/server/membership-service";
import { canManageMembers } from "@/lib/server/permissions";
import { updateMembershipSchema } from "@/lib/server/validation";

export const orgMemberRouteDeps = {
  auth,
  createRequestLogger,
  handleRouteError,
  getApiOrgAccess,
  updateOrganizationMembership,
  canManageMembers,
  updateMembershipSchema,
};

type RouteContext = {
  params: Promise<{ orgSlug: string; membershipId: string }>;
};

export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await orgMemberRouteDeps.auth();
  const { orgSlug, membershipId } = await params;
  const logger = orgMemberRouteDeps.createRequestLogger(req, {
    route: "api.orgs.members.patch",
    organizationSlug: orgSlug,
    membershipId,
    userId: session?.user?.id ?? null,
  });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = orgMemberRouteDeps.updateMembershipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid membership update" },
      { status: 400 },
    );
  }

  try {
    const access = await orgMemberRouteDeps.getApiOrgAccess({
      orgSlug,
      userId: session?.user?.id,
    });

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!orgMemberRouteDeps.canManageMembers(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const member = await orgMemberRouteDeps.updateOrganizationMembership({
      organizationId: access.context.organization.id,
      membershipId,
      actorUserId: access.context.userId,
      role: parsed.data.role,
      status: parsed.data.status,
      request: req,
    });

    return NextResponse.json({ member }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update membership";
    const status =
      message === "Membership not found"
        ? 404
        : message.includes("at least one active org admin")
          ? 409
          : 500;
    return orgMemberRouteDeps.handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to update membership",
      publicMessage: message,
      status,
      capture: status >= 500,
      context: {
        organizationSlug: orgSlug,
        membershipId,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
