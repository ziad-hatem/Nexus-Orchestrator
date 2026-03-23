import assert from "node:assert/strict";
import test from "node:test";
import {
  matchInternalEventBindings,
  matchManualTriggerBinding,
  matchWebhookTriggerBinding,
  triggerMatcherDeps,
} from "@/lib/server/triggers/matcher";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalTriggerMatcherDeps = { ...triggerMatcherDeps };

test.afterEach(() => {
  restoreMutableExports(triggerMatcherDeps, originalTriggerMatcherDeps);
});

test("matchManualTriggerBinding delegates to the active manual-binding lookup", async () => {
  let receivedWorkflowDbId = "";
  triggerMatcherDeps.getActiveManualBindingByWorkflowDbId = async (
    workflowDbId,
  ) => {
    receivedWorkflowDbId = workflowDbId;
    return { id: "binding_manual" } as never;
  };

  const binding = await matchManualTriggerBinding("workflow_db_1");

  assert.equal(receivedWorkflowDbId, "workflow_db_1");
  assert.equal(binding?.id, "binding_manual");
});

test("matchWebhookTriggerBinding normalizes webhook paths before lookup", async () => {
  let receivedMatchKey = "";
  triggerMatcherDeps.getActiveWebhookBindingByMatchKey = async (matchKey) => {
    receivedMatchKey = matchKey;
    return { id: "binding_webhook" } as never;
  };

  const binding = await matchWebhookTriggerBinding("hooks//acme/orders");

  assert.equal(receivedMatchKey, "/hooks/acme/orders");
  assert.equal(binding?.id, "binding_webhook");
});

test("matchInternalEventBindings delegates to the internal-event binding list", async () => {
  let receivedEventKey = "";
  triggerMatcherDeps.listActiveInternalEventBindings = async (eventKey) => {
    receivedEventKey = eventKey;
    return [{ id: "binding_event" }] as never;
  };

  const bindings = await matchInternalEventBindings("ticket.created");

  assert.equal(receivedEventKey, "ticket.created");
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0]?.id, "binding_event");
});
