import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { listWorkflowRunSummaries } from "@/lib/server/executions/service";
import { canViewExecutions } from "@/lib/server/permissions";
import { executionListFilterSchema } from "@/lib/server/validation";

type RouteContext = {
  params: Promise<{ orgSlug: string }>;
};

export const executionsRouteDeps = {
  auth,
  createRequestLogger,
  handleRouteError,
  getApiOrgAccess,
  listWorkflowRunSummaries,
  canViewExecutions,
  executionListFilterSchema,
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await executionsRouteDeps.auth();
  const { orgSlug } = await params;
  const logger = executionsRouteDeps.createRequestLogger(req, {
    route: "api.orgs.executions.get",
    organizationSlug: orgSlug,
    userId: session?.user?.id ?? null,
  });

  const searchParams = new URL(req.url).searchParams;
  const parsed = executionsRouteDeps.executionListFilterSchema.safeParse({
    query: searchParams.get("query") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    source: searchParams.get("source") ?? undefined,
    workflowId: searchParams.get("workflowId") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid execution filters" },
      { status: 400 },
    );
  }

  try {
    const access = await executionsRouteDeps.getApiOrgAccess({
      orgSlug,
      userId: session?.user?.id,
    });

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!executionsRouteDeps.canViewExecutions(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await executionsRouteDeps.listWorkflowRunSummaries({
      organizationId: access.context.organization.id,
      filters: parsed.data,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    return executionsRouteDeps.handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load executions",
      context: {
        organizationSlug: orgSlug,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
