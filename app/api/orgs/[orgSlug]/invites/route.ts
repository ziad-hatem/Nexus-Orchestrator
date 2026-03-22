import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import { createOrganizationInvite } from "@/lib/server/invite-service";
import { listOrganizationMembers } from "@/lib/server/membership-service";
import { canCreateInvites } from "@/lib/server/permissions";
import { createInviteSchema, memberFilterSchema } from "@/lib/server/validation";

type RouteContext = {
  params: Promise<{ orgSlug: string }>;
};

export async function GET(req: Request, { params }: RouteContext) {
  const session = await auth();
  const { orgSlug } = await params;
  const logger = createRequestLogger(req, {
    route: "api.orgs.invites.get",
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
    if (!canCreateInvites(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = new URL(req.url).searchParams;
    const parsedFilters = memberFilterSchema.safeParse({
      query: searchParams.get("query") ?? undefined,
      role: searchParams.get("role") ?? undefined,
      status: undefined,
    });

    if (!parsedFilters.success) {
      return NextResponse.json(
        { error: parsedFilters.error.issues[0]?.message ?? "Invalid filters" },
        { status: 400 },
      );
    }

    const { invites } = await listOrganizationMembers(
      access.context.organization.id,
      parsedFilters.data,
    );

    return NextResponse.json({ invites }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load organization invites",
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
    route: "api.orgs.invites.post",
    organizationSlug: orgSlug,
    userId: session?.user?.id ?? null,
  });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid invite request" },
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
    if (!canCreateInvites(access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invite = await createOrganizationInvite({
      organizationId: access.context.organization.id,
      actorUserId: access.context.userId,
      email: parsed.data.email,
      name: parsed.data.name ?? null,
      role: parsed.data.role,
      request: req,
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create invite";
    const status =
      message.includes("already exists") || message.includes("already a member")
        ? 409
        : 500;
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to create invite",
      publicMessage: message,
      status,
      capture: status >= 500,
      context: {
        organizationSlug: orgSlug,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
