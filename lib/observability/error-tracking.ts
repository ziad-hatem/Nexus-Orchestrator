import "server-only";

import * as Sentry from "@sentry/nextjs";

export type MonitoringContext = {
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

type LogLevel = "info" | "warn" | "error";

function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}

function applyScopeContext(
  scope: {
    setUser: (user: { id?: string; email?: string } | null) => void;
    setTag: (key: string, value: string) => void;
    setContext: (name: string, context: Record<string, unknown>) => void;
    setExtra: (key: string, extra: unknown) => void;
    setLevel: (level: "info" | "warning" | "error") => void;
    setFingerprint: (fingerprint: string[]) => void;
  },
  context?: MonitoringContext,
) {
  if (!context) {
    return;
  }

  if (context.userId || context.email) {
    scope.setUser({
      id: context.userId ?? undefined,
      email: context.email ?? undefined,
    });
  }

  const tagEntries = [
    ["request_id", context.requestId],
    ["route", context.route],
    ["method", context.method],
    ["organization_slug", context.organizationSlug],
    ["role", context.role],
  ] satisfies Array<[string, unknown]>;

  for (const [key, value] of tagEntries) {
    if (typeof value === "string" && value.length > 0) {
      scope.setTag(key, value);
    }
  }

  const requestContext = {
    path: context.path ?? undefined,
    method: context.method ?? undefined,
    route: context.route ?? undefined,
    requestId: context.requestId ?? undefined,
  };

  if (Object.values(requestContext).some(Boolean)) {
    scope.setContext("request", requestContext);
  }

  const organizationContext = {
    id: context.organizationId ?? undefined,
    slug: context.organizationSlug ?? undefined,
    membershipId: context.membershipId ?? undefined,
    role: context.role ?? undefined,
  };

  if (Object.values(organizationContext).some(Boolean)) {
    scope.setContext("organization", organizationContext);
  }

  const reservedKeys = new Set([
    "requestId",
    "route",
    "method",
    "path",
    "userId",
    "email",
    "organizationId",
    "organizationSlug",
    "membershipId",
    "role",
  ]);

  for (const [key, value] of Object.entries(context)) {
    if (!reservedKeys.has(key) && typeof value !== "undefined") {
      scope.setExtra(key, value);
    }
  }
}

export function applyMonitoringContext(context?: MonitoringContext): void {
  if (!context) {
    return;
  }

  if (context.userId || context.email) {
    Sentry.setUser({
      id: context.userId ?? undefined,
      email: context.email ?? undefined,
    });
  }

  const tagEntries = [
    ["request_id", context.requestId],
    ["route", context.route],
    ["method", context.method],
    ["organization_slug", context.organizationSlug],
    ["role", context.role],
  ] satisfies Array<[string, unknown]>;

  for (const [key, value] of tagEntries) {
    if (typeof value === "string" && value.length > 0) {
      Sentry.setTag(key, value);
    }
  }

  const organizationContext = {
    id: context.organizationId ?? undefined,
    slug: context.organizationSlug ?? undefined,
    membershipId: context.membershipId ?? undefined,
    role: context.role ?? undefined,
  };

  if (Object.values(organizationContext).some(Boolean)) {
    Sentry.setContext("organization", organizationContext);
  }
}

export function captureServerException(
  error: unknown,
  options?: {
    context?: MonitoringContext;
    level?: "warning" | "error";
    fingerprint?: string[];
    extras?: Record<string, unknown>;
    fallbackMessage?: string;
  },
): string {
  const err = toError(error, options?.fallbackMessage ?? "Unexpected server error");

  return Sentry.withScope((scope) => {
    applyScopeContext(scope, options?.context);

    if (options?.level) {
      scope.setLevel(options.level);
    }

    if (options?.fingerprint?.length) {
      scope.setFingerprint(options.fingerprint);
    }

    if (options?.extras) {
      for (const [key, value] of Object.entries(options.extras)) {
        if (typeof value !== "undefined") {
          scope.setExtra(key, value);
        }
      }
    }

    return Sentry.captureException(err);
  });
}

export function captureServerLog(
  level: LogLevel,
  message: string,
  attributes?: Record<string, unknown>,
): void {
  if (level === "info") {
    Sentry.logger.info(message, attributes);
    return;
  }

  if (level === "warn") {
    Sentry.logger.warn(message, attributes);
    return;
  }

  Sentry.logger.error(message, attributes);
}
