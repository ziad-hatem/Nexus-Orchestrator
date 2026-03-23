import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyWorkflowDraftDocument,
  createWorkflowActionDefinition,
  normalizeWorkflowDraftDocument,
  normalizeWorkflowTags,
  syncWorkflowDraftCanvas,
} from "@/lib/server/workflows/types";

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

test("createEmptyWorkflowDraftDocument trims metadata, normalizes tags, and seeds a trigger node", () => {
  const draft = createEmptyWorkflowDraftDocument({
    name: "  Incident triage  ",
    description: "  Route urgent tickets  ",
    category: "  Operations  ",
    tags: ["nexus", "nexus", " urgent ", "", "alerts"],
    triggerType: "webhook",
  });

  assert.equal(draft.metadata.name, "Incident triage");
  assert.equal(draft.metadata.description, "Route urgent tickets");
  assert.equal(draft.metadata.category, "Operations");
  assert.deepEqual(draft.metadata.tags, ["nexus", "urgent", "alerts"]);
  assert.equal(draft.config.trigger?.type, "webhook");
  assert.equal(draft.canvas.nodes[0]?.id, draft.config.trigger?.id);
  assert.equal(draft.canvas.edges.length, 0);
});

test("syncWorkflowDraftCanvas preserves positions and removes invalid edges", () => {
  const baseDraft = createEmptyWorkflowDraftDocument({
    name: "Ticket notifier",
    category: "Support",
    triggerType: "manual",
  });
  const draft = syncWorkflowDraftCanvas({
    ...baseDraft,
    config: {
      ...baseDraft.config,
      actions: [createValidEmailAction()],
    },
  });
  const [triggerNode, actionNode] = draft.canvas.nodes;

  const synced = syncWorkflowDraftCanvas({
    ...draft,
    canvas: {
      nodes: [
        { ...triggerNode, position: { x: 11, y: 22 } },
        { ...actionNode, position: { x: 33, y: 44 } },
      ],
      edges: [
        {
          id: "edge-valid",
          source: triggerNode.id,
          target: actionNode.id,
          branchKey: null,
        },
        {
          id: "edge-duplicate",
          source: triggerNode.id,
          target: actionNode.id,
          branchKey: null,
        },
        {
          id: "edge-self",
          source: actionNode.id,
          target: actionNode.id,
          branchKey: null,
        },
        {
          id: "edge-missing",
          source: actionNode.id,
          target: "missing-node",
          branchKey: null,
        },
      ],
    },
  });

  assert.deepEqual(
    synced.canvas.nodes.map((node) => node.position),
    [
      { x: 11, y: 22 },
      { x: 33, y: 44 },
    ],
  );
  assert.deepEqual(synced.canvas.edges, [
    {
      id: "edge-valid",
      source: triggerNode.id,
      target: actionNode.id,
      branchKey: null,
    },
  ]);
});

test("normalizeWorkflowDraftDocument converts legacy actions and syncs a usable canvas", () => {
  const normalized = normalizeWorkflowDraftDocument({
    metadata: {
      name: " Legacy notify workflow ",
      description: " Sends a notice ",
      category: " Support ",
      tags: ["support", "support", "nexus"],
    },
    config: {
      trigger: {
        id: "trigger-legacy",
        type: "manual",
        label: "Manual trigger",
        description: "",
        config: {},
      },
      conditions: [],
      actions: [
        {
          id: "action-legacy",
          type: "notify",
          config: {
            channel: "email",
            recipient: "nexus@example.com",
            message: "Legacy message",
          },
        },
      ],
    },
    canvas: {
      nodes: [],
      edges: [],
    },
  });

  assert.equal(normalized.metadata.name, "Legacy notify workflow");
  assert.deepEqual(normalized.metadata.tags, ["support", "nexus"]);
  assert.equal(normalized.config.actions[0]?.type, "send_email");
  assert.equal(normalized.config.actions[0]?.legacySourceType, "notify");
  assert.equal(normalized.config.actions[0]?.config.to, "nexus@example.com");
  assert.equal(normalized.canvas.nodes.length, 2);
  assert.equal(normalized.canvas.edges.length, 1);
});

test("normalizeWorkflowTags trims, de-duplicates, and caps workflow tags", () => {
  const tags = normalizeWorkflowTags([
    "nexus",
    " nexus ",
    "alerts",
    "finance",
    "security",
    "support",
    "legal",
    "qa",
    "eng",
    "sales",
    "cs",
    "design",
    "product",
    "overflow",
  ]);

  assert.equal(tags.length, 12);
  assert.deepEqual(tags.slice(0, 4), [
    "nexus",
    "alerts",
    "finance",
    "security",
  ]);
  assert.equal(tags.includes("overflow"), false);
});
