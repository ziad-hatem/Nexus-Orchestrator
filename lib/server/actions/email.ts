import { Resend } from "resend";
import { getRequiredEnv } from "@/lib/env";
import type { ExecutorResult } from "@/lib/server/executions/types";
import type { WorkflowActionConfig, WorkflowSourceContext } from "@/lib/server/workflows/types";
import { normalizeEmail } from "@/lib/server/validation";
import {
  normalizeSupportedWorkflowAction,
  type EmailActionOutput,
} from "@/lib/server/actions/types";
import {
  renderTemplateString,
  TemplateRenderError,
} from "@/lib/server/actions/templating";

export const emailActionDeps = {
  createResendClient: (apiKey: string) => new Resend(apiKey),
  getRequiredEnv,
  getFromAddress: () =>
    process.env.RESEND_FROM_EMAIL ??
    "Nexus Orchestrator <onboarding@resend.dev>",
};

function buildLog(
  message: string,
  data?: Record<string, unknown>,
  level: "info" | "error" = "info",
): { at: string; level: "info" | "error"; message: string; data?: Record<string, unknown> } {
  return {
    at: new Date().toISOString(),
    level,
    message,
    data,
  };
}

function shouldRetryResendError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message.toLowerCase()
        : String(error).toLowerCase();

  return (
    /\b5\d{2}\b/.test(message) ||
    message.includes("408") ||
    message.includes("429") ||
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("temporar") ||
    message.includes("unavailable") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  );
}

function buildContext(sourceContext: WorkflowSourceContext, payload: Record<string, unknown>) {
  return {
    payload,
    context: sourceContext,
  };
}

export async function executeSendEmailAction(params: {
  action: WorkflowActionConfig;
  context: {
    payload: Record<string, unknown>;
    sourceContext: WorkflowSourceContext;
  };
}): Promise<ExecutorResult> {
  const normalized = normalizeSupportedWorkflowAction(params.action);
  if (!normalized || normalized.type !== "send_email") {
    return {
      classification: "fatal_failure",
      output: {},
      logs: [buildLog("Email action configuration could not be normalized.")],
      errorCode: "invalid_email_action_config",
      errorMessage: "Email action configuration is invalid.",
    };
  }

  try {
    const renderContext = buildContext(
      params.context.sourceContext,
      params.context.payload,
    );
    const to = String(
      renderTemplateString({
        template: normalized.config.to,
        context: renderContext,
      }) ?? "",
    ).trim();
    const subject = String(
      renderTemplateString({
        template: normalized.config.subject,
        context: renderContext,
      }) ?? "",
    );
    const body = String(
      renderTemplateString({
        template: normalized.config.body,
        context: renderContext,
      }) ?? "",
    );
    const replyTo = normalized.config.replyTo
      ? String(
          renderTemplateString({
            template: normalized.config.replyTo,
            context: renderContext,
          }) ?? "",
        ).trim()
      : "";

    const normalizedRecipient = normalizeEmail(to);
    if (!normalizedRecipient) {
      return {
        classification: "fatal_failure",
        output: {},
        logs: [buildLog("Email action resolved an invalid recipient.", { to }, "error")],
        errorCode: "invalid_email_recipient",
        errorMessage: "Email action resolved an invalid recipient address.",
      };
    }

    if (!subject.trim()) {
      return {
        classification: "fatal_failure",
        output: {},
        logs: [buildLog("Email action resolved an empty subject.", undefined, "error")],
        errorCode: "missing_email_subject",
        errorMessage: "Email action resolved an empty subject.",
      };
    }

    if (!body.trim()) {
      return {
        classification: "fatal_failure",
        output: {},
        logs: [buildLog("Email action resolved an empty body.", undefined, "error")],
        errorCode: "missing_email_body",
        errorMessage: "Email action resolved an empty body.",
      };
    }

    if (replyTo && !normalizeEmail(replyTo)) {
      return {
        classification: "fatal_failure",
        output: {},
        logs: [
          buildLog(
            "Email action resolved an invalid reply-to address.",
            { replyTo },
            "error",
          ),
        ],
        errorCode: "invalid_email_reply_to",
        errorMessage: "Email action resolved an invalid reply-to address.",
      };
    }

    const resend = emailActionDeps.createResendClient(
      emailActionDeps.getRequiredEnv("RESEND_API_KEY"),
    );
    const fromAddress = emailActionDeps.getFromAddress();

    const logs = [
      buildLog("Sending email action through Resend.", {
        to: normalizedRecipient,
        subject,
      }),
    ];

    try {
      const response = await resend.emails.send({
        from: fromAddress,
        to: [normalizedRecipient],
        subject,
        text: body,
        ...(replyTo ? { replyTo } : {}),
      });

      if (response.error) {
        const failureMessage =
          response.error.message ?? "Resend rejected the email action.";
        logs.push(
          buildLog(
            "Email action provider rejected the request.",
            { message: failureMessage },
            "error",
          ),
        );
        return {
          classification: shouldRetryResendError(response.error)
            ? "retryable_failure"
            : "fatal_failure",
          output: {
            actionType: "send_email",
            recipient: normalizedRecipient,
            subject,
            providerMessageId: null,
            replyTo: replyTo || null,
          } satisfies EmailActionOutput,
          logs,
          errorCode: "send_email_provider_error",
          errorMessage: failureMessage,
        };
      }

      return {
        classification: "success",
        output: {
          actionType: "send_email",
          recipient: normalizedRecipient,
          subject,
          providerMessageId: response.data?.id ?? null,
          replyTo: replyTo || null,
        } satisfies EmailActionOutput,
        logs,
      };
    } catch (error: unknown) {
      logs.push(
        buildLog(
          "Email action provider raised an exception.",
          {
            message:
              error instanceof Error
                ? error.message
                : "Email action failed unexpectedly.",
          },
          "error",
        ),
      );
      return {
        classification: shouldRetryResendError(error)
          ? "retryable_failure"
          : "fatal_failure",
        output: {
          actionType: "send_email",
          recipient: normalizedRecipient,
          subject,
          providerMessageId: null,
          replyTo: replyTo || null,
        } satisfies EmailActionOutput,
        logs,
        errorCode: "send_email_provider_exception",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Email action failed unexpectedly.",
      };
    }
  } catch (error: unknown) {
    return {
      classification: error instanceof TemplateRenderError ? "fatal_failure" : "fatal_failure",
      output: {},
      logs: [
        buildLog("Email action templating failed.", {
          message: error instanceof Error ? error.message : "Unknown error",
        }, "error"),
      ],
      errorCode: "send_email_render_error",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Email action templating failed unexpectedly.",
    };
  }
}
