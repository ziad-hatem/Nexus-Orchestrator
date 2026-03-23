import assert from "node:assert/strict";
import test from "node:test";
import {
  emailActionDeps,
  executeSendEmailAction,
} from "@/lib/server/actions/email";
import { createWorkflowActionDefinition } from "@/lib/server/workflows/types";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalEmailActionDeps = { ...emailActionDeps };

test.afterEach(() => {
  restoreMutableExports(emailActionDeps, originalEmailActionDeps);
});

function createEmailAction() {
  const action = createWorkflowActionDefinition("send_email");
  action.label = "Send follow-up";
  action.config = {
    to: "{{ payload.recipient }}",
    subject: "Ticket {{ payload.ticketId }}",
    body: "Priority={{ payload.priority }}",
    replyTo: "{{ context.replyTo }}",
  };
  return action;
}

test("executeSendEmailAction renders the message and succeeds through the provider", async () => {
  let sentPayload: Record<string, unknown> | undefined;

  emailActionDeps.getRequiredEnv = () => "resend_test_key";
  emailActionDeps.getFromAddress = () => "Nexus <noreply@example.com>";
  emailActionDeps.createResendClient = () =>
    ({
      emails: {
        send: async (payload: Record<string, unknown>) => {
          sentPayload = payload;
          return {
            data: {
              id: "msg_123",
            },
            error: null,
          };
        },
      },
    }) as never;

  const result = await executeSendEmailAction({
    action: createEmailAction(),
    context: {
      payload: {
        recipient: "nexus@example.com",
        ticketId: "T-100",
        priority: "high",
      },
      sourceContext: {
        sourceLabel: "manual",
        replyTo: "support@example.com",
      } as never,
    },
  });

  assert.equal(result.classification, "success");
  assert.deepEqual(sentPayload, {
    from: "Nexus <noreply@example.com>",
    to: ["nexus@example.com"],
    subject: "Ticket T-100",
    text: "Priority=high",
    replyTo: "support@example.com",
  });
  assert.deepEqual(result.output, {
    actionType: "send_email",
    recipient: "nexus@example.com",
    subject: "Ticket T-100",
    providerMessageId: "msg_123",
    replyTo: "support@example.com",
  });
});

test("executeSendEmailAction fails closed for invalid recipients and invalid reply-to addresses", async () => {
  const action = createEmailAction();

  const invalidRecipient = await executeSendEmailAction({
    action,
    context: {
      payload: {
        recipient: "not-an-email",
        ticketId: "T-100",
        priority: "high",
      },
      sourceContext: {
        sourceLabel: "manual",
        replyTo: "support@example.com",
      } as never,
    },
  });
  assert.equal(invalidRecipient.classification, "fatal_failure");
  assert.equal(invalidRecipient.errorCode, "invalid_email_recipient");

  const invalidReplyTo = await executeSendEmailAction({
    action,
    context: {
      payload: {
        recipient: "nexus@example.com",
        ticketId: "T-100",
        priority: "high",
      },
      sourceContext: {
        sourceLabel: "manual",
        replyTo: "bad-address",
      } as never,
    },
  });
  assert.equal(invalidReplyTo.classification, "fatal_failure");
  assert.equal(invalidReplyTo.errorCode, "invalid_email_reply_to");
});

test("executeSendEmailAction classifies provider outages as retryable", async () => {
  emailActionDeps.getRequiredEnv = () => "resend_test_key";
  emailActionDeps.createResendClient = () =>
    ({
      emails: {
        send: async () => ({
          data: null,
          error: {
            message: "503 service unavailable",
          },
        }),
      },
    }) as never;

  const result = await executeSendEmailAction({
    action: createEmailAction(),
    context: {
      payload: {
        recipient: "nexus@example.com",
        ticketId: "T-100",
        priority: "high",
      },
      sourceContext: {
        sourceLabel: "manual",
        replyTo: "support@example.com",
      } as never,
    },
  });

  assert.equal(result.classification, "retryable_failure");
  assert.equal(result.errorCode, "send_email_provider_error");
  assert.equal(result.logs.at(-1)?.level, "error");
});

test("executeSendEmailAction does not classify unrelated messages containing the digit 5 as retryable", async () => {
  emailActionDeps.getRequiredEnv = () => "resend_test_key";
  emailActionDeps.createResendClient = () =>
    ({
      emails: {
        send: async () => ({
          data: null,
          error: {
            message: "Template contains 5 invalid placeholders.",
          },
        }),
      },
    }) as never;

  const result = await executeSendEmailAction({
    action: createEmailAction(),
    context: {
      payload: {
        recipient: "nexus@example.com",
        ticketId: "T-100",
        priority: "high",
      },
      sourceContext: {
        sourceLabel: "manual",
        replyTo: "support@example.com",
      } as never,
    },
  });

  assert.equal(result.classification, "fatal_failure");
  assert.equal(result.errorCode, "send_email_provider_error");
});

test("executeSendEmailAction fails closed on invalid template syntax", async () => {
  const action = createEmailAction();
  action.config = {
    ...action.config,
    subject: "Ticket {{ payload..ticketId }}",
  };

  const result = await executeSendEmailAction({
    action,
    context: {
      payload: {
        recipient: "nexus@example.com",
        ticketId: "T-100",
        priority: "high",
      },
      sourceContext: {
        sourceLabel: "manual",
        replyTo: "support@example.com",
      } as never,
    },
  });

  assert.equal(result.classification, "fatal_failure");
  assert.equal(result.errorCode, "send_email_render_error");
});
