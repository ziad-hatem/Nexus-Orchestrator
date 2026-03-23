import type { ExecutorResult } from "@/lib/server/executions/types";
import type {
  WorkflowActionConfig,
  WorkflowSourceContext,
} from "@/lib/server/workflows/types";
import { getExecutionWebhookTimeoutMs } from "@/lib/server/executions/queue";
import {
  normalizeSupportedWorkflowAction,
  type ActionWebhookMethod,
  type WebhookActionOutput,
} from "@/lib/server/actions/types";
import {
  renderTemplateString,
  renderTemplatedValue,
  TemplateRenderError,
} from "@/lib/server/actions/templating";

export const webhookActionDeps = {
  fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
  getExecutionWebhookTimeoutMs,
  createTimeoutSignal: (timeoutMs: number) => AbortSignal.timeout(timeoutMs),
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

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function inferContentType(body: unknown): string {
  if (typeof body !== "string") {
    return "application/json";
  }

  const trimmed = body.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return "application/json";
  }

  return "text/plain";
}

function serializeRequestBody(body: unknown): string {
  if (typeof body === "undefined") {
    return "";
  }

  if (typeof body === "string") {
    return body;
  }

  return JSON.stringify(body);
}

function buildOutput(params: {
  url: string;
  method: ActionWebhookMethod;
  headers: Record<string, string>;
  requestBody: string;
  status: number;
  responsePreview: string;
}): WebhookActionOutput {
  return {
    actionType: "send_webhook",
    url: params.url,
    method: params.method,
    requestHeaders: params.headers,
    requestBodyPreview: params.requestBody.slice(0, 800),
    status: params.status,
    responsePreview: params.responsePreview.slice(0, 800),
  };
}

export async function executeSendWebhookAction(params: {
  action: WorkflowActionConfig;
  context: {
    correlationId: string;
    payload: Record<string, unknown>;
    sourceContext: WorkflowSourceContext;
  };
}): Promise<ExecutorResult> {
  const normalized = normalizeSupportedWorkflowAction(params.action);
  if (!normalized || normalized.type !== "send_webhook") {
    return {
      classification: "fatal_failure",
      output: {},
      logs: [buildLog("Webhook action configuration could not be normalized.")],
      errorCode: "invalid_webhook_action_config",
      errorMessage: "Webhook action configuration is invalid.",
    };
  }

  try {
    const renderedUrl = renderTemplateString({
      template: normalized.config.url,
      context: {
        payload: params.context.payload,
        context: params.context.sourceContext,
      },
    });
    const renderedHeaders = renderTemplatedValue(normalized.config.headers, {
      payload: params.context.payload,
      context: params.context.sourceContext,
    });
    const renderedBody = renderTemplateString({
      template: normalized.config.body,
      context: {
        payload: params.context.payload,
        context: params.context.sourceContext,
      },
    });

    const url = toStringValue(renderedUrl).trim();
    if (!url) {
      return {
        classification: "fatal_failure",
        output: {},
        logs: [buildLog("Webhook action resolved an empty destination URL.", undefined, "error")],
        errorCode: "missing_webhook_destination",
        errorMessage: "Webhook action resolved an empty destination URL.",
      };
    }

    let absoluteUrl: URL;
    try {
      absoluteUrl = new URL(url);
    } catch {
        return {
          classification: "fatal_failure",
          output: {},
          logs: [
            buildLog(
              "Webhook action resolved an invalid destination URL.",
              { url },
              "error",
            ),
          ],
          errorCode: "invalid_webhook_destination",
          errorMessage: "Webhook action resolved an invalid destination URL.",
        };
      }

    const requestBody = serializeRequestBody(renderedBody);
    const requestHeaders = Object.fromEntries(
      Object.entries(renderedHeaders).map(([key, value]) => [
        key,
        typeof value === "string" ? value : JSON.stringify(value),
      ]),
    );
    if (!requestHeaders["Content-Type"] && !requestHeaders["content-type"]) {
      requestHeaders["Content-Type"] = inferContentType(renderedBody);
    }
    requestHeaders["X-Nexus-Correlation-Id"] = params.context.correlationId;

    const logs = [
      buildLog("Dispatching outbound webhook action.", {
        url: absoluteUrl.toString(),
        method: normalized.config.method,
      }),
    ];

    try {
      const signal = webhookActionDeps.createTimeoutSignal(
        webhookActionDeps.getExecutionWebhookTimeoutMs(),
      );
      const response = await webhookActionDeps.fetch(absoluteUrl, {
        method: normalized.config.method,
        headers: requestHeaders,
        body: requestBody || undefined,
        signal,
        cache: "no-store",
      });
      const responseText = await response.text();
      logs.push(
        buildLog("Outbound webhook action completed.", {
          status: response.status,
          ok: response.ok,
        }),
      );

      if (!response.ok) {
        logs.push(
          buildLog(
            "Outbound webhook action received a failure response.",
            { status: response.status },
            "error",
          ),
        );
        return {
          classification:
            response.status >= 500 ? "retryable_failure" : "fatal_failure",
          output: buildOutput({
            url: absoluteUrl.toString(),
            method: normalized.config.method,
            headers: requestHeaders,
            requestBody,
            status: response.status,
            responsePreview: responseText,
          }),
          logs,
          errorCode:
            response.status >= 500
              ? "send_webhook_server_error"
              : "send_webhook_client_error",
          errorMessage: `Webhook action failed with status ${response.status}.`,
        };
      }

      return {
        classification: "success",
        output: buildOutput({
          url: absoluteUrl.toString(),
          method: normalized.config.method,
          headers: requestHeaders,
          requestBody,
          status: response.status,
          responsePreview: responseText,
        }),
        logs,
      };
    } catch (error: unknown) {
      logs.push(
        buildLog(
          "Outbound webhook action failed before receiving a response.",
          {
            message:
              error instanceof Error
                ? error.message
                : "Webhook action failed unexpectedly.",
          },
          "error",
        ),
      );
      return {
        classification: "retryable_failure",
        output: {
          actionType: "send_webhook",
          url: absoluteUrl.toString(),
          method: normalized.config.method,
          requestHeaders,
          requestBodyPreview: requestBody.slice(0, 800),
        },
        logs,
        errorCode: "send_webhook_network_error",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Webhook action failed unexpectedly.",
      };
    }
  } catch (error: unknown) {
    return {
      classification: error instanceof TemplateRenderError ? "fatal_failure" : "fatal_failure",
      output: {},
      logs: [
        buildLog("Webhook action templating failed.", {
          message: error instanceof Error ? error.message : "Unknown error",
        }, "error"),
      ],
      errorCode: "send_webhook_render_error",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Webhook action templating failed unexpectedly.",
    };
  }
}
