import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canViewWorkflows } from "@/lib/server/permissions";
import { triggerAttemptFilterSchema } from "@/lib/server/validation";
import {
  listWorkflowTriggerAttempts,
  WorkflowTriggerNotFoundError,
} from "@/lib/server/triggers/service";

type RouteContext = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug, workflowId } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.workflows.trigger.attempts.get",
    organizationSlug: orgSlug,
    workflowId,
    userId: session?.user?.id ?? null,
  });

  const searchParams = new URL(req.url).searchParams;
  const parsed = triggerAttemptFilterSchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid trigger attempt filters",
      },
      { status: 400 },
    );
  }

  try {
    const access = await getApiOrgAccess({
      orgSlug,
      userId: session?.user?.id,
    });

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!canViewWorkflows(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const attempts = await listWorkflowTriggerAttempts({
      organizationId: access.context.organization.id,
      workflowId,
      filters: parsed.data,
    });

    return NextResponse.json(attempts, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof WorkflowTriggerNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load trigger attempts",
      context: {
        organizationSlug: orgSlug,
        workflowId,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
