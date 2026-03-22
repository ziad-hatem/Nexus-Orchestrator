import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { canViewStreams } from "@/lib/server/permissions";
import { streamFilterSchema } from "@/lib/server/validation";
import { listWorkflowStreams } from "@/lib/server/triggers/service";

type RouteContext = {
  params: Promise<{ orgSlug: string }>;
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.streams.get",
    organizationSlug: orgSlug,
    userId: session?.user?.id ?? null,
  });

  const searchParams = new URL(req.url).searchParams;
  const parsed = streamFilterSchema.safeParse({
    query: searchParams.get("query") ?? undefined,
    source: searchParams.get("source") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    workflowId: searchParams.get("workflowId") ?? undefined,
    eventKey: searchParams.get("eventKey") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid stream filters" },
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
    if (!canViewStreams(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await listWorkflowStreams({
      organizationId: access.context.organization.id,
      filters: parsed.data,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load workflow streams",
      context: {
        organizationSlug: orgSlug,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
