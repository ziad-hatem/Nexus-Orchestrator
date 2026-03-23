import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canTriggerWorkflows } from "@/lib/server/permissions";
import { manualTriggerRequestSchema } from "@/lib/server/validation";
import {
  executeManualTrigger,
  WorkflowTriggerConflictError,
  WorkflowTriggerDuplicateError,
  WorkflowTriggerNotFoundError,
  WorkflowTriggerRateLimitError,
} from "@/lib/server/triggers/service";

type RouteContext = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export const manualTriggerRouteDeps = {
  auth,
  createRequestLogger,
  handleRouteError,
  getApiOrgAccess,
  canTriggerWorkflows,
  manualTriggerRequestSchema,
  executeManualTrigger,
};

function getRequestIp(request: Request): string | null {
  const header = request.headers.get("x-forwarded-for");
  return header?.split(",")[0]?.trim() || null;
}

export async function POST(req: Request, { params }: RouteContext) {
  const session = await manualTriggerRouteDeps.auth();
  const { orgSlug, workflowId } = await params;
  const logger = manualTriggerRouteDeps.createRequestLogger(req, {
    route: "api.orgs.workflows.trigger.manual.post",
    organizationSlug: orgSlug,
    workflowId,
    userId: session?.user?.id ?? null,
  });

  let body: unknown = {};
  try {
    const rawBody = await req.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = manualTriggerRouteDeps.manualTriggerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid manual trigger payload",
      },
      { status: 400 },
    );
  }

  try {
    const access = await manualTriggerRouteDeps.getApiOrgAccess({
      orgSlug,
      userId: session?.user?.id,
    });

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!manualTriggerRouteDeps.canTriggerWorkflows(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await manualTriggerRouteDeps.executeManualTrigger({
      organizationId: access.context.organization.id,
      workflowId,
      userId: access.context.userId,
      payload: parsed.data.payload,
      idempotencyKey: parsed.data.idempotencyKey,
      request: req,
      requestIp: getRequestIp(req),
      requestUserAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof WorkflowTriggerNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof WorkflowTriggerConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof WorkflowTriggerRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof WorkflowTriggerDuplicateError) {
      return NextResponse.json({ error: error.message }, { status: 202 });
    }

    return manualTriggerRouteDeps.handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to execute manual trigger",
      context: {
        organizationSlug: orgSlug,
        workflowId,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
