import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { ingestWebhookDelivery } from "@/lib/server/triggers/service";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function getRequestIp(request: Request): string | null {
  const header = request.headers.get("x-forwarded-for");
  return header?.split(",")[0]?.trim() || null;
}

function parsePayload(rawBody: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawBody);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { value: parsed };
  } catch {
    return { rawBody };
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  const { path } = await params;
  const pathname = `/hooks/${path.join("/")}`;
  const logger = createRequestLogger(req, {
    route: "hooks.catchall.post",
    path: pathname,
  });

  try {
    const rawBody = await req.text();
    const result = await ingestWebhookDelivery({
      pathname,
      rawBody,
      payload: parsePayload(rawBody),
      requestIp: getRequestIp(req),
      requestUserAgent: req.headers.get("user-agent"),
      apiKeyHeader: req.headers.get("x-nexus-api-key"),
      deliveryId: req.headers.get("x-nexus-delivery-id"),
    });

    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Webhook endpoint not found" }, { status: 404 });
    }
    if (result.kind === "rejected") {
      return NextResponse.json(
        { error: "Webhook API key validation failed" },
        { status: 401 },
      );
    }
    if (result.kind === "rate_limited") {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    if (result.kind === "duplicate") {
      return NextResponse.json(
        { message: "Duplicate delivery ignored" },
        { status: 202 },
      );
    }

    return NextResponse.json(
      {
        message: "Webhook accepted",
        eventId: result.event.id,
        runId: result.run.runId,
      },
      { status: 202 },
    );
  } catch (error: unknown) {
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to ingest webhook delivery",
      context: {
        path: pathname,
      },
    });
  }
}
