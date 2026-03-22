import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createRequestLogger,
  type LogContext,
} from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { createOrganizationForUser, listUserOrganizations } from "@/lib/server/org-service";
import { createOrganizationSchema } from "@/lib/server/validation";
import {
  ACTIVE_ORG_COOKIE,
  ACTIVE_ORG_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/topbar/constants";

export async function GET(req: Request) {
  const session = await auth();
  const logger = createRequestLogger(req, {
    route: "api.orgs.get",
    userId: session?.user?.id ?? null,
  });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const organizations = await listUserOrganizations(session.user.id);
    return NextResponse.json({ organizations }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load organizations",
      context: {
        userId: session.user.id,
      } satisfies LogContext,
    });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const logger = createRequestLogger(req, {
    route: "api.orgs.post",
    userId: session?.user?.id ?? null,
  });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid organization input" },
      { status: 400 },
    );
  }

  try {
    const organization = await createOrganizationForUser({
      userId: session.user.id,
      name: parsed.data.name,
      request: req,
    });

    const response = NextResponse.json(
      {
        organization,
        redirectPath: `/org/${organization.organizationSlug}`,
      },
      { status: 201 },
    );
    response.cookies.set(ACTIVE_ORG_COOKIE, organization.organizationSlug, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ACTIVE_ORG_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error: unknown) {
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to create organization",
      context: {
        userId: session.user.id,
      } satisfies LogContext,
    });
  }
}
