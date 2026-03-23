import assert from "node:assert/strict";
import test from "node:test";
import { validateWorkflowDraftDocument } from "@/lib/server/workflows/validation";
import type {
  WorkflowConditionConfig,
  WorkflowDraftDocument,
} from "@/lib/server/workflows/types";
import {
  buildWorkflowCanvas,
  createEmptyWorkflowDraftDocument,
  createWorkflowActionDefinition,
  createWorkflowConditionDefinition,
} from "@/lib/server/workflows/types";

function createEmailAction() {
  const action = createWorkflowActionDefinition("send_email");
  action.label = "Notify team";
  action.config = {
    to: "nexus@example.com",
    subject: "Ticket update",
    body: "Workflow processed",
    replyTo: "",
  };
  return action;
}

function createCondition(
  overrides: Partial<WorkflowConditionConfig> = {},
): WorkflowConditionConfig {
  const base = createWorkflowConditionDefinition();
  const resolver = {
    scope: "payload" as const,
    path: "ticket.priority",
    ...(overrides.resolver ?? {}),
  };
  return {
    ...base,
    label: "Priority check",
    operator: "equals",
    value: "high",
    ...overrides,
    resolver,
  };
}

function createConditionDraft(
  condition: WorkflowConditionConfig,
): WorkflowDraftDocument {
  const base = createEmptyWorkflowDraftDocument({
    name: "Priority router",
    category: "Support",
    triggerType: "manual",
  });
  const action = createEmailAction();
  const config = {
    ...base.config,
    conditions: [condition],
    actions: [action],
  };

  return {
    ...base,
    config,
    canvas: buildWorkflowCanvas(config),
  };
}

test("validateWorkflowDraftDocument flags invalid condition label, scope, path, operator, and legacy config", () => {
  const issues = validateWorkflowDraftDocument(
    createConditionDraft(
      createCondition({
        label: "",
        resolver: {
          scope: "invalid" as never,
          path: "ticket..priority",
        },
        operator: "bad_operator" as never,
        legacyIssue: "Legacy condition expressions must be rewritten.",
      }),
    ),
  );
  const codes = new Set(issues.map((issue) => issue.code));

  assert.equal(codes.has("missing_condition_label"), true);
  assert.equal(codes.has("invalid_condition_scope"), true);
  assert.equal(codes.has("invalid_condition_resolver_path"), true);
  assert.equal(codes.has("invalid_condition_operator"), true);
  assert.equal(codes.has("legacy_condition_expression"), true);
});

test("validateWorkflowDraftDocument requires numeric values for greater_than and less_than", () => {
  const greaterThanIssues = validateWorkflowDraftDocument(
    createConditionDraft(
      createCondition({
        operator: "greater_than",
        value: "9" as never,
      }),
    ),
  );
  const lessThanIssues = validateWorkflowDraftDocument(
    createConditionDraft(
      createCondition({
        operator: "less_than",
        value: null as never,
      }),
    ),
  );

  assert.equal(
    greaterThanIssues.some(
      (issue) => issue.code === "invalid_condition_numeric_value",
    ),
    true,
  );
  assert.equal(
    lessThanIssues.some(
      (issue) => issue.code === "invalid_condition_numeric_value",
    ),
    true,
  );
});

test("validateWorkflowDraftDocument rejects malformed dotted resolver paths", () => {
  const codes = new Set(
    validateWorkflowDraftDocument(
      createConditionDraft(
        createCondition({
          resolver: {
            scope: "payload",
            path: ".ticket.priority",
          },
        }),
      ),
    ).map((issue) => issue.code),
  );

  assert.equal(codes.has("invalid_condition_resolver_path"), true);
});

test("validateWorkflowDraftDocument accepts valid condition configs without condition-specific errors", () => {
  const issues = validateWorkflowDraftDocument(
    createConditionDraft(
      createCondition({
        resolver: {
          scope: "context",
          path: "eventKey",
        },
        operator: "equals",
        value: "ticket.created",
      }),
    ),
  );
  const conditionIssues = issues.filter((issue) =>
    issue.path.startsWith("config.conditions"),
  );

  assert.deepEqual(conditionIssues, []);
  assert.deepEqual(issues, []);
});
