import type {
  WorkflowConditionResolver,
  WorkflowSourceContext,
} from "@/lib/server/workflows/types";

export const CONDITION_RESOLVER_PATH_PATTERN = /^[A-Za-z0-9_.-]+$/;

export type ConditionFieldResolution = {
  found: boolean;
  value: unknown;
  scope: WorkflowConditionResolver["scope"];
  path: string;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function isValidConditionResolverPath(path: string): boolean {
  return CONDITION_RESOLVER_PATH_PATTERN.test(path.trim());
}

export function resolveConditionField(params: {
  resolver: WorkflowConditionResolver;
  payload: Record<string, unknown>;
  context: WorkflowSourceContext;
}): ConditionFieldResolution {
  const path = params.resolver.path.trim();
  if (!path || !isValidConditionResolverPath(path)) {
    return {
      found: false,
      value: undefined,
      scope: params.resolver.scope,
      path,
    };
  }

  const root =
    params.resolver.scope === "payload"
      ? params.payload
      : toRecord(params.context as unknown);

  let current: unknown = root;
  for (const segment of path.split(".").filter(Boolean)) {
    if (current === null || typeof current !== "object") {
      current = undefined;
      break;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return {
    found: typeof current !== "undefined",
    value: current,
    scope: params.resolver.scope,
    path,
  };
}
