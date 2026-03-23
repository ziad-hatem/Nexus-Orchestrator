import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInternalEventIdempotencyKey,
  buildInternalEventRateLimitKey,
  buildManualIdempotencyKey,
  buildManualRateLimitKey,
  buildWebhookIdempotencyKey,
  buildWebhookRateLimitKey,
} from "@/lib/server/triggers/rate-limit";

test("manual and internal trigger keys stay scoped to their tenant inputs", () => {
  assert.equal(
    buildManualRateLimitKey({
      organizationId: "org_1",
      workflowId: "WFL-1234",
      userId: "user_1",
    }),
    "wf:manual:rl:org_1:WFL-1234:user_1",
  );
  assert.equal(
    buildManualIdempotencyKey({
      organizationId: "org_1",
      workflowId: "WFL-1234",
      userId: "user_1",
      idempotencyKey: "idem_1",
    }),
    "wf:manual:dedupe:org_1:WFL-1234:user_1:idem_1",
  );
  assert.equal(
    buildManualIdempotencyKey({
      organizationId: "org_1",
      workflowId: "WFL-1234",
      userId: "user_1",
    }),
    null,
  );
  assert.equal(
    buildInternalEventRateLimitKey("ticket.created"),
    "wf:internal:rl:ticket.created",
  );
  assert.equal(
    buildInternalEventIdempotencyKey({
      eventId: "evt_1",
      eventKey: "payment.failed",
    }),
    "wf:internal:dedupe:payment.failed:evt_1",
  );
});

test("webhook rate-limit keys fall back to unknown ip addresses", () => {
  assert.equal(
    buildWebhookRateLimitKey({
      bindingId: "binding_1",
      ipAddress: "",
    }),
    "wf:webhook:rl:binding_1:unknown",
  );
});

test("webhook idempotency keys prefer delivery ids and otherwise hash the raw body", () => {
  assert.equal(
    buildWebhookIdempotencyKey({
      bindingId: "binding_1",
      deliveryId: "  delivery-123  ",
      rawBody: '{"ok":true}',
      timestamp: "2026-03-23T00:00:00.000Z",
    }),
    "wf:webhook:dedupe:binding_1:delivery-123",
  );

  const fromHashA = buildWebhookIdempotencyKey({
    bindingId: "binding_1",
    rawBody: '{"ok":true}',
  });
  const fromHashB = buildWebhookIdempotencyKey({
    bindingId: "binding_1",
    rawBody: '{"ok":true}',
  });
  const fromDifferentBody = buildWebhookIdempotencyKey({
    bindingId: "binding_1",
    rawBody: '{"ok":false}',
  });

  assert.equal(fromHashA, fromHashB);
  assert.notEqual(fromHashA, fromDifferentBody);
});
