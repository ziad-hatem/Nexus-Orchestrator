import type { ExecutorResult } from "@/lib/server/executions/types";
import type { WorkflowActionConfig, WorkflowSourceContext } from "@/lib/server/workflows/types";
import { normalizeEmail } from "@/lib/server/validation";
import {
  createWorkflowTaskRow,
  resolveActiveAssigneeByEmail,
} from "@/lib/server/actions/repository";
import {
  normalizeSupportedWorkflowAction,
  type TaskActionOutput,
} from "@/lib/server/actions/types";
import {
  renderTemplateString,
  TemplateRenderError,
} from "@/lib/server/actions/templating";

export const taskActionDeps = {
  resolveActiveAssigneeByEmail,
  createWorkflowTaskRow,
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

function buildContext(sourceContext: WorkflowSourceContext, payload: Record<string, unknown>) {
  return {
    payload,
    context: sourceContext,
  };
}

export async function executeCreateTaskAction(params: {
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
  if (!normalized || normalized.type !== "create_task") {
    return {
      classification: "fatal_failure",
      output: {},
      logs: [buildLog("Task action configuration could not be normalized.")],
      errorCode: "invalid_task_action_config",
      errorMessage: "Task action configuration is invalid.",
    };
  }

  try {
    const renderContext = buildContext(
      params.context.sourceContext,
      params.context.payload,
    );
    const title = String(
      renderTemplateString({
        template: normalized.config.title,
        context: renderContext,
      }) ?? "",
    ).trim();
    const description = normalized.config.description
      ? String(
          renderTemplateString({
            template: normalized.config.description,
            context: renderContext,
          }) ?? "",
        )
      : "";
    const assigneeEmail = normalized.config.assigneeEmail
      ? String(
          renderTemplateString({
            template: normalized.config.assigneeEmail,
            context: renderContext,
          }) ?? "",
        ).trim()
      : "";
    const dueAt = normalized.config.dueAt
      ? String(
          renderTemplateString({
            template: normalized.config.dueAt,
            context: renderContext,
          }) ?? "",
        ).trim()
      : "";

    if (!title) {
      return {
        classification: "fatal_failure",
        output: {},
        logs: [buildLog("Task action resolved an empty title.", undefined, "error")],
        errorCode: "missing_task_title",
        errorMessage: "Task action resolved an empty title.",
      };
    }

    let parsedDueAt: string | null = null;
    if (dueAt) {
      const timestamp = Date.parse(dueAt);
      if (Number.isNaN(timestamp)) {
        return {
          classification: "fatal_failure",
          output: {},
          logs: [
            buildLog(
              "Task action resolved an invalid due date.",
              { dueAt },
              "error",
            ),
          ],
          errorCode: "invalid_task_due_at",
          errorMessage: "Task action resolved an invalid due date.",
        };
      }
      parsedDueAt = new Date(timestamp).toISOString();
    }

    let assigneeUserId: string | null = null;
    let assigneeAddress: string | null = null;
    if (assigneeEmail) {
      const normalizedAssignee = normalizeEmail(assigneeEmail);
      if (!normalizedAssignee) {
        return {
          classification: "fatal_failure",
          output: {},
          logs: [
            buildLog(
              "Task action resolved an invalid assignee email.",
              { assigneeEmail },
              "error",
            ),
          ],
          errorCode: "invalid_task_assignee",
          errorMessage: "Task action resolved an invalid assignee email.",
        };
      }

      const assignee = await taskActionDeps.resolveActiveAssigneeByEmail({
        organizationId: params.context.organizationId,
        email: normalizedAssignee,
      });
      if (!assignee) {
        return {
          classification: "fatal_failure",
          output: {},
          logs: [
            buildLog("Task action assignee was not found in the active organization.", {
              assigneeEmail: normalizedAssignee,
            }, "error"),
          ],
          errorCode: "task_assignee_not_found",
          errorMessage:
            "Task assignee must be an active member of the same organization.",
        };
      }

      assigneeUserId = assignee.userId;
      assigneeAddress = assignee.email;
    }

    const task = await taskActionDeps.createWorkflowTaskRow({
      organizationId: params.context.organizationId,
      workflowId: params.context.workflowId,
      workflowVersionId: params.context.workflowVersionId,
      runId: params.context.runId,
      stepId: params.context.stepId,
      title,
      description: description || null,
      assigneeUserId,
      assigneeEmail: assigneeAddress,
      dueAt: parsedDueAt,
    });

    return {
      classification: "success",
      output: {
        actionType: "create_task",
        taskId: task.id,
        title: task.title,
        assigneeEmail: task.assignee_email,
        dueAt: task.due_at,
        status: task.status,
      } satisfies TaskActionOutput,
      logs: [
        buildLog("Created workflow task outcome.", {
          taskId: task.id,
          assigneeEmail: task.assignee_email,
        }),
      ],
    };
  } catch (error: unknown) {
    return {
      classification: error instanceof TemplateRenderError ? "fatal_failure" : "fatal_failure",
      output: {},
      logs: [
        buildLog("Task action failed.", {
          message: error instanceof Error ? error.message : "Unknown error",
        }, "error"),
      ],
      errorCode:
        error instanceof TemplateRenderError
          ? "create_task_render_error"
          : "create_task_failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Task action failed unexpectedly.",
    };
  }
}
