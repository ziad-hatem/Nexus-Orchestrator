import type {
  WorkflowActionConfig,
  WorkflowRecordValueType,
  WorkflowSourceContext,
} from "@/lib/server/workflows/types";

export const ACTION_WEBHOOK_METHODS = ["POST", "PUT", "PATCH"] as const;

export type ActionWebhookMethod = (typeof ACTION_WEBHOOK_METHODS)[number];

export type SendWebhookActionConfig = {
  url: string;
  method: ActionWebhookMethod;
  headers: Record<string, string>;
  body: string;
};

export type SendEmailActionConfig = {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
};

export type CreateTaskActionConfig = {
  title: string;
  description?: string;
  assigneeEmail?: string;
  dueAt?: string;
};

export type UpdateRecordFieldActionConfig = {
  recordType: string;
  recordKey: string;
  field: string;
  valueType: WorkflowRecordValueType;
  valueTemplate: string;
};

export type SupportedWorkflowActionConfigMap = {
  send_webhook: SendWebhookActionConfig;
  send_email: SendEmailActionConfig;
  create_task: CreateTaskActionConfig;
  update_record_field: UpdateRecordFieldActionConfig;
};

export type SupportedWorkflowActionConfigRecord =
  | {
      type: "send_webhook";
      config: SendWebhookActionConfig;
    }
  | {
      type: "send_email";
      config: SendEmailActionConfig;
    }
  | {
      type: "create_task";
      config: CreateTaskActionConfig;
    }
  | {
      type: "update_record_field";
      config: UpdateRecordFieldActionConfig;
    };

export type ActionRenderContext = {
  payload: Record<string, unknown>;
  context: WorkflowSourceContext;
};

export type WebhookActionOutput = {
  actionType: "send_webhook";
  url: string;
  method: ActionWebhookMethod;
  requestHeaders: Record<string, string>;
  requestBodyPreview: string;
  status: number;
  responsePreview: string;
};

export type EmailActionOutput = {
  actionType: "send_email";
  recipient: string;
  subject: string;
  providerMessageId: string | null;
  replyTo: string | null;
};

export type TaskActionOutput = {
  actionType: "create_task";
  taskId: string;
  title: string;
  assigneeEmail: string | null;
  dueAt: string | null;
  status: string;
};

export type RecordActionOutput = {
  actionType: "update_record_field";
  recordId: string;
  recordType: string;
  recordKey: string;
  field: string;
  valueType: WorkflowRecordValueType;
  value: unknown;
};

export type SupportedActionExecutionOutput =
  | WebhookActionOutput
  | EmailActionOutput
  | TaskActionOutput
  | RecordActionOutput;

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toHeadersMap(value: unknown): Record<string, string> {
  const record = toRecord(value);
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, candidate]) => [key.trim(), toStringValue(candidate).trim()])
      .filter(([key]) => key.length > 0),
  );
}

function isWebhookMethod(value: unknown): value is ActionWebhookMethod {
  return (
    typeof value === "string" &&
    ACTION_WEBHOOK_METHODS.includes(value as ActionWebhookMethod)
  );
}

function isRecordValueType(value: unknown): value is WorkflowRecordValueType {
  return (
    value === "string" ||
    value === "number" ||
    value === "boolean" ||
    value === "null" ||
    value === "json"
  );
}

export function normalizeSupportedWorkflowAction(
  action: WorkflowActionConfig,
): SupportedWorkflowActionConfigRecord | null {
  const config = toRecord(action.config);

  switch (action.type) {
    case "send_webhook":
      return {
        type: "send_webhook",
        config: {
          url: toStringValue(config.url).trim(),
          method: isWebhookMethod(config.method) ? config.method : "POST",
          headers: toHeadersMap(config.headers),
          body: toStringValue(config.body),
        },
      };
    case "send_email":
      return {
        type: "send_email",
        config: {
          to: toStringValue(config.to).trim(),
          subject: toStringValue(config.subject),
          body: toStringValue(config.body),
          replyTo: toStringValue(config.replyTo).trim() || undefined,
        },
      };
    case "create_task":
      return {
        type: "create_task",
        config: {
          title: toStringValue(config.title),
          description: toStringValue(config.description) || undefined,
          assigneeEmail: toStringValue(config.assigneeEmail).trim() || undefined,
          dueAt: toStringValue(config.dueAt).trim() || undefined,
        },
      };
    case "update_record_field":
      return {
        type: "update_record_field",
        config: {
          recordType: toStringValue(config.recordType).trim(),
          recordKey: toStringValue(config.recordKey).trim(),
          field: toStringValue(config.field).trim(),
          valueType: isRecordValueType(config.valueType)
            ? config.valueType
            : "string",
          valueTemplate: toStringValue(config.valueTemplate),
        },
      };
    default:
      return null;
  }
}
