import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRequestLogger, writeLog } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getApiOrgAccess } from "@/lib/server/org-access";
import {
  canViewAuditLogs,
  canViewExecutions,
  canViewOperations,
  canViewStreams,
  type OrganizationRole,
} from "@/lib/server/permissions";
import {
  getOrganizationRealtimeVersion,
  ORG_REALTIME_CHANNELS,
  type OrgRealtimeChannel,
} from "@/lib/server/realtime/service";

type RouteContext = {
  params: Promise<{ orgSlug: string }>;
};

type RealtimeEventPayload = {
  type: "connected" | "refresh" | "ping";
  channel: OrgRealtimeChannel;
  version: string;
  at: string;
};

const REALTIME_POLL_INTERVAL_MS = 5000;
const REALTIME_RETRY_MS = 5000;

export const dynamic = "force-dynamic";

export const orgRealtimeRouteDeps = {
  auth,
  createRequestLogger,
  writeLog,
  handleRouteError,
  getApiOrgAccess,
  getOrganizationRealtimeVersion,
  canViewAuditLogs,
  canViewExecutions,
  canViewOperations,
  canViewStreams,
};

function isOrgRealtimeChannel(value: string | null): value is OrgRealtimeChannel {
  return value !== null && ORG_REALTIME_CHANNELS.includes(value as OrgRealtimeChannel);
}

function canViewRealtimeChannel(
  channel: OrgRealtimeChannel,
  role: OrganizationRole,
): boolean {
  switch (channel) {
    case "audit":
      return orgRealtimeRouteDeps.canViewAuditLogs(role);
    case "streams":
      return orgRealtimeRouteDeps.canViewStreams(role);
    case "executions":
      return orgRealtimeRouteDeps.canViewExecutions(role);
    case "operations":
      return orgRealtimeRouteDeps.canViewOperations(role);
  }
}

function formatSseEvent(event: string, payload: RealtimeEventPayload): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function closeSseController(controller: ReadableStreamDefaultController<Uint8Array>) {
  try {
    controller.close();
  } catch {
    // The stream may already be closed during client disconnects.
  }
}

export async function GET(req: Request, { params }: RouteContext) {
  const session = await orgRealtimeRouteDeps.auth();
  const { orgSlug } = await params;
  const logger = orgRealtimeRouteDeps.createRequestLogger(req, {
    route: "api.orgs.realtime.get",
    organizationSlug: orgSlug,
    userId: session?.user?.id ?? null,
  });

  try {
    const channel = new URL(req.url).searchParams.get("channel");
    if (!isOrgRealtimeChannel(channel)) {
      return NextResponse.json({ error: "Invalid realtime channel" }, { status: 400 });
    }

    const access = await orgRealtimeRouteDeps.getApiOrgAccess({
      orgSlug,
      userId: session?.user?.id,
    });

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!canViewRealtimeChannel(channel, access.context.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let currentVersion = await orgRealtimeRouteDeps.getOrganizationRealtimeVersion({
      organizationId: access.context.organization.id,
      channel,
    });

    const encoder = new TextEncoder();
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;

        const send = (event: RealtimeEventPayload["type"], version: string) => {
          if (closed) {
            return;
          }

          controller.enqueue(
            encoder.encode(
              formatSseEvent(event, {
                type: event,
                channel,
                version,
                at: new Date().toISOString(),
              }),
            ),
          );
        };

        const cleanup = () => {
          if (closed) {
            return;
          }

          closed = true;
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          req.signal.removeEventListener("abort", abortListener);
          closeSseController(controller);
        };

        const abortListener = () => {
          cleanup();
        };

        req.signal.addEventListener("abort", abortListener);

        controller.enqueue(encoder.encode(`retry: ${REALTIME_RETRY_MS}\n\n`));
        send("connected", currentVersion);

        intervalId = setInterval(() => {
          void (async () => {
            try {
              const nextVersion =
                await orgRealtimeRouteDeps.getOrganizationRealtimeVersion({
                  organizationId: access.context.organization.id,
                  channel,
                });

              if (nextVersion !== currentVersion) {
                currentVersion = nextVersion;
                send("refresh", currentVersion);
                return;
              }

              send("ping", currentVersion);
            } catch (error: unknown) {
              orgRealtimeRouteDeps.writeLog(
                logger,
                "warn",
                "Failed to poll org realtime channel",
                {
                  channel,
                  error: error instanceof Error ? error.message : "Unknown error",
                },
              );
            }
          })();
        }, REALTIME_POLL_INTERVAL_MS);
      },
      cancel() {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    return orgRealtimeRouteDeps.handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to open org realtime stream",
      context: {
        organizationSlug: orgSlug,
        userId: session?.user?.id ?? null,
      },
    });
  }
}
