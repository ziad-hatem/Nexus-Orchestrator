import {
  getExecutionWebhookTimeoutMs,
} from "@/lib/server/executions/queue";
import type {
  ExecutorContext,
  ExecutorResult,
} from "@/lib/server/executions/types";
import type { WorkflowActionConfig } from "@/lib/server/workflows/types";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildLog(
  message: string,
  data?: Record<string, unknown>,
): { at: string; level: "info"; message: string; data?: Record<string, unknown> } {
  return {
    at: new Date().toISOString(),
    level: "info",
    message,
    data,
  };
}

async function executeWebhookRequestAction(params: {
  action: WorkflowActionConfig;
  context: ExecutorContext;
}): Promise<ExecutorResult> {
  const config = toRecord(params.action.config);
  const url = toStringValue(config.url);
  const method = toStringValue(config.method) || "POST";
  const payloadTemplate = toStringValue(config.payloadTemplate);

  const logs = [
    buildLog("Dispatching outbound webhook request.", {
      url,
      method,
      runId: params.context.run.run_key,
    }),
  ];

  try {
    const signal = AbortSignal.timeout(getExecutionWebhookTimeoutMs());
    let body: string | undefined;
    let contentType = "text/plain";

    if (payloadTemplate) {
      try {
        const parsed = JSON.parse(payloadTemplate);
        body = JSON.stringify(parsed);
        contentType = "application/json";
      } catch {
        body = payloadTemplate;
      }
    }

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": contentType,
        "X-Nexus-Correlation-Id": params.context.correlationId,
      },
      body,
      cache: "no-store",
      signal,
    });
    const responseText = await response.text();

    logs.push(
      buildLog("Outbound webhook request completed.", {
        status: response.status,
        ok: response.ok,
      }),
    );

    if (!response.ok) {
      return {
        classification: response.status >= 500 ? "retryable_failure" : "fatal_failure",
        output: {
          status: response.status,
          responsePreview: responseText.slice(0, 500),
        },
        logs,
        errorCode: response.status >= 500 ? "webhook_request_server_error" : "webhook_request_client_error",
        errorMessage: `Webhook request failed with status ${response.status}.`,
      };
    }

    return {
      classification: "success",
      output: {
        status: response.status,
        responsePreview: responseText.slice(0, 500),
      },
      logs,
    };
  } catch (error: unknown) {
    return {
      classification: "retryable_failure",
      output: {},
      logs,
      errorCode: "webhook_request_network_error",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Webhook request failed unexpectedly.",
    };
  }
}

async function executeNotifyAction(params: {
  action: WorkflowActionConfig;
  context: ExecutorContext;
}): Promise<ExecutorResult> {
  const config = toRecord(params.action.config);
  const channel = toStringValue(config.channel) || "email";
  const recipient = toStringValue(config.recipient);

  return {
    classification: "success",
    output: {
      mode: "stub",
      channel,
      recipient,
      delivered: false,
    },
    logs: [
      buildLog("Notify action recorded as an internal stub.", {
        channel,
        recipient,
        correlationId: params.context.correlationId,
      }),
    ],
  };
}

async function executeTicketUpdateAction(params: {
  action: WorkflowActionConfig;
  context: ExecutorContext;
}): Promise<ExecutorResult> {
  const config = toRecord(params.action.config);
  const field = toStringValue(config.field);
  const value = toStringValue(config.value);

  return {
    classification: "success",
    output: {
      mode: "stub",
      field,
      value,
      updated: false,
    },
    logs: [
      buildLog("Ticket update action recorded as an internal stub.", {
        field,
        value,
        correlationId: params.context.correlationId,
      }),
    ],
  };
}

export async function executeWorkflowActionNode(params: {
  action: WorkflowActionConfig;
  context: ExecutorContext;
}): Promise<ExecutorResult> {
  switch (params.action.type) {
    case "webhook_request":
      return executeWebhookRequestAction(params);
    case "ticket_update":
      return executeTicketUpdateAction(params);
    case "notify":
    case "legacy_custom":
    default:
      return executeNotifyAction(params);
  }
}
