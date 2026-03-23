import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import {
  cancelWorkflowRun,
  WorkflowExecutionConflictError,
  WorkflowExecutionNotFoundError,
} from "@/lib/server/executions/service";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canCancelRuns } from "@/lib/server/permissions";
import { cancelRunSchema } from "@/lib/server/validation";

type RouteContext = {
  params: Promise<{ orgSlug: string; runId: string }>;
};

export const executionCancelRouteDeps = {
  auth,
  createRequestLogger,
  handleRouteError,
  cancelWorkflowRun,
  getApiOrgAccess,
  canCancelRuns,
  cancelRunSchema,
};

export async function POST(req: Request, { params }: RouteContext) {
  const session = await executionCancelRouteDeps.auth();
  const { orgSlug, runId } = await params;
  const logger = executionCancelRouteDeps.createRequestLogger(req, {
    route: "api.orgs.executions.run.cancel.post",
    organizationSlug: orgSlug,
    runId,
    userId: session?.user?.id ?? null,
  });

  let body: unknown = {};
  try {
    const rawBody = await req.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = executionCancelRouteDeps.cancelRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid cancellation payload" },
      { status: 400 },
    );
  }

  try {
    const access = await executionCancelRouteDeps.getApiOrgAccess({
      orgSlug,
      userId: session?.user?.id,
    });

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!executionCancelRouteDeps.canCancelRuns(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await executionCancelRouteDeps.cancelWorkflowRun({
      organizationId: access.context.organization.id,
      runId,
      actorUserId: access.context.userId,
      reason: parsed.data.reason,
      request: req,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof WorkflowExecutionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof WorkflowExecutionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return executionCancelRouteDeps.handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to cancel execution",
      context: {
        organizationSlug: orgSlug,
        runId,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
