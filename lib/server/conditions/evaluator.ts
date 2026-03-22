import { resolveConditionField } from "@/lib/server/conditions/resolver";
import type {
  WorkflowConditionConfig,
  WorkflowConditionOperator,
  WorkflowConditionValue,
  WorkflowSourceContext,
} from "@/lib/server/workflows/types";

export class ConditionEvaluationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type WorkflowConditionEvaluationResult = {
  matched: boolean;
  found: boolean;
  resolvedValue: unknown;
  expectedValue: WorkflowConditionValue;
  operator: WorkflowConditionOperator;
  resolverScope: WorkflowConditionConfig["resolver"]["scope"];
  resolverPath: string;
  terminationReason: "condition_not_met" | null;
};

function assertNumericComparison(
  operator: WorkflowConditionOperator,
  value: WorkflowConditionValue,
): void {
  if (
    (operator === "greater_than" || operator === "less_than") &&
    typeof value !== "number"
  ) {
    throw new ConditionEvaluationError(
      `${operator} conditions require a numeric comparison value.`,
    );
  }
}

function evaluateComparison(params: {
  operator: WorkflowConditionOperator;
  resolvedValue: unknown;
  expectedValue: WorkflowConditionValue;
  found: boolean;
}): boolean {
  const { operator, resolvedValue, expectedValue, found } = params;

  if (!found) {
    return false;
  }

  switch (operator) {
    case "exists":
      return resolvedValue !== null;
    case "equals":
      return Object.is(resolvedValue, expectedValue);
    case "not_equals":
      return !Object.is(resolvedValue, expectedValue);
    case "contains":
      if (typeof resolvedValue === "string") {
        return resolvedValue.includes(String(expectedValue ?? ""));
      }

      if (Array.isArray(resolvedValue)) {
        return resolvedValue.some((item) => Object.is(item, expectedValue));
      }

      return false;
    case "greater_than":
      return (
        typeof resolvedValue === "number" &&
        typeof expectedValue === "number" &&
        resolvedValue > expectedValue
      );
    case "less_than":
      return (
        typeof resolvedValue === "number" &&
        typeof expectedValue === "number" &&
        resolvedValue < expectedValue
      );
    default:
      return false;
  }
}

export function evaluateWorkflowCondition(params: {
  condition: WorkflowConditionConfig;
  payload: Record<string, unknown>;
  context: WorkflowSourceContext;
}): WorkflowConditionEvaluationResult {
  const expectedValue =
    params.condition.operator === "exists" ? null : params.condition.value;
  assertNumericComparison(params.condition.operator, expectedValue);

  const resolution = resolveConditionField({
    resolver: params.condition.resolver,
    payload: params.payload,
    context: params.context,
  });
  const matched = evaluateComparison({
    operator: params.condition.operator,
    resolvedValue: resolution.value,
    expectedValue,
    found: resolution.found,
  });

  return {
    matched,
    found: resolution.found,
    resolvedValue: resolution.value,
    expectedValue,
    operator: params.condition.operator,
    resolverScope: resolution.scope,
    resolverPath: resolution.path,
    terminationReason: matched ? null : "condition_not_met",
  };
}
