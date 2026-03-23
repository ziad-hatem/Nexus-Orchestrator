import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { getOperationsDashboardData } from "@/lib/server/operations/service";
import { canViewOperations } from "@/lib/server/permissions";
import { operationsDashboardQuerySchema } from "@/lib/server/validation";

type RouteContext = {
  params: Promise<{ orgSlug: string }>;
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.operations.get",
    organizationSlug: orgSlug,
    userId: session?.user?.id ?? null,
  });

  try {
    const parsedQuery = operationsDashboardQuerySchema.safeParse({
      emitAlerts: new URL(req.url).searchParams.get("emitAlerts") ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json({ error: "Invalid operations query" }, { status: 400 });
    }

    const access = await getApiOrgAccess({
      orgSlug,
      userId: session?.user?.id,
    });

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!canViewOperations(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await getOperationsDashboardData({
      organizationId: access.context.organization.id,
      organizationSlug: access.context.organization.slug,
      emitAlerts: parsedQuery.data.emitAlerts,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load operations dashboard",
      context: {
        organizationSlug: orgSlug,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
