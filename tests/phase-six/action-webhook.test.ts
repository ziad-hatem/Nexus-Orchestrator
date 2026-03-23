import assert from "node:assert/strict";
import test from "node:test";
import {
  executeSendWebhookAction,
  webhookActionDeps,
} from "@/lib/server/actions/webhook";
import { createWorkflowActionDefinition } from "@/lib/server/workflows/types";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalWebhookActionDeps = { ...webhookActionDeps };

test.afterEach(() => {
  restoreMutableExports(webhookActionDeps, originalWebhookActionDeps);
});

function createWebhookAction() {
  const action = createWorkflowActionDefinition("send_webhook");
  action.label = "Notify downstream";
  action.config = {
    url: "https://hooks.example.test/{{ payload.ticketId }}",
    method: "POST",
    headers: {
      "X-Source": "{{ context.sourceLabel }}",
    },
    body: '{"ticketId":"{{ payload.ticketId }}","priority":"{{ payload.priority }}"}',
  };
  return action;
}

test("executeSendWebhookAction renders request data, injects correlation id, and succeeds", async () => {
  let receivedUrl = "";
  let receivedInit: RequestInit | undefined;

  webhookActionDeps.createTimeoutSignal = () => new AbortController().signal;
  webhookActionDeps.fetch = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    receivedUrl = String(input);
    receivedInit = init;
    return new Response('{"ok":true}', { status: 200 });
  }) as never;

  const result = await executeSendWebhookAction({
    action: createWebhookAction(),
    context: {
      correlationId: "corr_123",
      payload: {
        ticketId: "T-100",
        priority: "high",
      },
      sourceContext: {
        sourceLabel: "manual",
      } as never,
    },
  });

  assert.equal(result.classification, "success");
  assert.equal(receivedUrl, "https://hooks.example.test/T-100");
  assert.equal(
    (receivedInit?.headers as Record<string, string>)["X-Nexus-Correlation-Id"],
    "corr_123",
  );
  assert.equal(
    (receivedInit?.headers as Record<string, string>)["Content-Type"],
    "application/json",
  );
  assert.equal(
    receivedInit?.body,
    '{"ticketId":"T-100","priority":"high"}',
  );

  const output = result.output as {
    actionType: string;
    url: string;
    status: number;
    requestHeaders: Record<string, string>;
  };
  assert.equal(output.actionType, "send_webhook");
  assert.equal(output.url, "https://hooks.example.test/T-100");
  assert.equal(output.status, 200);
  assert.equal(output.requestHeaders["X-Source"], "manual");
});

test("executeSendWebhookAction classifies 5xx responses as retryable and 4xx responses as fatal", async () => {
  const action = createWebhookAction();

  webhookActionDeps.createTimeoutSignal = () => new AbortController().signal;
  webhookActionDeps.fetch = (async () => new Response("upstream down", { status: 503 })) as never;
  const retryable = await executeSendWebhookAction({
    action,
    context: {
      correlationId: "corr_123",
      payload: {
        ticketId: "T-100",
      },
      sourceContext: {
        sourceLabel: "webhook",
      } as never,
    },
  });
  assert.equal(retryable.classification, "retryable_failure");
  assert.equal(retryable.errorCode, "send_webhook_server_error");

  webhookActionDeps.fetch = (async () => new Response("bad request", { status: 422 })) as never;
  const fatal = await executeSendWebhookAction({
    action,
    context: {
      correlationId: "corr_123",
      payload: {
        ticketId: "T-100",
      },
      sourceContext: {
        sourceLabel: "webhook",
      } as never,
    },
  });
  assert.equal(fatal.classification, "fatal_failure");
  assert.equal(fatal.errorCode, "send_webhook_client_error");
});

test("executeSendWebhookAction treats network failures as retryable and records an error log", async () => {
  webhookActionDeps.createTimeoutSignal = () => new AbortController().signal;
  webhookActionDeps.fetch = (async () => {
    throw new Error("socket timeout");
  }) as never;

  const result = await executeSendWebhookAction({
    action: createWebhookAction(),
    context: {
      correlationId: "corr_123",
      payload: {
        ticketId: "T-100",
      },
      sourceContext: {
        sourceLabel: "internal_event",
      } as never,
    },
  });

  assert.equal(result.classification, "retryable_failure");
  assert.equal(result.errorCode, "send_webhook_network_error");
  assert.equal(result.logs.at(-1)?.level, "error");
});

test("executeSendWebhookAction fails closed on invalid template syntax", async () => {
  const action = createWebhookAction();
  action.config = {
    ...action.config,
    url: "https://hooks.example.test/{{ payload..ticketId }}",
  };

  const result = await executeSendWebhookAction({
    action,
    context: {
      correlationId: "corr_123",
      payload: {
        ticketId: "T-100",
      },
      sourceContext: {
        sourceLabel: "manual",
      } as never,
    },
  });

  assert.equal(result.classification, "fatal_failure");
  assert.equal(result.errorCode, "send_webhook_render_error");
});
