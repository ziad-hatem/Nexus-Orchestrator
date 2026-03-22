import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canEditWorkflows } from "@/lib/server/permissions";
import { updateWorkflowDraftSchema } from "@/lib/server/validation";
import {
  getOrCreateWorkflowDraft,
  updateWorkflowDraft,
  WorkflowConflictError,
  WorkflowNotFoundError,
} from "@/lib/server/workflows/service";

type RouteContext = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug, workflowId } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.workflows.draft.get",
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
    if (!canEditWorkflows(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const draft = await getOrCreateWorkflowDraft({
      organizationId: access.context.organization.id,
      workflowId,
      userId: access.context.userId,
    });

    return NextResponse.json({ draft }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load workflow draft";
    const status =
      error instanceof WorkflowNotFoundError
        ? 404
        : error instanceof WorkflowConflictError
          ? 409
          : 500;
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load workflow draft",
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

export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug, workflowId } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.workflows.draft.patch",
    organizationSlug: orgSlug,
    workflowId,
    userId: session?.user?.id ?? null,
  });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = updateWorkflowDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid workflow draft payload" },
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

    const draft = await updateWorkflowDraft({
      organizationId: access.context.organization.id,
      workflowId,
      userId: access.context.userId,
      input: parsed.data,
      request: req,
    });

    return NextResponse.json({ draft }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update workflow draft";
    const status =
      error instanceof WorkflowNotFoundError
        ? 404
        : error instanceof WorkflowConflictError
          ? 409
          : 500;
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to update workflow draft",
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
