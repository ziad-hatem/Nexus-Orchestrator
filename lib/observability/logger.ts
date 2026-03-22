import { randomUUID } from "node:crypto";
import pino, { type Logger } from "pino";
import { getOptionalEnv } from "@/lib/env";
import { captureServerLog } from "@/lib/observability/error-tracking";

export type LogLevel = "info" | "warn" | "error";

export type LogContext = {
  requestId?: string | null;
  route?: string | null;
  method?: string | null;
  path?: string | null;
  userId?: string | null;
  email?: string | null;
  organizationId?: string | null;
  organizationSlug?: string | null;
  membershipId?: string | null;
  role?: string | null;
  [key: string]: unknown;
};

const ACCEPTED_LOG_LEVELS = new Set([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

function getLogLevel(): pino.LevelWithSilent {
  const configuredLevel = getOptionalEnv("LOG_LEVEL");
  if (configuredLevel && ACCEPTED_LOG_LEVELS.has(configuredLevel)) {
    return configuredLevel as pino.LevelWithSilent;
  }

  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function compactContext(context: LogContext = {}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => typeof value !== "undefined"),
  );
}

export function serializeError(error: unknown): Record<string, unknown> | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

export const appLogger = pino({
  level: getLogLevel(),
  base: {
    service: "nexus_orchestrator",
    environment: getOptionalEnv("SENTRY_ENVIRONMENT") ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV ??
      "development",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createChildLogger(context: LogContext = {}): Logger {
  return appLogger.child(compactContext(context));
}

export function getRequestLogContext(
  request: Request,
  context: LogContext = {},
): Record<string, unknown> {
  const url = new URL(request.url);

  return compactContext({
    requestId:
      request.headers.get("x-request-id") ??
      request.headers.get("x-vercel-id") ??
      randomUUID(),
    method: request.method,
    path: `${url.pathname}${url.search}`,
    ...context,
  });
}

export function createRequestLogger(
  request: Request,
  context: LogContext = {},
): Logger {
  return appLogger.child(getRequestLogContext(request, context));
}

export function writeLog(
  logger: Logger,
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {},
): void {
  const payload = Object.fromEntries(
    Object.entries(context).filter(([, value]) => typeof value !== "undefined"),
  );

  if (level === "info") {
    logger.info(payload, message);
    return;
  }

  if (level === "warn") {
    logger.warn(payload, message);
    captureServerLog("warn", message, payload);
    return;
  }

  logger.error(payload, message);
  captureServerLog("error", message, payload);
}
