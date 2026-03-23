import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canArchiveWorkflows } from "@/lib/server/permissions";
import { archiveWorkflowSchema } from "@/lib/server/validation";
import {
  archiveWorkflow,
  WorkflowConflictError,
  WorkflowNotFoundError,
} from "@/lib/server/workflows/service";

type RouteContext = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export const workflowArchiveRouteDeps = {
  auth,
  createRequestLogger,
  handleRouteError,
  getApiOrgAccess,
  canArchiveWorkflows,
  archiveWorkflowSchema,
  archiveWorkflow,
};

export async function POST(req: Request, { params }: RouteContext) {
  const session = await workflowArchiveRouteDeps.auth();
  const { orgSlug, workflowId } = await params;
  const logger = workflowArchiveRouteDeps.createRequestLogger(req, {
    route: "api.orgs.workflows.archive.post",
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

  const parsed = workflowArchiveRouteDeps.archiveWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid archive payload" },
      { status: 400 },
    );
  }

  try {
    const access = await workflowArchiveRouteDeps.getApiOrgAccess({
      orgSlug,
      userId: session?.user?.id,
    });

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!workflowArchiveRouteDeps.canArchiveWorkflows(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const detail = await workflowArchiveRouteDeps.archiveWorkflow({
      organizationId: access.context.organization.id,
      workflowId,
      userId: access.context.userId,
      reason: parsed.data.reason,
      request: req,
    });

    return NextResponse.json({ detail }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to archive workflow";
    const status =
      error instanceof WorkflowNotFoundError
        ? 404
        : error instanceof WorkflowConflictError
          ? 409
          : 500;
    return workflowArchiveRouteDeps.handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to archive workflow",
      publicMessage: message,
      status,
      capture: status >= 500,
      context: {
        organizationSlug: orgSlug,
        workflowId,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
