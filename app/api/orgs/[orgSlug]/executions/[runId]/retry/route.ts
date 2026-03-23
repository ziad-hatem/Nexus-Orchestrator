import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import {
  retryWorkflowRun,
  WorkflowExecutionConflictError,
  WorkflowExecutionNotFoundError,
} from "@/lib/server/executions/service";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canRetryRuns } from "@/lib/server/permissions";
import { retryRunSchema } from "@/lib/server/validation";

type RouteContext = {
  params: Promise<{ orgSlug: string; runId: string }>;
};

export async function POST(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug, runId } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.executions.run.retry.post",
    organizationSlug: orgSlug,
    runId,
    userId: session?.user?.id ?? null,
  });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = retryRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid retry payload" },
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
    if (!canRetryRuns(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await retryWorkflowRun({
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

    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to retry execution",
      context: {
        organizationSlug: orgSlug,
        runId,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
