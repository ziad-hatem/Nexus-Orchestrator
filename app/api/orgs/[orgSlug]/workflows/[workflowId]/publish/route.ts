import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canPublishWorkflows } from "@/lib/server/permissions";
import { WorkflowTriggerConflictError } from "@/lib/server/triggers/service";
import { publishWorkflowSchema } from "@/lib/server/validation";
import {
  publishWorkflow,
  WorkflowConflictError,
  WorkflowNotFoundError,
  WorkflowValidationError,
} from "@/lib/server/workflows/service";

type RouteContext = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export const workflowPublishRouteDeps = {
  auth,
  createRequestLogger,
  handleRouteError,
  getApiOrgAccess,
  canPublishWorkflows,
  publishWorkflowSchema,
  publishWorkflow,
};

export async function POST(req: Request, { params }: RouteContext) {
  const session = await workflowPublishRouteDeps.auth();
  const { orgSlug, workflowId } = await params;
  const logger = workflowPublishRouteDeps.createRequestLogger(req, {
    route: "api.orgs.workflows.publish.post",
    organizationSlug: orgSlug,
    workflowId,
    userId: session?.user?.id ?? null,
  });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = workflowPublishRouteDeps.publishWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid publish payload" },
      { status: 400 },
    );
  }

  try {
    const access = await workflowPublishRouteDeps.getApiOrgAccess({
      orgSlug,
      userId: session?.user?.id,
    });

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!workflowPublishRouteDeps.canPublishWorkflows(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const version = await workflowPublishRouteDeps.publishWorkflow({
      organizationId: access.context.organization.id,
      workflowId,
      userId: access.context.userId,
      notes: parsed.data.notes,
      request: req,
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to publish workflow";
    const status =
      error instanceof WorkflowNotFoundError
        ? 404
        : error instanceof WorkflowValidationError ||
            error instanceof WorkflowConflictError ||
            error instanceof WorkflowTriggerConflictError
          ? 409
          : 500;
    const responseBody =
      error instanceof WorkflowValidationError
        ? { error: message, issues: error.issues }
        : { error: message };

    if (status < 500) {
      return NextResponse.json(responseBody, { status });
    }

    return workflowPublishRouteDeps.handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to publish workflow",
      publicMessage: message,
      status,
      context: {
        organizationSlug: orgSlug,
        workflowId,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
