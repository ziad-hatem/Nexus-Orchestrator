import assert from "node:assert/strict";
import test from "node:test";
import {
  executeWorkflowActionNode,
  workflowActionExecutorDeps,
} from "@/lib/server/executions/executors";
import type { ExecutorContext } from "@/lib/server/executions/types";
import { createWorkflowActionDefinition } from "@/lib/server/workflows/types";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalWorkflowActionExecutorDeps = { ...workflowActionExecutorDeps };

test.afterEach(() => {
  restoreMutableExports(
    workflowActionExecutorDeps,
    originalWorkflowActionExecutorDeps,
  );
});

function createExecutorContext(): ExecutorContext {
  return {
    run: {
      id: "run_db_1",
      organization_id: "org_1",
      workflow_id: "workflow_db_1",
      workflow_version_id: "version_1",
      binding_id: "binding_1",
      run_key: "RUN-1001",
      correlation_id: "corr_1",
      status: "running",
      trigger_source: "manual",
      source_context: {
        sourceLabel: "manual",
      },
      payload: {
        ticketId: "T-100",
      },
      idempotency_key: null,
      created_by_event_id: null,
      attempt_count: 1,
      max_attempts: 3,
      started_at: "2026-03-23T00:00:00.000Z",
      completed_at: null,
      cancel_requested_at: null,
      cancelled_at: null,
      last_heartbeat_at: "2026-03-23T00:00:01.000Z",
      next_retry_at: null,
      last_retry_at: null,
      failure_code: null,
      failure_message: null,
      created_at: "2026-03-23T00:00:00.000Z",
      updated_at: "2026-03-23T00:00:01.000Z",
    },
    stepId: "step_1",
    correlationId: "corr_1",
    organizationId: "org_1",
    workflowId: "workflow_db_1",
    workflowVersionId: "version_1",
    payload: {
      ticketId: "T-100",
    },
    sourceContext: {
      sourceLabel: "manual",
    } as never,
  };
}

test("executeWorkflowActionNode dispatches each supported action to the correct executor dependency", async () => {
  const calls: string[] = [];
  workflowActionExecutorDeps.executeSendWebhookAction = async () => {
    calls.push("send_webhook");
    return {
      classification: "success",
      output: { actionType: "send_webhook", status: 200 },
      logs: [],
    } as never;
  };
  workflowActionExecutorDeps.executeSendEmailAction = async () => {
    calls.push("send_email");
    return {
      classification: "success",
      output: { actionType: "send_email", recipient: "ops@example.com" },
      logs: [],
    } as never;
  };
  workflowActionExecutorDeps.executeCreateTaskAction = async (params) => {
    calls.push(`create_task:${params.context.runId}:${params.context.organizationId}`);
    return {
      classification: "success",
      output: { actionType: "create_task", taskId: "task_1" },
      logs: [],
    } as never;
  };
  workflowActionExecutorDeps.executeUpdateRecordFieldAction = async (params) => {
    calls.push(`update_record_field:${params.context.stepId}:${params.context.workflowVersionId}`);
    return {
      classification: "success",
      output: { actionType: "update_record_field", recordId: "record_1" },
      logs: [],
    } as never;
  };

  for (const type of [
    "send_webhook",
    "send_email",
    "create_task",
    "update_record_field",
  ] as const) {
    const action = createWorkflowActionDefinition(type);
    await executeWorkflowActionNode({
      action,
      context: createExecutorContext(),
    });
  }

  assert.deepEqual(calls, [
    "send_webhook",
    "send_email",
    "create_task:run_db_1:org_1",
    "update_record_field:step_1:version_1",
  ]);
});

test("executeWorkflowActionNode returns a fatal failure for legacy actions", async () => {
  const action = createWorkflowActionDefinition("send_email");
  action.type = "legacy_custom";
  action.legacyIssue = "Convert this action before execution.";

  const result = await executeWorkflowActionNode({
    action,
    context: createExecutorContext(),
  });

  assert.equal(result.classification, "fatal_failure");
  assert.equal(result.errorCode, "unsupported_legacy_action");
  assert.equal(result.logs[0]?.level, "error");
});
