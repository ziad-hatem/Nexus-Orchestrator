import type { WorkflowSourceContext } from "@/lib/server/workflows/types";

export type TemplateValidationIssue = {
  index: number;
  message: string;
  token?: string;
};

export type TemplateRenderContext = {
  payload: Record<string, unknown>;
  context: WorkflowSourceContext;
};

export class TemplateRenderError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const TEMPLATE_TOKEN_INNER_PATTERN = /^(payload|context)\.[A-Za-z0-9_.-]+$/;
const EXACT_TOKEN_PATTERN = /^{{\s*((?:payload|context)\.[A-Za-z0-9_.-]+)\s*}}$/;
const TEMPLATE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
const FORBIDDEN_PATH_SEGMENTS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isValidTemplateTokenPath(path: string): boolean {
  if (!path.trim()) {
    return false;
  }

  return path.split(".").every((segment) => {
    return (
      Boolean(segment) &&
      TEMPLATE_PATH_SEGMENT_PATTERN.test(segment) &&
      !FORBIDDEN_PATH_SEGMENTS.has(segment)
    );
  });
}

function resolvePath(root: Record<string, unknown>, path: string): unknown {
  if (!isValidTemplateTokenPath(path)) {
    return undefined;
  }

  let current: unknown = root;
  for (const segment of path.split(".")) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0) {
        return undefined;
      }

      current = current[index];
      continue;
    }

    if (!isPlainObject(current)) {
      return undefined;
    }

    current = Object.prototype.hasOwnProperty.call(current, segment)
      ? current[segment]
      : undefined;
  }

  return current;
}

function resolveTokenValue(
  token: string,
  renderContext: TemplateRenderContext,
): unknown {
  const [scope, ...pathSegments] = token.split(".");
  const path = pathSegments.join(".");
  const root =
    scope === "payload"
      ? renderContext.payload
      : (renderContext.context as unknown as Record<string, unknown>);

  return resolvePath(root, path);
}

function stringifyResolvedValue(value: unknown): string {
  if (typeof value === "undefined" || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    Array.isArray(value) ||
    isPlainObject(value)
  ) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export function hasTemplateTokens(value: string): boolean {
  return value.includes("{{");
}

export function validateTemplateString(value: string): TemplateValidationIssue[] {
  const issues: TemplateValidationIssue[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const start = value.indexOf("{{", cursor);
    if (start === -1) {
      break;
    }

    const end = value.indexOf("}}", start + 2);
    if (end === -1) {
      issues.push({
        index: start,
        message: "Template token is missing a closing delimiter.",
      });
      break;
    }

    const rawToken = value.slice(start, end + 2);
    const innerToken = value.slice(start + 2, end).trim();
    const [scope, ...pathSegments] = innerToken.split(".");
    const path = pathSegments.join(".");
    if (
      !TEMPLATE_TOKEN_INNER_PATTERN.test(innerToken) ||
      (scope !== "payload" && scope !== "context") ||
      !isValidTemplateTokenPath(path)
    ) {
      issues.push({
        index: start,
        token: rawToken,
        message:
          "Templates only support {{ payload.* }} and {{ context.* }} tokens.",
      });
    }

    cursor = end + 2;
  }

  if (!issues.length && value.includes("}}") && !value.includes("{{")) {
    issues.push({
      index: value.indexOf("}}"),
      message: "Template token is missing an opening delimiter.",
    });
  }

  return issues;
}

export function renderTemplateString(params: {
  template: string;
  context: TemplateRenderContext;
}): unknown {
  const syntaxIssues = validateTemplateString(params.template);
  if (syntaxIssues.length > 0) {
    throw new TemplateRenderError(syntaxIssues[0]?.message ?? "Invalid template.");
  }

  const exactMatch = params.template.match(EXACT_TOKEN_PATTERN);
  if (exactMatch?.[1]) {
    return resolveTokenValue(exactMatch[1], params.context);
  }

  return params.template.replace(
    /{{\s*((?:payload|context)\.[A-Za-z0-9_.-]+)\s*}}/g,
    (_match, token) => stringifyResolvedValue(resolveTokenValue(token, params.context)),
  );
}

export function renderTemplatedValue<T = unknown>(
  value: T,
  context: TemplateRenderContext,
): T {
  if (typeof value === "string") {
    return renderTemplateString({
      template: value,
      context,
    }) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => renderTemplatedValue(entry, context)) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        renderTemplatedValue(entry, context),
      ]),
    ) as T;
  }

  return value;
}
