import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getRequiredEnv } from "@/lib/env";
import { internalEventIngestionSchema } from "@/lib/server/validation";
import {
  ingestInternalEvent,
  WorkflowTriggerDuplicateError,
  WorkflowTriggerRateLimitError,
} from "@/lib/server/triggers/service";

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
}

export async function POST(req: Request) {
  const logger = createRequestLogger(req, {
    route: "api.internal.events.post",
  });

  const token = getBearerToken(req);
  let expectedSecret: string;
  try {
    expectedSecret = getRequiredEnv("INTERNAL_EVENTS_SECRET");
  } catch (error: unknown) {
    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Internal events secret is not configured",
    });
  }

  if (!token || token !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = internalEventIngestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid internal event payload",
      },
      { status: 400 },
    );
  }

  try {
    const result = await ingestInternalEvent(parsed.data);
    return NextResponse.json(result, { status: 202 });
  } catch (error: unknown) {
    if (error instanceof WorkflowTriggerRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof WorkflowTriggerDuplicateError) {
      return NextResponse.json({ error: error.message }, { status: 202 });
    }

    return handleRouteError(error, {
      request: req,
      logger,
      fallbackMessage: "Failed to ingest internal event",
    });
  }
}
