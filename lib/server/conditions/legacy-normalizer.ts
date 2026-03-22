import type {
  WorkflowConditionConfig,
  WorkflowConditionOperator,
  WorkflowConditionResolverScope,
  WorkflowConditionValue,
} from "@/lib/server/workflows/types";

const LEGACY_CONDITION_SCOPES = ["payload", "context"] as const satisfies ReadonlyArray<WorkflowConditionResolverScope>;
const LEGACY_CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "greater_than",
  "less_than",
  "exists",
] as const satisfies ReadonlyArray<WorkflowConditionOperator>;

type LegacyNormalizationSuccess = {
  success: true;
  resolver: {
    scope: WorkflowConditionResolverScope;
    path: string;
  };
  operator: WorkflowConditionOperator;
  value: WorkflowConditionValue;
};

type LegacyNormalizationFailure = {
  success: false;
  error: string;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toConditionValue(value: unknown): WorkflowConditionValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  return "";
}

function defaultConditionConfig(params: {
  id: string;
  label: string;
  description: string;
  legacyExpression?: string | null;
  legacyIssue?: string | null;
}): WorkflowConditionConfig {
  return {
    id: params.id,
    label: params.label,
    description: params.description,
    resolver: {
      scope: "payload",
      path: "",
    },
    operator: "equals",
    value: "",
    legacyExpression: params.legacyExpression ?? null,
    legacyIssue: params.legacyIssue ?? null,
  };
}

function parseLiteral(rawValue: string): WorkflowConditionValue {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed === "null") {
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && trimmed !== "") {
    return numeric;
  }

  return trimmed;
}

function parseLegacySubject(subject: string): {
  scope: WorkflowConditionResolverScope;
  path: string;
} | null {
  const match = subject.trim().match(/^(payload|context)\.([A-Za-z0-9_.-]+)$/);
  if (!match) {
    return null;
  }

  const scope = match[1];
  const path = match[2];
  if (
    !scope ||
    !path ||
    !LEGACY_CONDITION_SCOPES.includes(scope as WorkflowConditionResolverScope)
  ) {
    return null;
  }

  return {
    scope: scope as WorkflowConditionResolverScope,
    path,
  };
}

export function normalizeLegacyConditionExpression(
  expression: string,
): LegacyNormalizationSuccess | LegacyNormalizationFailure {
  const trimmed = expression.trim();
  if (!trimmed) {
    return {
      success: false,
      error: "Legacy condition expression is empty.",
    };
  }

  const existsMatch = trimmed.match(
    /^((?:payload|context)\.[A-Za-z0-9_.-]+)\s+exists$/,
  );
  if (existsMatch) {
    const resolver = parseLegacySubject(existsMatch[1] ?? "");
    if (!resolver) {
      return {
        success: false,
        error:
          "Legacy condition expressions must reference payload.* or context.* values.",
      };
    }

    return {
      success: true,
      resolver,
      operator: "exists",
      value: null,
    };
  }

  const unsupportedMatch = trimmed.match(
    /^((?:payload|context)\.[A-Za-z0-9_.-]+)\s+(>=|<=)\s+(.+)$/,
  );
  if (unsupportedMatch) {
    return {
      success: false,
      error:
        'Legacy operators ">=" and "<=" are no longer supported. Rewrite this condition using greater_than or less_than.',
    };
  }

  const operatorPatterns = [
    { token: "==", operator: "equals" },
    { token: "!=", operator: "not_equals" },
    { token: "contains", operator: "contains" },
    { token: ">", operator: "greater_than" },
    { token: "<", operator: "less_than" },
  ] as const satisfies ReadonlyArray<{
    token: string;
    operator: WorkflowConditionOperator;
  }>;

  for (const candidate of operatorPatterns) {
    const escapedToken = candidate.token.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
    const match = trimmed.match(
      new RegExp(
        `^((?:payload|context)\\.[A-Za-z0-9_.-]+)\\s+${escapedToken}\\s+(.+)$`,
      ),
    );
    if (!match) {
      continue;
    }

    const resolver = parseLegacySubject(match[1] ?? "");
    if (!resolver) {
      return {
        success: false,
        error:
          "Legacy condition expressions must reference payload.* or context.* values.",
      };
    }

    const rawValue = match[2]?.trim();
    if (!rawValue) {
      return {
        success: false,
        error: "Legacy condition expressions must include a comparison value.",
      };
    }

    return {
      success: true,
      resolver,
      operator: candidate.operator,
      value: parseLiteral(rawValue),
    };
  }

  return {
    success: false,
    error:
      'Legacy condition expressions must use "payload.value == 1", "payload.value contains \\"foo\\"", or "context.eventKey exists".',
  };
}

export function normalizeLegacyConditionRecord(
  rawCondition: Record<string, unknown>,
): WorkflowConditionConfig {
  const id = toStringValue(rawCondition.id);
  const label = toStringValue(rawCondition.label);
  const description = toStringValue(rawCondition.description);

  const resolverRecord = toRecord(rawCondition.resolver);
  const operator = toStringValue(rawCondition.operator);
  const hasStructuredCondition =
    toStringValue(resolverRecord.scope).length > 0 || operator.length > 0;

  if (hasStructuredCondition) {
    const normalizedOperator = LEGACY_CONDITION_OPERATORS.includes(
      operator as WorkflowConditionOperator,
    )
      ? (operator as WorkflowConditionOperator)
      : "equals";

    return {
      id,
      label,
      description,
      resolver: {
        scope:
          toStringValue(resolverRecord.scope) === "context"
            ? "context"
            : "payload",
        path: toStringValue(resolverRecord.path),
      },
      operator: normalizedOperator,
      value: normalizedOperator === "exists" ? null : toConditionValue(rawCondition.value),
      legacyExpression: toStringValue(rawCondition.legacyExpression) || null,
      legacyIssue: toStringValue(rawCondition.legacyIssue) || null,
    };
  }

  const expression = toStringValue(rawCondition.expression);
  if (!expression) {
    return defaultConditionConfig({
      id,
      label,
      description,
    });
  }

  const normalized = normalizeLegacyConditionExpression(expression);
  if (!normalized.success) {
    return defaultConditionConfig({
      id,
      label,
      description,
      legacyExpression: expression,
      legacyIssue: normalized.error,
    });
  }

  return {
    id,
    label,
    description,
    resolver: normalized.resolver,
    operator: normalized.operator,
    value: normalized.operator === "exists" ? null : normalized.value,
    legacyExpression: null,
    legacyIssue: null,
  };
}
