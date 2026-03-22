import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canEditWorkflows } from "@/lib/server/permissions";
import { regenerateWebhookSecretSchema } from "@/lib/server/validation";
import {
  regenerateWorkflowWebhookSecret,
  WorkflowTriggerConflictError,
  WorkflowTriggerNotFoundError,
} from "@/lib/server/triggers/service";

type RouteContext = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export async function POST(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug, workflowId } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.workflows.trigger.webhook-secret.post",
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

  const parsed = regenerateWebhookSecretSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid webhook API key regeneration payload",
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
    if (!canEditWorkflows(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await regenerateWorkflowWebhookSecret({
      organizationId: access.context.organization.id,
      workflowId,
      userId: access.context.userId,
      request: req,
    });

    return NextResponse.json({ secret: result }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof WorkflowTriggerNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof WorkflowTriggerConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to regenerate webhook API key",
      context: {
        organizationSlug: orgSlug,
        workflowId,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
