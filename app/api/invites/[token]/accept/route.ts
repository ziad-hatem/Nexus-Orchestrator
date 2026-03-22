import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { acceptOrganizationInvite } from "@/lib/server/invite-service";
import {
  ACTIVE_ORG_COOKIE,
  ACTIVE_ORG_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/topbar/constants";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(req: Request, { params }: RouteContext) {
  const session = await auth();
  const logger = createRequestLogger(req, {
    route: "api.invites.accept.post",
    userId: session?.user?.id ?? null,
  });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await params;

  try {
    const acceptedInvite = await acceptOrganizationInvite({
      token,
      userId: session.user.id,
      request: req,
    });

    const response = NextResponse.json(
      {
        organizationName: acceptedInvite.organizationName,
        organizationSlug: acceptedInvite.organizationSlug,
        redirectPath: `/org/${acceptedInvite.organizationSlug}`,
      },
      { status: 200 },
    );
    response.cookies.set(ACTIVE_ORG_COOKIE, acceptedInvite.organizationSlug, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ACTIVE_ORG_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to accept invite";
    const status =
      message.includes("not found")
        ? 404
        : message.includes("Unauthorized")
          ? 401
          : message.includes("different email") ||
              message.includes("revoked") ||
              message.includes("expired")
            ? 409
          : 500;

    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to accept invite",
      publicMessage: message,
      status,
      capture: status >= 500,
      context: {
        userId: session.user.id,
      },
    });
  }
}
