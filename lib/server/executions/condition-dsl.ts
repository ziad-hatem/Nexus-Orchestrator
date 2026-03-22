import type {
  ConditionEvaluationResult,
  ParsedConditionExpression,
} from "@/lib/server/executions/types";
import type { WorkflowSourceContext } from "@/lib/server/workflows/types";

const SUBJECT_PATTERN = /^(payload|context)\.[A-Za-z0-9_.-]+$/;
const VALUE_OPERATORS = ["==", "!=", ">=", "<=", ">", "<", "contains"] as const;

type SupportedOperator = ParsedConditionExpression["operator"];

export class ConditionDslParseError extends Error {}

function splitExpression(
  expression: string,
): {
  subject: string;
  operator: SupportedOperator;
  rawValue?: string;
} {
  const trimmed = expression.trim();
  const existsMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\s+(exists)$/);
  if (existsMatch) {
    return {
      subject: existsMatch[1] ?? "",
      operator: "exists",
    };
  }

  for (const operator of VALUE_OPERATORS) {
    const matcher = new RegExp(`^([A-Za-z0-9_.-]+)\\s+${operator.replace(/[<>=!]/g, "\\$&")}\\s+(.+)$`);
    const match = trimmed.match(matcher);
    if (match) {
      return {
        subject: match[1] ?? "",
        operator,
        rawValue: match[2]?.trim(),
      };
    }
  }

  throw new ConditionDslParseError(
    'Conditions must use the form "payload.value == 1" or "context.eventKey exists".',
  );
}

function parseLiteral(rawValue: string | undefined): string | number | boolean | null {
  if (typeof rawValue !== "string") {
    return null;
  }

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

function getPathValue(
  root: Record<string, unknown>,
  path: string,
): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, root);
}

function compareValues(
  left: unknown,
  operator: SupportedOperator,
  right: string | number | boolean | null | undefined,
): boolean {
  switch (operator) {
    case "exists":
      return left !== undefined && left !== null;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case "contains":
      if (typeof left === "string") {
        return left.includes(String(right ?? ""));
      }

      if (Array.isArray(left)) {
        return left.some((item) => item === right);
      }

      return false;
    case ">":
    case ">=":
    case "<":
    case "<=": {
      if (
        (typeof left !== "number" && typeof left !== "string") ||
        (typeof right !== "number" && typeof right !== "string")
      ) {
        return false;
      }

      if (operator === ">") {
        return left > right;
      }
      if (operator === ">=") {
        return left >= right;
      }
      if (operator === "<") {
        return left < right;
      }

      return left <= right;
    }
    default:
      return false;
  }
}

export function parseConditionExpression(
  expression: string,
): ParsedConditionExpression {
  const { subject, operator, rawValue } = splitExpression(expression);
  if (!SUBJECT_PATTERN.test(subject)) {
    throw new ConditionDslParseError(
      "Conditions must reference payload.* or context.* values.",
    );
  }

  if (operator !== "exists" && (!rawValue || !rawValue.trim())) {
    throw new ConditionDslParseError(
      "Conditions using comparisons must include a comparison value.",
    );
  }

  return {
    raw: expression.trim(),
    subject,
    operator,
    value: operator === "exists" ? undefined : parseLiteral(rawValue),
  };
}

export function tryParseConditionExpression(
  expression: string,
): { success: true; parsed: ParsedConditionExpression } | { success: false; error: string } {
  try {
    return {
      success: true,
      parsed: parseConditionExpression(expression),
    };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Condition expression is invalid.",
    };
  }
}

export function evaluateConditionExpression(params: {
  expression: string;
  payload: Record<string, unknown>;
  context: WorkflowSourceContext;
}): ConditionEvaluationResult {
  const parsed = parseConditionExpression(params.expression);
  const [scope, ...segments] = parsed.subject.split(".");
  const base =
    scope === "payload"
      ? params.payload
      : (params.context as unknown as Record<string, unknown>);
  const resolvedValue = getPathValue(base, segments.join("."));

  return {
    parsed,
    passed: compareValues(resolvedValue, parsed.operator, parsed.value),
    resolvedValue,
  };
}
