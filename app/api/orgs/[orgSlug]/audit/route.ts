import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { listAuditLogs } from "@/lib/server/audit-log";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canViewAuditLogs } from "@/lib/server/permissions";
import { auditFilterSchema } from "@/lib/server/validation";

type RouteContext = {
  params: Promise<{ orgSlug: string }>;
};

export const auditRouteDeps = {
  auth,
  createRequestLogger,
  handleRouteError,
  listAuditLogs,
  getApiOrgAccess,
  canViewAuditLogs,
  auditFilterSchema,
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await auditRouteDeps.auth();
  const { orgSlug } = await params;
  const logger = auditRouteDeps.createRequestLogger(req, {
    route: "api.orgs.audit.get",
    organizationSlug: orgSlug,
    userId: session?.user?.id ?? null,
  });

  try {
    const access = await auditRouteDeps.getApiOrgAccess({
      orgSlug,
      userId: session?.user?.id,
    });

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!auditRouteDeps.canViewAuditLogs(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = new URL(req.url).searchParams;
    const parsedFilters = auditRouteDeps.auditFilterSchema.safeParse({
      query: searchParams.get("query") ?? undefined,
      action: searchParams.get("action") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    if (!parsedFilters.success) {
      return NextResponse.json(
        { error: parsedFilters.error.issues[0]?.message ?? "Invalid audit filters" },
        { status: 400 },
      );
    }

    const { logs, total, summary, availableActions } = await auditRouteDeps.listAuditLogs(
      access.context.organization.id,
      parsedFilters.data,
    );

    return NextResponse.json(
      {
        logs,
        total,
        summary,
        availableActions,
        page: parsedFilters.data.page,
        pageSize: parsedFilters.data.pageSize,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return auditRouteDeps.handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load audit logs",
      context: {
        organizationSlug: orgSlug,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
