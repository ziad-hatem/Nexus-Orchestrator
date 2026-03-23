import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canViewWorkflows } from "@/lib/server/permissions";
import { getWorkflowDetail } from "@/lib/server/workflows/service";

type RouteContext = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export const workflowDetailRouteDeps = {
  auth,
  createRequestLogger,
  handleRouteError,
  getApiOrgAccess,
  canViewWorkflows,
  getWorkflowDetail,
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await workflowDetailRouteDeps.auth();
  const { orgSlug, workflowId } = await params;
  const logger = workflowDetailRouteDeps.createRequestLogger(req, {
    route: "api.orgs.workflows.detail.get",
    organizationSlug: orgSlug,
    workflowId,
    userId: session?.user?.id ?? null,
  });

  try {
    const access = await workflowDetailRouteDeps.getApiOrgAccess({
      orgSlug,
      userId: session?.user?.id,
    });

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!workflowDetailRouteDeps.canViewWorkflows(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const detail = await workflowDetailRouteDeps.getWorkflowDetail({
      organizationId: access.context.organization.id,
      workflowId,
    });

    return NextResponse.json({ detail }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load workflow";
    return workflowDetailRouteDeps.handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load workflow",
      publicMessage: message,
      status: message === "Workflow not found" ? 404 : 500,
      capture: message !== "Workflow not found",
      context: {
        organizationSlug: orgSlug,
        workflowId,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
