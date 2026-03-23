import type { ExecutorResult } from "@/lib/server/executions/types";
import type {
  WorkflowActionConfig,
  WorkflowRecordValueType,
  WorkflowSourceContext,
} from "@/lib/server/workflows/types";
import {
  upsertWorkflowRecordField,
} from "@/lib/server/actions/repository";
import {
  normalizeSupportedWorkflowAction,
  type RecordActionOutput,
} from "@/lib/server/actions/types";
import {
  renderTemplateString,
  TemplateRenderError,
} from "@/lib/server/actions/templating";
import { isSafeWorkflowRecordFieldKey } from "@/lib/server/validation";

function buildLog(
  message: string,
  data?: Record<string, unknown>,
): { at: string; level: "info" | "error"; message: string; data?: Record<string, unknown> } {
  return {
    at: new Date().toISOString(),
    level: "info",
    message,
    data,
  };
}

function buildContext(sourceContext: WorkflowSourceContext, payload: Record<string, unknown>) {
  return {
    payload,
    context: sourceContext,
  };
}

function coerceRecordValue(params: {
  valueType: WorkflowRecordValueType;
  rendered: unknown;
}): unknown {
  switch (params.valueType) {
    case "number": {
      if (typeof params.rendered === "number") {
        return params.rendered;
      }

      const parsed = Number(String(params.rendered ?? "").trim());
      if (!Number.isFinite(parsed)) {
        throw new Error("Record update value must resolve to a finite number.");
      }

      return parsed;
    }
    case "boolean": {
      if (typeof params.rendered === "boolean") {
        return params.rendered;
      }

      const lowered = String(params.rendered ?? "").trim().toLowerCase();
      if (lowered === "true") {
        return true;
      }
      if (lowered === "false") {
        return false;
      }

      throw new Error("Record update value must resolve to true or false.");
    }
    case "null":
      return null;
    case "json": {
      if (
        typeof params.rendered === "object" &&
        params.rendered !== null
      ) {
        return params.rendered;
      }

      try {
        return JSON.parse(String(params.rendered ?? ""));
      } catch {
        throw new Error("Record update JSON value must resolve to valid JSON.");
      }
    }
    case "string":
    default:
      return typeof params.rendered === "string"
        ? params.rendered
        : JSON.stringify(params.rendered);
  }
}

export async function executeUpdateRecordFieldAction(params: {
  action: WorkflowActionConfig;
  context: {
    organizationId: string;
    workflowId: string;
    workflowVersionId: string;
    runId: string;
    stepId: string;
    payload: Record<string, unknown>;
    sourceContext: WorkflowSourceContext;
  };
}): Promise<ExecutorResult> {
  const normalized = normalizeSupportedWorkflowAction(params.action);
  if (!normalized || normalized.type !== "update_record_field") {
    return {
      classification: "fatal_failure",
      output: {},
      logs: [buildLog("Record action configuration could not be normalized.")],
      errorCode: "invalid_record_action_config",
      errorMessage: "Record action configuration is invalid.",
    };
  }

  try {
    const renderContext = buildContext(
      params.context.sourceContext,
      params.context.payload,
    );
    const recordType = String(
      renderTemplateString({
        template: normalized.config.recordType,
        context: renderContext,
      }) ?? "",
    ).trim();
    const recordKey = String(
      renderTemplateString({
        template: normalized.config.recordKey,
        context: renderContext,
      }) ?? "",
    ).trim();
    const field = String(
      renderTemplateString({
        template: normalized.config.field,
        context: renderContext,
      }) ?? "",
    ).trim();
    const renderedValue =
      normalized.config.valueType === "null"
        ? null
        : renderTemplateString({
            template: normalized.config.valueTemplate,
            context: renderContext,
          });

    if (!recordType || !recordKey) {
      return {
        classification: "fatal_failure",
        output: {},
        logs: [buildLog("Record action resolved an empty record identity.")],
        errorCode: "missing_record_identity",
        errorMessage: "Record action requires both record type and record key.",
      };
    }

    if (!field || !isSafeWorkflowRecordFieldKey(field)) {
      return {
        classification: "fatal_failure",
        output: {},
        logs: [buildLog("Record action resolved an unsafe field key.", { field })],
        errorCode: "invalid_record_field",
        errorMessage: "Record action resolved an unsafe field key.",
      };
    }

    const value = coerceRecordValue({
      valueType: normalized.config.valueType,
      rendered: renderedValue,
    });

    const record = await upsertWorkflowRecordField({
      organizationId: params.context.organizationId,
      workflowId: params.context.workflowId,
      workflowVersionId: params.context.workflowVersionId,
      runId: params.context.runId,
      stepId: params.context.stepId,
      recordType,
      recordKey,
      field,
      value,
    });

    return {
      classification: "success",
      output: {
        actionType: "update_record_field",
        recordId: record.id,
        recordType,
        recordKey,
        field,
        valueType: normalized.config.valueType,
        value,
      } satisfies RecordActionOutput,
      logs: [
        buildLog("Upserted workflow record field.", {
          recordId: record.id,
          recordType,
          recordKey,
          field,
        }),
      ],
    };
  } catch (error: unknown) {
    return {
      classification: "fatal_failure",
      output: {},
      logs: [
        buildLog("Record action failed.", {
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      ],
      errorCode:
        error instanceof TemplateRenderError
          ? "update_record_render_error"
          : "update_record_failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Record action failed unexpectedly.",
    };
  }
}
