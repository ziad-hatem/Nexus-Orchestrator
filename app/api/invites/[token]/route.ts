import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { previewInviteByToken } from "@/lib/server/invite-service";

export const invitePreviewRouteDeps = {
  createRequestLogger,
  handleRouteError,
  previewInviteByToken,
};

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(req: Request, { params }: RouteContext) {
  const { token } = await params;
  const logger = invitePreviewRouteDeps.createRequestLogger(req, {
    route: "api.invites.preview.get",
  });

  try {
    const invite = await invitePreviewRouteDeps.previewInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    return NextResponse.json({ invite }, { status: 200 });
  } catch (error: unknown) {
    return invitePreviewRouteDeps.handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to load invite",
      context: {
        route: "api.invites.preview.get",
      },
    });
  }
}
