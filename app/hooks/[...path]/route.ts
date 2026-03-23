import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { ingestWebhookDelivery } from "@/lib/server/triggers/service";
import { getWebhookMaxBodyBytes } from "@/lib/server/triggers/security";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function getRequestIp(request: Request): string | null {
  const header = request.headers.get("x-forwarded-for");
  return header?.split(",")[0]?.trim() || null;
}

function parsePayload(
  rawBody: string,
  contentType: string | null,
): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(rawBody);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { value: parsed };
  } catch {
    if (contentType?.toLowerCase().includes("application/json")) {
      return null;
    }

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
    const maxBodyBytes = getWebhookMaxBodyBytes();
    const declaredContentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(declaredContentLength) && declaredContentLength > maxBodyBytes) {
      logger.warn(
        {
          maxBodyBytes,
          declaredContentLength,
        },
        "Rejected webhook request because body size exceeded limit",
      );
      return NextResponse.json(
        { error: "Webhook payload exceeded the maximum allowed size" },
        { status: 413 },
      );
    }

    const rawBody = await req.text();
    const rawBodyBytes = Buffer.byteLength(rawBody, "utf8");
    if (rawBodyBytes > maxBodyBytes) {
      logger.warn(
        {
          maxBodyBytes,
          rawBodyBytes,
        },
        "Rejected webhook request because body size exceeded limit after read",
      );
      return NextResponse.json(
        { error: "Webhook payload exceeded the maximum allowed size" },
        { status: 413 },
      );
    }

    const payload = parsePayload(rawBody, req.headers.get("content-type"));
    if (!payload) {
      logger.warn({}, "Rejected malformed JSON webhook payload");
      return NextResponse.json(
        { error: "Webhook payload must contain valid JSON" },
        { status: 400 },
      );
    }

    const result = await ingestWebhookDelivery({
      pathname,
      rawBody,
      payload,
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
