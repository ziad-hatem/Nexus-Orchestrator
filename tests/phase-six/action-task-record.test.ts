import assert from "node:assert/strict";
import test from "node:test";
import {
  executeCreateTaskAction,
  taskActionDeps,
} from "@/lib/server/actions/task";
import {
  coerceRecordValue,
  executeUpdateRecordFieldAction,
  recordActionDeps,
} from "@/lib/server/actions/record";
import { createWorkflowActionDefinition } from "@/lib/server/workflows/types";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalTaskActionDeps = { ...taskActionDeps };
const originalRecordActionDeps = { ...recordActionDeps };

test.afterEach(() => {
  restoreMutableExports(taskActionDeps, originalTaskActionDeps);
  restoreMutableExports(recordActionDeps, originalRecordActionDeps);
});

function createTaskAction() {
  const action = createWorkflowActionDefinition("create_task");
  action.label = "Create task";
  action.config = {
    title: "Follow up {{ payload.ticketId }}",
    description: "Customer tier {{ payload.customer.tier }}",
    assigneeEmail: "{{ payload.assignee }}",
    dueAt: "{{ payload.dueAt }}",
  };
  return action;
}

function createRecordAction() {
  const action = createWorkflowActionDefinition("update_record_field");
  action.label = "Update record";
  action.config = {
    recordType: "ticket",
    recordKey: "{{ payload.ticketId }}",
    field: "priority",
    valueType: "number",
    valueTemplate: "{{ payload.priority }}",
  };
  return action;
}

test("executeCreateTaskAction creates a tenant-scoped task and resolves active assignees", async () => {
  let createdTaskInput: Record<string, unknown> | undefined;

  taskActionDeps.resolveActiveAssigneeByEmail = async () => ({
    userId: "user_1",
    email: "agent@example.com",
  });
  taskActionDeps.createWorkflowTaskRow = async (params) => {
    createdTaskInput = params as unknown as Record<string, unknown>;
    return {
      id: "task_1",
      organization_id: params.organizationId,
      workflow_id: params.workflowId,
      workflow_version_id: params.workflowVersionId,
      run_id: params.runId,
      step_id: params.stepId,
      title: params.title,
      description: params.description ?? null,
      status: "open",
      assignee_user_id: "user_1",
      assignee_email: "agent@example.com",
      due_at: params.dueAt ?? null,
      created_at: "2026-03-23T00:00:00.000Z",
      updated_at: "2026-03-23T00:00:00.000Z",
    };
  };

  const result = await executeCreateTaskAction({
    action: createTaskAction(),
    context: {
      organizationId: "org_1",
      workflowId: "workflow_1",
      workflowVersionId: "version_1",
      runId: "run_1",
      stepId: "step_1",
      payload: {
        ticketId: "T-100",
        customer: {
          tier: "vip",
        },
        assignee: "agent@example.com",
        dueAt: "2026-03-24T12:00:00.000Z",
      },
      sourceContext: {
        sourceLabel: "webhook",
      } as never,
    },
  });

  assert.equal(result.classification, "success");
  assert.equal(createdTaskInput?.organizationId, "org_1");
  assert.equal(createdTaskInput?.runId, "run_1");
  assert.deepEqual(result.output, {
    actionType: "create_task",
    taskId: "task_1",
    title: "Follow up T-100",
    assigneeEmail: "agent@example.com",
    dueAt: "2026-03-24T12:00:00.000Z",
    status: "open",
  });
});

test("executeCreateTaskAction rejects invalid due dates and cross-tenant assignees", async () => {
  const invalidDueAt = await executeCreateTaskAction({
    action: createTaskAction(),
    context: {
      organizationId: "org_1",
      workflowId: "workflow_1",
      workflowVersionId: "version_1",
      runId: "run_1",
      stepId: "step_1",
      payload: {
        ticketId: "T-100",
        customer: {
          tier: "vip",
        },
        assignee: "agent@example.com",
        dueAt: "not-a-date",
      },
      sourceContext: {
        sourceLabel: "manual",
      } as never,
    },
  });
  assert.equal(invalidDueAt.classification, "fatal_failure");
  assert.equal(invalidDueAt.errorCode, "invalid_task_due_at");

  taskActionDeps.resolveActiveAssigneeByEmail = async () => null;
  const missingAssignee = await executeCreateTaskAction({
    action: createTaskAction(),
    context: {
      organizationId: "org_1",
      workflowId: "workflow_1",
      workflowVersionId: "version_1",
      runId: "run_1",
      stepId: "step_1",
      payload: {
        ticketId: "T-100",
        customer: {
          tier: "vip",
        },
        assignee: "shared@example.com",
        dueAt: "2026-03-24T12:00:00.000Z",
      },
      sourceContext: {
        sourceLabel: "manual",
      } as never,
    },
  });
  assert.equal(missingAssignee.classification, "fatal_failure");
  assert.equal(missingAssignee.errorCode, "task_assignee_not_found");
});

test("coerceRecordValue supports the configured value types", () => {
  assert.equal(coerceRecordValue({ valueType: "number", rendered: "42" }), 42);
  assert.equal(coerceRecordValue({ valueType: "boolean", rendered: "true" }), true);
  assert.equal(coerceRecordValue({ valueType: "null", rendered: "ignored" }), null);
  assert.deepEqual(
    coerceRecordValue({ valueType: "json", rendered: '{"status":"open"}' }),
    { status: "open" },
  );
  assert.equal(coerceRecordValue({ valueType: "string", rendered: undefined }), "");
});

test("executeUpdateRecordFieldAction upserts tenant-scoped record fields", async () => {
  let upsertInput: Record<string, unknown> | undefined;

  recordActionDeps.upsertWorkflowRecordField = async (params) => {
    upsertInput = params as unknown as Record<string, unknown>;
    return {
      id: "record_1",
      organization_id: params.organizationId,
      record_type: params.recordType,
      record_key: params.recordKey,
      fields: {
        [params.field]: params.value,
      },
      created_by_workflow_id: params.workflowId,
      created_by_workflow_version_id: params.workflowVersionId,
      created_by_run_id: params.runId,
      created_by_step_id: params.stepId,
      updated_by_workflow_id: params.workflowId,
      updated_by_workflow_version_id: params.workflowVersionId,
      updated_by_run_id: params.runId,
      updated_by_step_id: params.stepId,
      created_at: "2026-03-23T00:00:00.000Z",
      updated_at: "2026-03-23T00:00:00.000Z",
    };
  };

  const result = await executeUpdateRecordFieldAction({
    action: createRecordAction(),
    context: {
      organizationId: "org_1",
      workflowId: "workflow_1",
      workflowVersionId: "version_1",
      runId: "run_1",
      stepId: "step_1",
      payload: {
        ticketId: "T-100",
        priority: "7",
      },
      sourceContext: {
        sourceLabel: "internal_event",
      } as never,
    },
  });

  assert.equal(result.classification, "success");
  assert.equal(upsertInput?.organizationId, "org_1");
  assert.equal(upsertInput?.recordKey, "T-100");
  assert.equal(upsertInput?.value, 7);
  assert.deepEqual(result.output, {
    actionType: "update_record_field",
    recordId: "record_1",
    recordType: "ticket",
    recordKey: "T-100",
    field: "priority",
    valueType: "number",
    value: 7,
  });
});

test("executeUpdateRecordFieldAction rejects unsafe fields and invalid value coercion", async () => {
  const unsafeFieldAction = createRecordAction();
  unsafeFieldAction.config = {
    ...unsafeFieldAction.config,
    field: "__proto__",
  };

  const unsafeField = await executeUpdateRecordFieldAction({
    action: unsafeFieldAction,
    context: {
      organizationId: "org_1",
      workflowId: "workflow_1",
      workflowVersionId: "version_1",
      runId: "run_1",
      stepId: "step_1",
      payload: {
        ticketId: "T-100",
        priority: "7",
      },
      sourceContext: {
        sourceLabel: "manual",
      } as never,
    },
  });
  assert.equal(unsafeField.classification, "fatal_failure");
  assert.equal(unsafeField.errorCode, "invalid_record_field");

  const invalidValue = await executeUpdateRecordFieldAction({
    action: createRecordAction(),
    context: {
      organizationId: "org_1",
      workflowId: "workflow_1",
      workflowVersionId: "version_1",
      runId: "run_1",
      stepId: "step_1",
      payload: {
        ticketId: "T-100",
        priority: "not-a-number",
      },
      sourceContext: {
        sourceLabel: "manual",
      } as never,
    },
  });
  assert.equal(invalidValue.classification, "fatal_failure");
  assert.equal(invalidValue.errorCode, "update_record_failed");
});
