import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorkflowCanvas,
  createEmptyWorkflowDraftDocument,
  createWorkflowActionDefinition,
  createWorkflowConditionDefinition,
  syncWorkflowDraftCanvas,
  type WorkflowDraftDocument,
} from "@/lib/server/workflows/types";
import { validateWorkflowDraftDocument } from "@/lib/server/workflows/validation";

function createValidEmailAction() {
  const action = createWorkflowActionDefinition("send_email");
  action.label = "Send email";
  action.config = {
    to: "nexus@example.com",
    subject: "Workflow update",
    body: "A workflow step completed.",
    replyTo: "",
  };
  return action;
}

function createValidDraft(): WorkflowDraftDocument {
  const draft = createEmptyWorkflowDraftDocument({
    name: "Incident triage",
    description: "Routes incidents to the right team",
    category: "Operations",
    tags: ["nexus", "urgent"],
    triggerType: "manual",
  });

  const nextDraft = {
    ...draft,
    config: {
      ...draft.config,
      actions: [createValidEmailAction()],
    },
  };

  return syncWorkflowDraftCanvas({
    ...nextDraft,
    canvas: buildWorkflowCanvas(nextDraft.config),
  });
}

test("validateWorkflowDraftDocument accepts a minimal valid workflow draft", () => {
  const issues = validateWorkflowDraftDocument(createValidDraft());

  assert.deepEqual(issues, []);
});

test("validateWorkflowDraftDocument flags missing publish requirements", () => {
  const draft: WorkflowDraftDocument = {
    metadata: {
      name: "",
      description: "",
      category: "",
      tags: [],
    },
    config: {
      trigger: null,
      conditions: [],
      actions: [],
    },
    canvas: {
      nodes: [],
      edges: [],
    },
  };

  const codes = new Set(
    validateWorkflowDraftDocument(draft).map((issue) => issue.code),
  );

  assert.equal(codes.has("missing_name"), true);
  assert.equal(codes.has("missing_category"), true);
  assert.equal(codes.has("missing_trigger"), true);
  assert.equal(codes.has("missing_actions"), true);
});

test("validateWorkflowDraftDocument rejects invalid trigger and action configuration", () => {
  const draft = createEmptyWorkflowDraftDocument({
    name: "Billing escalation",
    category: "Finance",
    triggerType: "internal_event",
  });
  const updateRecord = createWorkflowActionDefinition("update_record_field");
  updateRecord.label = "Update case";
  updateRecord.config = {
    recordType: "case",
    recordKey: "payload.caseId",
    field: "status }",
    valueType: "string",
    valueTemplate: "closed",
  };
  const emailAction = createWorkflowActionDefinition("send_email");
  emailAction.label = "Notify finance";
  emailAction.config = {
    to: "not-an-email",
    subject: "Escalation",
    body: "Please investigate",
    replyTo: "",
  };

  const invalidDraft = syncWorkflowDraftCanvas({
    ...draft,
    config: {
      ...draft.config,
      trigger: draft.config.trigger
        ? {
            ...draft.config.trigger,
            config: {
              eventKey: "invoice.created",
            },
          }
        : null,
      actions: [updateRecord, emailAction],
    },
  });

  const codes = new Set(
    validateWorkflowDraftDocument(invalidDraft).map((issue) => issue.code),
  );

  assert.equal(codes.has("invalid_internal_event_key"), true);
  assert.equal(codes.has("unsafe_update_record_field"), true);
  assert.equal(codes.has("invalid_send_email_to"), true);
});

test("validateWorkflowDraftDocument flags broken graph shapes including cycles", () => {
  const draft = createValidDraft();
  const triggerId = draft.config.trigger?.id ?? "trigger-missing";
  const actionId = draft.config.actions[0]?.id ?? "action-missing";

  const invalidDraft: WorkflowDraftDocument = {
    ...draft,
    canvas: {
      nodes: [
        ...draft.canvas.nodes,
        {
          id: "orphan-node",
          type: "action",
          label: "Orphan node",
          description: "",
          position: { x: 900, y: 120 },
          config: {},
        },
      ],
      edges: [
        ...draft.canvas.edges,
        {
          id: "edge-cycle",
          source: actionId,
          target: triggerId,
          branchKey: null,
        },
        {
          id: "edge-dangling",
          source: triggerId,
          target: "missing-node",
          branchKey: null,
        },
      ],
    },
  };

  const codes = new Set(
    validateWorkflowDraftDocument(invalidDraft).map((issue) => issue.code),
  );

  assert.equal(codes.has("orphan_canvas_node"), true);
  assert.equal(codes.has("unreachable_node"), true);
  assert.equal(codes.has("dangling_edge"), true);
  assert.equal(codes.has("workflow_cycle_detected"), true);
});

test("validateWorkflowDraftDocument requires condition nodes to keep a single outgoing pass path", () => {
  const draft = createEmptyWorkflowDraftDocument({
    name: "Escalation router",
    category: "Support",
    triggerType: "manual",
  });
  const condition = createWorkflowConditionDefinition();
  condition.label = "Priority is high";
  condition.resolver.path = "ticket.priority";
  condition.value = "high";

  const conditionedDraft = syncWorkflowDraftCanvas({
    ...draft,
    config: {
      ...draft.config,
      conditions: [condition],
      actions: [createValidEmailAction()],
    },
  });

  conditionedDraft.canvas.edges = conditionedDraft.canvas.edges.filter(
    (edge) => edge.source !== condition.id,
  );

  const codes = new Set(
    validateWorkflowDraftDocument(conditionedDraft).map((issue) => issue.code),
  );

  assert.equal(codes.has("invalid_condition_outgoing_count"), true);
});
