import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import {
  getWorkflowRunDetail,
  WorkflowExecutionNotFoundError,
} from "@/lib/server/executions/service";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canViewExecutions } from "@/lib/server/permissions";

type RouteContext = {
  params: Promise<{ orgSlug: string; runId: string }>;
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug, runId } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.executions.run.get",
    organizationSlug: orgSlug,
    runId,
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
    if (!canViewExecutions(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await getWorkflowRunDetail({
      organizationId: access.context.organization.id,
      runId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof WorkflowExecutionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load execution detail",
      context: {
        organizationSlug: orgSlug,
        runId,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
