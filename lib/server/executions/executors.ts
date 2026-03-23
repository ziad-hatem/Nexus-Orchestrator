import { executeSendEmailAction } from "@/lib/server/actions/email";
import { executeUpdateRecordFieldAction } from "@/lib/server/actions/record";
import { executeCreateTaskAction } from "@/lib/server/actions/task";
import { executeSendWebhookAction } from "@/lib/server/actions/webhook";
import type {
  ExecutorContext,
  ExecutorResult,
} from "@/lib/server/executions/types";
import type { WorkflowActionConfig } from "@/lib/server/workflows/types";

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

export const workflowActionExecutorDeps = {
  executeSendWebhookAction,
  executeSendEmailAction,
  executeCreateTaskAction,
  executeUpdateRecordFieldAction,
};

export async function executeWorkflowActionNode(params: {
  action: WorkflowActionConfig;
  context: ExecutorContext;
}): Promise<ExecutorResult> {
  switch (params.action.type) {
    case "send_webhook":
      return workflowActionExecutorDeps.executeSendWebhookAction({
        action: params.action,
        context: {
          correlationId: params.context.correlationId,
          payload: params.context.payload,
          sourceContext: params.context.sourceContext,
        },
      });
    case "send_email":
      return workflowActionExecutorDeps.executeSendEmailAction({
        action: params.action,
        context: {
          payload: params.context.payload,
          sourceContext: params.context.sourceContext,
        },
      });
    case "create_task":
      return workflowActionExecutorDeps.executeCreateTaskAction({
        action: params.action,
        context: {
          organizationId: params.context.organizationId,
          workflowId: params.context.workflowId,
          workflowVersionId: params.context.workflowVersionId,
          runId: params.context.run.id,
          stepId: params.context.stepId,
          payload: params.context.payload,
          sourceContext: params.context.sourceContext,
        },
      });
    case "update_record_field":
      return workflowActionExecutorDeps.executeUpdateRecordFieldAction({
        action: params.action,
        context: {
          organizationId: params.context.organizationId,
          workflowId: params.context.workflowId,
          workflowVersionId: params.context.workflowVersionId,
          runId: params.context.run.id,
          stepId: params.context.stepId,
          payload: params.context.payload,
          sourceContext: params.context.sourceContext,
        },
      });
    case "legacy_custom":
    default:
      return {
        classification: "fatal_failure",
        output: {},
        logs: [
          buildLog("Unsupported legacy action reached execution.", {
            actionType: params.action.type,
            legacyIssue: params.action.legacyIssue ?? null,
          }, "error"),
        ],
        errorCode: "unsupported_legacy_action",
        errorMessage:
          params.action.legacyIssue ??
          "This workflow contains a legacy action that must be converted before execution.",
      };
  }
}
