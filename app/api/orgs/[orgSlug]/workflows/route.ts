import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import {
  canEditWorkflows,
  canViewWorkflows,
} from "@/lib/server/permissions";
import {
  createWorkflowSchema,
  workflowListFilterSchema,
} from "@/lib/server/validation";
import {
  createWorkflow,
  listWorkflows,
} from "@/lib/server/workflows/service";

type RouteContext = {
  params: Promise<{ orgSlug: string }>;
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.workflows.get",
    organizationSlug: orgSlug,
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

    const searchParams = new URL(req.url).searchParams;
    const parsed = workflowListFilterSchema.safeParse({
      query: searchParams.get("query") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid workflow filters" },
        { status: 400 },
      );
    }

    const result = await listWorkflows({
      organizationId: access.context.organization.id,
      filters: parsed.data,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load workflows",
      context: {
        organizationSlug: orgSlug,
        userId: session?.user?.id ?? null,
      },
    });
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.workflows.post",
    organizationSlug: orgSlug,
    userId: session?.user?.id ?? null,
  });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid workflow payload" },
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

    const draft = await createWorkflow({
      organizationId: access.context.organization.id,
      userId: access.context.userId,
      name: parsed.data.name,
      description: parsed.data.description,
      category: parsed.data.category,
      tags: parsed.data.tags,
      triggerType: parsed.data.triggerType,
      request: req,
    });

    return NextResponse.json(
      {
        draft,
        redirectPath: `/org/${orgSlug}/workflows/${draft.workflowId}/draft`,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to create workflow",
      context: {
        organizationSlug: orgSlug,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
