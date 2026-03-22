import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import {
  canTriggerWorkflows,
  canViewWorkflows,
} from "@/lib/server/permissions";
import {
  getWorkflowTriggerDetails,
  WorkflowTriggerNotFoundError,
} from "@/lib/server/triggers/service";

type RouteContext = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug, workflowId } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.workflows.trigger.get",
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

    const details = await getWorkflowTriggerDetails({
      organizationId: access.context.organization.id,
      workflowId,
      canTriggerManually: canTriggerWorkflows(access.context.membership.role),
    });

    return NextResponse.json({ details }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof WorkflowTriggerNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load workflow trigger details",
      context: {
        organizationSlug: orgSlug,
        workflowId,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
