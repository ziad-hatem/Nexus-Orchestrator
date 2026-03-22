import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canViewWorkflows } from "@/lib/server/permissions";
import {
  listWorkflowVersions,
  WorkflowNotFoundError,
} from "@/lib/server/workflows/service";

type RouteContext = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug, workflowId } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.workflows.versions.get",
    organizationSlug: orgSlug,
    workflowId,
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
    if (!canViewWorkflows(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const versions = await listWorkflowVersions({
      organizationId: access.context.organization.id,
      workflowId,
    });

    return NextResponse.json({ versions }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load workflow versions";
    const status = error instanceof WorkflowNotFoundError ? 404 : 500;
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load workflow versions",
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
