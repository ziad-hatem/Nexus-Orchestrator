import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canViewWorkflows } from "@/lib/server/permissions";
import { workflowVersionNumberSchema } from "@/lib/server/validation";
import {
  getWorkflowVersionSnapshot,
  WorkflowNotFoundError,
} from "@/lib/server/workflows/service";

type RouteContext = {
  params: Promise<{
    orgSlug: string;
    workflowId: string;
    versionNumber: string;
  }>;
};

export const workflowVersionRouteDeps = {
  auth,
  createRequestLogger,
  handleRouteError,
  getApiOrgAccess,
  canViewWorkflows,
  workflowVersionNumberSchema,
  getWorkflowVersionSnapshot,
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await workflowVersionRouteDeps.auth();
  const { orgSlug, workflowId, versionNumber } = await params;
  const logger = workflowVersionRouteDeps.createRequestLogger(req, {
    route: "api.orgs.workflows.version.get",
    organizationSlug: orgSlug,
    workflowId,
    versionNumber,
    userId: session?.user?.id ?? null,
  });

  const parsedVersion =
    workflowVersionRouteDeps.workflowVersionNumberSchema.safeParse(
      versionNumber,
    );
  if (!parsedVersion.success) {
    return NextResponse.json(
      { error: parsedVersion.error.issues[0]?.message ?? "Invalid version number" },
      { status: 400 },
    );
  }

  try {
    const access = await workflowVersionRouteDeps.getApiOrgAccess({
      orgSlug,
      userId: session?.user?.id,
    });

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!workflowVersionRouteDeps.canViewWorkflows(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const version = await workflowVersionRouteDeps.getWorkflowVersionSnapshot({
      organizationId: access.context.organization.id,
      workflowId,
      versionNumber: parsedVersion.data,
    });

    return NextResponse.json({ version }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load workflow version";
    const status = error instanceof WorkflowNotFoundError ? 404 : 500;
    return workflowVersionRouteDeps.handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load workflow version",
      publicMessage: message,
      status,
      capture: status >= 500,
      context: {
        organizationSlug: orgSlug,
        workflowId,
        versionNumber,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
