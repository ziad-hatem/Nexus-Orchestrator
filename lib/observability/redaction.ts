const REDACTION_PLACEHOLDER = "[REDACTED]";

const SENSITIVE_KEY_SEGMENTS = [
  "authorization",
  "api_key",
  "apikey",
  "api-key",
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "password",
  "passwd",
  "cookie",
  "set_cookie",
  "setcookie",
  "x_nexus_api_key",
  "x-nexus-api-key",
  "x_api_key",
  "bearer",
  "client_secret",
  "private_key",
  "session",
] as const;

function normalizeKey(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return SENSITIVE_KEY_SEGMENTS.some(
    (candidate) =>
      normalized === candidate ||
      normalized.startsWith(`${candidate}_`) ||
      normalized.endsWith(`_${candidate}`) ||
      normalized.includes(`_${candidate}_`),
  );
}

const SENSITIVE_PREVIEW_KEY_SEGMENTS = [
  "raw_body",
  "request_body",
  "response_body",
  "raw_request_body",
  "raw_response_body",
  "request_body_preview",
  "response_body_preview",
  "body_preview",
  "response_preview",
] as const;

function isSensitivePreviewKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return SENSITIVE_PREVIEW_KEY_SEGMENTS.some(
    (candidate) =>
      normalized === candidate ||
      normalized.startsWith(`${candidate}_`) ||
      normalized.endsWith(`_${candidate}`) ||
      normalized.includes(`_${candidate}_`),
  );
}

export function redactSensitiveData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item)) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, candidate]) => [
        key,
        isSensitiveKey(key) || isSensitivePreviewKey(key)
          ? REDACTION_PLACEHOLDER
          : redactSensitiveData(candidate),
      ]),
    ) as T;
  }

  return value;
}

export function redactStringDictionary(
  value: Record<string, string | null | undefined>,
): Record<string, string | null | undefined> {
  return Object.fromEntries(
    Object.entries(value).map(([key, candidate]) => [
      key,
      isSensitiveKey(key) ? REDACTION_PLACEHOLDER : candidate,
    ]),
  );
}

export function redactRecord(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return redactSensitiveData(value);
}

export function redactUnknownArray(
  value: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return value.map((item) => redactSensitiveData(item));
}

export function getRedactionPlaceholder(): string {
  return REDACTION_PLACEHOLDER;
}

export function redactSentryEventLike<T>(value: T): T {
  if (!isPlainObject(value)) {
    return value;
  }

  return redactSensitiveData({
    ...value,
    request: value.request && typeof value.request === "object"
      ? redactSensitiveData(value.request)
      : value.request,
    extra: value.extra && typeof value.extra === "object"
      ? redactSensitiveData(value.extra)
      : value.extra,
    contexts: value.contexts && typeof value.contexts === "object"
      ? redactSensitiveData(value.contexts)
      : value.contexts,
    breadcrumbs: Array.isArray(value.breadcrumbs)
      ? redactSensitiveData(value.breadcrumbs)
      : value.breadcrumbs,
    user: value.user && typeof value.user === "object"
      ? {
          ...(value.user as Record<string, unknown>),
          email: undefined,
          ip_address: undefined,
        }
      : value.user,
  }) as T;
}
