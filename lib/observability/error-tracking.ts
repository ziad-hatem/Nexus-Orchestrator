import * as Sentry from "@sentry/nextjs";
import {
  redactRecord,
  redactSensitiveData,
} from "@/lib/observability/redaction";

export const errorTrackingDeps = {
  sentry: Sentry,
  redactRecord,
  redactSensitiveData,
};

export type MonitoringContext = {
  requestId?: string | null;
  route?: string | null;
  method?: string | null;
  path?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  organizationSlug?: string | null;
  membershipId?: string | null;
  role?: string | null;
  workflowId?: string | null;
  runId?: string | null;
  correlationId?: string | null;
  alertKey?: string | null;
  securityEvent?: string | null;
  [key: string]: unknown;
};

type LogLevel = "info" | "warn" | "error";

function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}

function redactNamedValue(key: string, value: unknown): unknown {
  return errorTrackingDeps.redactSensitiveData({ [key]: value })[key];
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

  if (context.userId) {
    scope.setUser({
      id: context.userId ?? undefined,
    });
  }

  const tagEntries = [
    ["request_id", context.requestId],
    ["route", context.route],
    ["method", context.method],
    ["organization_slug", context.organizationSlug],
    ["role", context.role],
    ["workflow_id", context.workflowId],
    ["run_id", context.runId],
    ["correlation_id", context.correlationId],
    ["alert_key", context.alertKey],
    ["security_event", context.securityEvent],
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
    scope.setContext("request", errorTrackingDeps.redactRecord(requestContext));
  }

  const organizationContext = {
    id: context.organizationId ?? undefined,
    slug: context.organizationSlug ?? undefined,
    membershipId: context.membershipId ?? undefined,
    role: context.role ?? undefined,
  };

  if (Object.values(organizationContext).some(Boolean)) {
    scope.setContext("organization", errorTrackingDeps.redactRecord(organizationContext));
  }

  const executionContext = {
    workflowId: context.workflowId ?? undefined,
    runId: context.runId ?? undefined,
    correlationId: context.correlationId ?? undefined,
    alertKey: context.alertKey ?? undefined,
    securityEvent: context.securityEvent ?? undefined,
  };

  if (Object.values(executionContext).some(Boolean)) {
    scope.setContext("execution", errorTrackingDeps.redactRecord(executionContext));
  }

  const reservedKeys = new Set([
    "requestId",
    "route",
    "method",
    "path",
    "userId",
    "organizationId",
    "organizationSlug",
    "membershipId",
    "role",
    "workflowId",
    "runId",
    "correlationId",
    "alertKey",
    "securityEvent",
  ]);

  for (const [key, value] of Object.entries(context)) {
    if (!reservedKeys.has(key) && typeof value !== "undefined") {
      scope.setExtra(key, redactNamedValue(key, value));
    }
  }
}

export function applyMonitoringContext(context?: MonitoringContext): void {
  if (!context) {
    return;
  }

  if (context.userId) {
    errorTrackingDeps.sentry.setUser({
      id: context.userId ?? undefined,
    });
  }

  const tagEntries = [
    ["request_id", context.requestId],
    ["route", context.route],
    ["method", context.method],
    ["organization_slug", context.organizationSlug],
    ["role", context.role],
    ["workflow_id", context.workflowId],
    ["run_id", context.runId],
    ["correlation_id", context.correlationId],
    ["alert_key", context.alertKey],
    ["security_event", context.securityEvent],
  ] satisfies Array<[string, unknown]>;

  for (const [key, value] of tagEntries) {
    if (typeof value === "string" && value.length > 0) {
      errorTrackingDeps.sentry.setTag(key, value);
    }
  }

  const organizationContext = {
    id: context.organizationId ?? undefined,
    slug: context.organizationSlug ?? undefined,
    membershipId: context.membershipId ?? undefined,
    role: context.role ?? undefined,
  };

  if (Object.values(organizationContext).some(Boolean)) {
    errorTrackingDeps.sentry.setContext(
      "organization",
      errorTrackingDeps.redactRecord(organizationContext),
    );
  }

  const executionContext = {
    workflowId: context.workflowId ?? undefined,
    runId: context.runId ?? undefined,
    correlationId: context.correlationId ?? undefined,
    alertKey: context.alertKey ?? undefined,
    securityEvent: context.securityEvent ?? undefined,
  };

  if (Object.values(executionContext).some(Boolean)) {
    errorTrackingDeps.sentry.setContext(
      "execution",
      errorTrackingDeps.redactRecord(executionContext),
    );
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

  return errorTrackingDeps.sentry.withScope((scope) => {
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
          scope.setExtra(key, redactNamedValue(key, value));
        }
      }
    }

    return errorTrackingDeps.sentry.captureException(err);
  });
}

export function captureServerLog(
  level: LogLevel,
  message: string,
  attributes?: Record<string, unknown>,
): void {
  const payload = attributes ? errorTrackingDeps.redactRecord(attributes) : undefined;

  if (level === "info") {
    errorTrackingDeps.sentry.logger.info(message, payload);
    return;
  }

  if (level === "warn") {
    errorTrackingDeps.sentry.logger.warn(message, payload);
    return;
  }

  errorTrackingDeps.sentry.logger.error(message, payload);
}

export function captureServerMessage(
  message: string,
  options?: {
    context?: MonitoringContext;
    level?: "info" | "warning" | "error";
    extras?: Record<string, unknown>;
    fingerprint?: string[];
  },
): string {
  return errorTrackingDeps.sentry.withScope((scope) => {
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
          scope.setExtra(key, redactNamedValue(key, value));
        }
      }
    }

    return errorTrackingDeps.sentry.captureMessage(
      message,
      options?.level ?? "warning",
    );
  });
}
