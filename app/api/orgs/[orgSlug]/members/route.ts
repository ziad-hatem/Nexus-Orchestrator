import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { listOrganizationMembers } from "@/lib/server/membership-service";
import { canManageMembers } from "@/lib/server/permissions";
import { memberFilterSchema } from "@/lib/server/validation";

type RouteContext = {
  params: Promise<{ orgSlug: string }>;
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.members.get",
    organizationSlug: orgSlug,
    userId: session?.user?.id ?? null,
  });

  try {
    const access = await getApiOrgAccess({
      orgSlug,
      userId: session?.user?.id,
    });

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!canManageMembers(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = new URL(req.url).searchParams;
    const parsedFilters = memberFilterSchema.safeParse({
      query: searchParams.get("query") ?? undefined,
      role: searchParams.get("role") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    if (!parsedFilters.success) {
      return NextResponse.json(
        { error: parsedFilters.error.issues[0]?.message ?? "Invalid filters" },
        { status: 400 },
      );
    }

    const { members, invites } = await listOrganizationMembers(
      access.context.organization.id,
      parsedFilters.data,
    );

    return NextResponse.json({ members, invites }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load organization members",
      context: {
        organizationSlug: orgSlug,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
