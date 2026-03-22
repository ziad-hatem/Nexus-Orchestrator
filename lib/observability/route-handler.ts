import "server-only";

import { NextResponse } from "next/server";
import type { Logger } from "pino";
import {
  applyMonitoringContext,
  captureServerException,
  type MonitoringContext,
} from "@/lib/observability/error-tracking";
import {
  createRequestLogger,
  serializeError,
  type LogContext,
  writeLog,
} from "@/lib/observability/logger";

type HandleRouteErrorOptions = {
  request: Request;
  logger?: Logger;
  fallbackMessage: string;
  status?: number;
  publicMessage?: string;
  capture?: boolean;
  context?: MonitoringContext & LogContext;
  fingerprint?: string[];
};

export function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error && error.message
    ? error.message
    : fallbackMessage;
}

export function handleRouteError(
  error: unknown,
  options: HandleRouteErrorOptions,
) {
  const status = options.status ?? 500;
  const message = options.publicMessage ?? getErrorMessage(error, options.fallbackMessage);
  const logger = options.logger ?? createRequestLogger(options.request, options.context);

  writeLog(
    logger,
    status >= 500 ? "error" : "warn",
    message,
    {
      status,
      err: serializeError(error),
      ...options.context,
    },
  );

  const shouldCapture = options.capture ?? status >= 500;
  if (shouldCapture) {
    applyMonitoringContext(options.context);
    captureServerException(error, {
      context: {
        method: options.request.method,
        path: new URL(options.request.url).pathname,
        ...options.context,
      },
      level: status >= 500 ? "error" : "warning",
      fingerprint: options.fingerprint,
      extras: {
        responseStatus: status,
      },
      fallbackMessage: options.fallbackMessage,
    });
  }

  return NextResponse.json({ error: message }, { status });
}
