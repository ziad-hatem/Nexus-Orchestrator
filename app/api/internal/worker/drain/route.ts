import { NextResponse } from "next/server";
import {
  createRequestLogger,
  writeLog,
} from "@/lib/observability/logger";
import { handleRouteError } from "@/lib/observability/route-handler";
import { getFirstAvailableEnv, getOptionalEnv } from "@/lib/env";
import { runExecutionWorkerCycle } from "@/lib/server/executions/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_MAX_JOBS = 10;
const MAX_ALLOWED_JOBS = 25;

export const executionWorkerDrainRouteDeps = {
  createRequestLogger,
  handleRouteError,
  getFirstAvailableEnv,
  getOptionalEnv,
  runExecutionWorkerCycle,
  writeLog,
};

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function getMaxJobs(request: Request): number {
  const url = new URL(request.url);
  const queryLimit = url.searchParams.get("limit");
  const configuredLimit = executionWorkerDrainRouteDeps.getOptionalEnv(
    "EXECUTION_CRON_MAX_JOBS",
  );

  return Math.min(
    MAX_ALLOWED_JOBS,
    parsePositiveInteger(queryLimit, parsePositiveInteger(configuredLimit, DEFAULT_MAX_JOBS)),
  );
}

async function handleDrain(request: Request) {
  const logger = executionWorkerDrainRouteDeps.createRequestLogger(request, {
    route: "api.internal.worker.drain",
  });

  let expectedSecret: string;
  try {
    expectedSecret = executionWorkerDrainRouteDeps.getFirstAvailableEnv([
      "CRON_SECRET",
      "WORKER_DRAIN_SECRET",
    ]);
  } catch (error: unknown) {
    return executionWorkerDrainRouteDeps.handleRouteError(error, {
      request,
      logger,
      fallbackMessage: "Worker drain secret is not configured",
    });
  }

  const token =
    getBearerToken(request) ?? request.headers.get("x-worker-secret")?.trim() ?? null;

  if (!token || token !== expectedSecret) {
    executionWorkerDrainRouteDeps.writeLog(logger, "warn", "Rejected worker drain request", {
      securityEvent: "worker_drain_unauthorized",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const maxJobs = getMaxJobs(request);
    const cycle = await executionWorkerDrainRouteDeps.runExecutionWorkerCycle({
      maxJobs,
      rethrowOnError: false,
    });

    return NextResponse.json({
      ok: true,
      maxJobs,
      movedDelayedJobs: cycle.movedDelayedJobs,
      processedJobs: cycle.processedJobs,
      backlogBefore: cycle.backlogBefore,
      backlogAfter: cycle.backlogAfter,
    });
  } catch (error: unknown) {
    return executionWorkerDrainRouteDeps.handleRouteError(error, {
      request,
      logger,
      fallbackMessage: "Failed to drain execution queue",
    });
  }
}

export async function GET(request: Request) {
  return handleDrain(request);
}

export async function POST(request: Request) {
  return handleDrain(request);
}
