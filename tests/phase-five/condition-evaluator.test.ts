import assert from "node:assert/strict";
import test from "node:test";
import {
  ConditionEvaluationError,
  evaluateWorkflowCondition,
} from "@/lib/server/conditions/evaluator";
import type { WorkflowConditionConfig } from "@/lib/server/workflows/types";
import { createWorkflowConditionDefinition } from "@/lib/server/workflows/types";

function createCondition(
  overrides: Partial<WorkflowConditionConfig> = {},
): WorkflowConditionConfig {
  const base = createWorkflowConditionDefinition();
  return {
    ...base,
    ...overrides,
    resolver: {
      ...base.resolver,
      ...(overrides.resolver ?? {}),
    },
  };
}

const context = {
  sourceLabel: "internal_event",
  eventKey: "organization.created" as const,
  actorUserId: "user_1",
};

test("evaluateWorkflowCondition handles equals and not_equals across primitive values", () => {
  const payload = {
    ticket: {
      priority: "high",
      attempts: 3,
      escalated: true,
      resolution: null,
    },
  };

  const equalsResult = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "ticket.priority" },
      operator: "equals",
      value: "high",
    }),
    payload,
    context,
  });
  const notEqualsResult = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "ticket.attempts" },
      operator: "not_equals",
      value: 1,
    }),
    payload,
    context,
  });
  const booleanResult = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "ticket.escalated" },
      operator: "equals",
      value: true,
    }),
    payload,
    context,
  });
  const nullResult = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "ticket.resolution" },
      operator: "equals",
      value: null,
    }),
    payload,
    context,
  });
  const missingResult = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "ticket.owner" },
      operator: "not_equals",
      value: "agent-1",
    }),
    payload,
    context,
  });

  assert.equal(equalsResult.matched, true);
  assert.equal(notEqualsResult.matched, true);
  assert.equal(booleanResult.matched, true);
  assert.equal(nullResult.matched, true);
  assert.equal(missingResult.matched, false);
  assert.equal(missingResult.terminationReason, "condition_not_met");
});

test("evaluateWorkflowCondition handles contains for strings and arrays without coercing objects or case", () => {
  const payload = {
    ticket: {
      title: "VIP customer refund",
      tags: ["vip", "refund", "priority"],
      meta: { owner: "support" },
    },
  };

  const stringContains = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "ticket.title" },
      operator: "contains",
      value: "refund",
    }),
    payload,
    context,
  });
  const arrayContains = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "ticket.tags" },
      operator: "contains",
      value: "vip",
    }),
    payload,
    context,
  });
  const caseSensitiveMiss = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "ticket.title" },
      operator: "contains",
      value: "vip",
    }),
    payload,
    context,
  });
  const objectMiss = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "ticket.meta" },
      operator: "contains",
      value: "support",
    }),
    payload,
    context,
  });

  assert.equal(stringContains.matched, true);
  assert.equal(arrayContains.matched, true);
  assert.equal(caseSensitiveMiss.matched, false);
  assert.equal(objectMiss.matched, false);
});

test("evaluateWorkflowCondition only performs numeric comparisons on numeric values", () => {
  const payload = {
    metrics: {
      score: 8.75,
      delta: -2,
      scoreText: "9",
    },
  };

  const greaterThan = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "metrics.score" },
      operator: "greater_than",
      value: 8,
    }),
    payload,
    context,
  });
  const lessThan = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "metrics.delta" },
      operator: "less_than",
      value: -1,
    }),
    payload,
    context,
  });
  const equalBoundaryMiss = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "metrics.score" },
      operator: "less_than",
      value: 8.75,
    }),
    payload,
    context,
  });
  const numericStringMiss = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "metrics.scoreText" },
      operator: "greater_than",
      value: 8,
    }),
    payload,
    context,
  });

  assert.equal(greaterThan.matched, true);
  assert.equal(lessThan.matched, true);
  assert.equal(equalBoundaryMiss.matched, false);
  assert.equal(numericStringMiss.matched, false);

  assert.throws(
    () =>
      evaluateWorkflowCondition({
        condition: createCondition({
          resolver: { scope: "payload", path: "metrics.score" },
          operator: "greater_than",
          value: "8" as never,
        }),
        payload,
        context,
      }),
    (error: unknown) =>
      error instanceof ConditionEvaluationError &&
      error.message ===
        "greater_than conditions require a numeric comparison value.",
  );
});

test("evaluateWorkflowCondition treats exists as defined-and-not-null presence", () => {
  const payload = {
    ticket: {
      ownerId: "agent_7",
      note: "",
      resolution: null,
    },
  };

  const ownerExists = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "ticket.ownerId" },
      operator: "exists",
      value: "",
    }),
    payload,
    context,
  });
  const emptyStringExists = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "ticket.note" },
      operator: "exists",
      value: "",
    }),
    payload,
    context,
  });
  const nullMiss = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "ticket.resolution" },
      operator: "exists",
      value: "",
    }),
    payload,
    context,
  });
  const missingMiss = evaluateWorkflowCondition({
    condition: createCondition({
      resolver: { scope: "payload", path: "ticket.assignee" },
      operator: "exists",
      value: "",
    }),
    payload,
    context,
  });

  assert.equal(ownerExists.matched, true);
  assert.equal(emptyStringExists.matched, true);
  assert.equal(nullMiss.matched, false);
  assert.equal(missingMiss.matched, false);
});
