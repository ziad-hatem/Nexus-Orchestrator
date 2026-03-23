import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidConditionResolverPath,
  resolveConditionField,
} from "@/lib/server/conditions/resolver";
import type { WorkflowSourceContext } from "@/lib/server/workflows/types";

const sourceContext: WorkflowSourceContext = {
  sourceLabel: "internal_event",
  eventKey: "ticket.created",
  requestPath: "/hooks/support/ticket-created",
  requestMethod: "POST",
  requestIp: "198.51.100.20",
  actorUserId: "user_1",
};

test("isValidConditionResolverPath accepts segmented identifiers and rejects malformed paths", () => {
  const validPaths = [
    "ticket.priority",
    "ticket_1.status",
    "payment-failed.code",
    "headers.x_signature",
    "items.0.state",
  ];
  const invalidPaths = [
    "",
    ".ticket.priority",
    "ticket.priority.",
    "ticket..priority",
    "ticket/priority",
    "__proto__",
    "constructor",
    "ticket.__proto__",
    "ticket.prototype.name",
  ];

  for (const path of validPaths) {
    assert.equal(isValidConditionResolverPath(path), true, path);
  }

  for (const path of invalidPaths) {
    assert.equal(isValidConditionResolverPath(path), false, path);
  }
});

test("resolveConditionField resolves nested payload and context paths and preserves metadata", () => {
  const payload = {
    ticket: {
      priority: "high",
      score: 8.5,
    },
    items: [{ state: "queued" }],
  };

  const payloadResult = resolveConditionField({
    resolver: { scope: "payload", path: "ticket.priority" },
    payload,
    context: sourceContext,
  });
  const contextResult = resolveConditionField({
    resolver: { scope: "context", path: "eventKey" },
    payload,
    context: sourceContext,
  });
  const arrayResult = resolveConditionField({
    resolver: { scope: "payload", path: "items.0.state" },
    payload,
    context: sourceContext,
  });

  assert.deepEqual(payloadResult, {
    found: true,
    value: "high",
    scope: "payload",
    path: "ticket.priority",
  });
  assert.deepEqual(contextResult, {
    found: true,
    value: "ticket.created",
    scope: "context",
    path: "eventKey",
  });
  assert.deepEqual(arrayResult, {
    found: true,
    value: "queued",
    scope: "payload",
    path: "items.0.state",
  });
});

test("resolveConditionField returns found false for invalid, inherited, missing, and reserved segments", () => {
  const payload = Object.assign(Object.create({ inherited: "nope" }), {
    ticket: {
      priority: null,
    },
  }) as Record<string, unknown>;

  const invalidPath = resolveConditionField({
    resolver: { scope: "payload", path: "ticket..priority" },
    payload,
    context: sourceContext,
  });
  const inheritedValue = resolveConditionField({
    resolver: { scope: "payload", path: "inherited" },
    payload,
    context: sourceContext,
  });
  const reservedSegment = resolveConditionField({
    resolver: { scope: "payload", path: "ticket.__proto__" },
    payload,
    context: sourceContext,
  });
  const missingTraversal = resolveConditionField({
    resolver: { scope: "payload", path: "ticket.priority.value" },
    payload,
    context: sourceContext,
  });

  assert.deepEqual(invalidPath, {
    found: false,
    value: undefined,
    scope: "payload",
    path: "ticket..priority",
  });
  assert.deepEqual(inheritedValue, {
    found: false,
    value: undefined,
    scope: "payload",
    path: "inherited",
  });
  assert.deepEqual(reservedSegment, {
    found: false,
    value: undefined,
    scope: "payload",
    path: "ticket.__proto__",
  });
  assert.deepEqual(missingTraversal, {
    found: false,
    value: undefined,
    scope: "payload",
    path: "ticket.priority.value",
  });
});
