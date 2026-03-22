export const WORKFLOW_LIFECYCLE_STATUSES = [
  "draft_only",
  "published",
  "published_with_draft",
  "archived",
] as const;

export const WORKFLOW_NODE_TYPES = [
  "trigger",
  "condition",
  "action",
] as const;

export const WORKFLOW_TRIGGER_TYPES = [
  "schedule",
  "webhook",
  "manual",
] as const;

export type WorkflowLifecycleStatus =
  (typeof WORKFLOW_LIFECYCLE_STATUSES)[number];
export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];
export type WorkflowTriggerType = (typeof WORKFLOW_TRIGGER_TYPES)[number];
export type ValidationSeverity = "error" | "warning";

export type WorkflowMetadata = {
  name: string;
  description: string;
  category: string;
  tags: string[];
};

export type WorkflowTriggerConfig = {
  id: string;
  type: WorkflowTriggerType;
  label: string;
  description: string;
  config: Record<string, unknown>;
};

export type WorkflowConditionConfig = {
  id: string;
  label: string;
  description: string;
  expression: string;
  config: Record<string, unknown>;
};

export type WorkflowActionConfig = {
  id: string;
  label: string;
  description: string;
  operation: string;
  target: string;
  config: Record<string, unknown>;
};

export type WorkflowCanvasNode = {
  id: string;
  type: WorkflowNodeType;
  label: string;
  description: string;
  position: {
    x: number;
    y: number;
  };
  config: Record<string, unknown>;
};

export type WorkflowCanvasEdge = {
  id: string;
  source: string;
  target: string;
};

export type WorkflowCanvas = {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
};

export type WorkflowDraftConfig = {
  trigger: WorkflowTriggerConfig | null;
  conditions: WorkflowConditionConfig[];
  actions: WorkflowActionConfig[];
};

export type WorkflowDraftDocument = {
  metadata: WorkflowMetadata;
  config: WorkflowDraftConfig;
  canvas: WorkflowCanvas;
};

export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
  severity: ValidationSeverity;
};

export type WorkflowActor = {
  id: string;
  name: string | null;
  email: string | null;
};

export type WorkflowSummary = {
  workflowId: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  status: WorkflowLifecycleStatus;
  latestVersionNumber: number | null;
  hasDraft: boolean;
  lastModifiedAt: string;
  modifiedBy: WorkflowActor | null;
  archivedAt: string | null;
};

export type WorkflowPublishedSnapshot = {
  versionNumber: number;
  metadata: WorkflowMetadata;
  config: WorkflowDraftConfig;
  canvas: WorkflowCanvas;
  notes: string | null;
  validationIssues: ValidationIssue[];
  publishedAt: string;
  publishedBy: WorkflowActor | null;
};

export type WorkflowDraftState = {
  workflowId: string;
  workflowName: string;
  status: WorkflowLifecycleStatus;
  latestVersionNumber: number | null;
  draftId: string;
  draft: WorkflowDraftDocument;
  validationIssues: ValidationIssue[];
  updatedAt: string;
  updatedBy: WorkflowActor | null;
  isArchived: boolean;
};

export type WorkflowDetail = WorkflowSummary & {
  createdAt: string;
  createdBy: WorkflowActor | null;
  versionCount: number;
  draftUpdatedAt: string | null;
  draftUpdatedBy: WorkflowActor | null;
  validationIssues: ValidationIssue[];
  latestPublishedSnapshot: WorkflowPublishedSnapshot | null;
};

export type WorkflowVersionSummary = {
  workflowId: string;
  versionNumber: number;
  createdAt: string;
  publishedBy: WorkflowActor | null;
  notes: string | null;
  validationIssueCount: number;
  isCurrent: boolean;
};

type WorkflowCanvasNodeDescriptor = Omit<WorkflowCanvasNode, "position">;

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toNumberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeWorkflowTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((candidate) =>
          typeof candidate === "string" ? candidate.trim() : "",
        )
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

export function createWorkflowEntityId(prefix: string): string {
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto?.randomUUID === "function"
  ) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function createWorkflowPublicId(): string {
  const raw = createWorkflowEntityId("wfl")
    .replace(/^wfl-/, "")
    .split("-")[0]
    ?.toUpperCase();

  return `WFL-${raw ?? "0000"}`;
}

export function createWorkflowEdgeId(source: string, target: string): string {
  return `edge-${source}-${target}`;
}

function defaultNodePosition(
  nodeType: WorkflowNodeType,
  index: number,
): WorkflowCanvasNode["position"] {
  if (nodeType === "trigger") {
    return { x: 120, y: 220 };
  }

  const column = index % 3;
  const row = Math.floor(index / 3);

  if (nodeType === "condition") {
    return {
      x: 420 + column * 300,
      y: 90 + row * 220,
    };
  }

  return {
    x: 420 + column * 300,
    y: 340 + row * 220,
  };
}

function getWorkflowCanvasNodeDescriptors(
  config: WorkflowDraftConfig,
): WorkflowCanvasNodeDescriptor[] {
  const descriptors: WorkflowCanvasNodeDescriptor[] = [];

  if (config.trigger) {
    descriptors.push({
      id: config.trigger.id,
      type: "trigger",
      label: config.trigger.label,
      description: config.trigger.description,
      config: config.trigger.config,
    });
  }

  for (const condition of config.conditions) {
    descriptors.push({
      id: condition.id,
      type: "condition",
      label: condition.label,
      description: condition.description,
      config: {
        expression: condition.expression,
        ...condition.config,
      },
    });
  }

  for (const action of config.actions) {
    descriptors.push({
      id: action.id,
      type: "action",
      label: action.label,
      description: action.description,
      config: {
        operation: action.operation,
        target: action.target,
        ...action.config,
      },
    });
  }

  return descriptors;
}

export function createEmptyWorkflowDraftDocument(params?: {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  triggerType?: WorkflowTriggerType;
}): WorkflowDraftDocument {
  const triggerType = params?.triggerType ?? "manual";
  const triggerId = createWorkflowEntityId("trigger");
  const draft: WorkflowDraftDocument = {
    metadata: {
      name: params?.name?.trim() || "",
      description: params?.description?.trim() || "",
      category: params?.category?.trim() || "Operations",
      tags: normalizeWorkflowTags(params?.tags ?? []),
    },
    config: {
      trigger: {
        id: triggerId,
        type: triggerType,
        label:
          triggerType === "schedule"
            ? "Schedule trigger"
            : triggerType === "webhook"
              ? "Webhook trigger"
              : "Manual trigger",
        description: "",
        config:
          triggerType === "schedule"
            ? { cron: "" }
            : triggerType === "webhook"
              ? { method: "POST", path: "" }
              : {},
      },
      conditions: [],
      actions: [],
    },
    canvas: {
      nodes: [],
      edges: [],
    },
  };

  return syncWorkflowDraftCanvas(draft);
}

export function buildWorkflowCanvas(
  config: WorkflowDraftConfig,
): WorkflowCanvas {
  const descriptors = getWorkflowCanvasNodeDescriptors(config);
  const perTypeIndex: Record<WorkflowNodeType, number> = {
    trigger: 0,
    condition: 0,
    action: 0,
  };

  const nodes = descriptors.map((descriptor) => {
    const index = perTypeIndex[descriptor.type];
    perTypeIndex[descriptor.type] += 1;

    return {
      ...descriptor,
      position: defaultNodePosition(descriptor.type, index),
    } satisfies WorkflowCanvasNode;
  });

  const edges = nodes.slice(1).map((node, index) => ({
    id: createWorkflowEdgeId(nodes[index].id, node.id),
    source: nodes[index].id,
    target: node.id,
  }));

  return { nodes, edges };
}

export function syncWorkflowDraftCanvas(
  document: WorkflowDraftDocument,
): WorkflowDraftDocument {
  const desiredNodes = getWorkflowCanvasNodeDescriptors(document.config);
  const existingNodesById = new Map(
    document.canvas.nodes.map((node) => [node.id, node]),
  );
  const perTypeIndex: Record<WorkflowNodeType, number> = {
    trigger: 0,
    condition: 0,
    action: 0,
  };

  const nodes = desiredNodes.map((descriptor) => {
    const index = perTypeIndex[descriptor.type];
    perTypeIndex[descriptor.type] += 1;
    const existingNode = existingNodesById.get(descriptor.id);

    return {
      ...descriptor,
      position: existingNode
        ? {
            x: toNumberValue(existingNode.position?.x),
            y: toNumberValue(existingNode.position?.y),
          }
        : defaultNodePosition(descriptor.type, index),
    } satisfies WorkflowCanvasNode;
  });

  const validNodeIds = new Set(nodes.map((node) => node.id));
  const seenEdges = new Set<string>();
  const edges = document.canvas.edges
    .map((edge) => ({
      id: edge.id?.trim() || createWorkflowEdgeId(edge.source, edge.target),
      source: edge.source,
      target: edge.target,
    }))
    .filter((edge) => {
      if (
        !validNodeIds.has(edge.source) ||
        !validNodeIds.has(edge.target) ||
        edge.source === edge.target
      ) {
        return false;
      }

      const key = `${edge.source}->${edge.target}`;
      if (seenEdges.has(key)) {
        return false;
      }

      seenEdges.add(key);
      return true;
    });

  return {
    ...document,
    metadata: {
      ...document.metadata,
      name: document.metadata.name.trim(),
      description: document.metadata.description.trim(),
      category: document.metadata.category.trim(),
      tags: normalizeWorkflowTags(document.metadata.tags),
    },
    canvas: {
      nodes,
      edges,
    },
  };
}

export function normalizeWorkflowDraftDocument(
  value: unknown,
): WorkflowDraftDocument {
  const record = toRecord(value);
  const metadata = toRecord(record.metadata);
  const config = toRecord(record.config);
  const canvas = toRecord(record.canvas);
  const triggerRecord = config.trigger === null ? null : toRecord(config.trigger);

  const draft: WorkflowDraftDocument = {
    metadata: {
      name: toStringValue(metadata.name),
      description: toStringValue(metadata.description),
      category: toStringValue(metadata.category) || "Operations",
      tags: normalizeWorkflowTags(metadata.tags),
    },
    config: {
      trigger: triggerRecord
        ? {
            id: toStringValue(triggerRecord.id) || createWorkflowEntityId("trigger"),
            type:
              WORKFLOW_TRIGGER_TYPES.find(
                (candidate) => candidate === triggerRecord.type,
              ) ?? "manual",
            label: toStringValue(triggerRecord.label),
            description: toStringValue(triggerRecord.description),
            config: toRecord(triggerRecord.config),
          }
        : null,
      conditions: Array.isArray(config.conditions)
        ? config.conditions.map((candidate) => {
            const condition = toRecord(candidate);
            return {
              id:
                toStringValue(condition.id) ||
                createWorkflowEntityId("condition"),
              label: toStringValue(condition.label),
              description: toStringValue(condition.description),
              expression: toStringValue(condition.expression),
              config: toRecord(condition.config),
            } satisfies WorkflowConditionConfig;
          })
        : [],
      actions: Array.isArray(config.actions)
        ? config.actions.map((candidate) => {
            const action = toRecord(candidate);
            return {
              id: toStringValue(action.id) || createWorkflowEntityId("action"),
              label: toStringValue(action.label),
              description: toStringValue(action.description),
              operation: toStringValue(action.operation),
              target: toStringValue(action.target),
              config: toRecord(action.config),
            } satisfies WorkflowActionConfig;
          })
        : [],
    },
    canvas: {
      nodes: Array.isArray(canvas.nodes)
        ? canvas.nodes.map((candidate) => {
            const node = toRecord(candidate);
            const position = toRecord(node.position);

            return {
              id: toStringValue(node.id) || createWorkflowEntityId("node"),
              type:
                WORKFLOW_NODE_TYPES.find(
                  (workflowNodeType) => workflowNodeType === node.type,
                ) ?? "action",
              label: toStringValue(node.label),
              description: toStringValue(node.description),
              position: {
                x: toNumberValue(position.x),
                y: toNumberValue(position.y),
              },
              config: toRecord(node.config),
            } satisfies WorkflowCanvasNode;
          })
        : [],
      edges: Array.isArray(canvas.edges)
        ? canvas.edges.map((candidate) => {
            const edge = toRecord(candidate);
            return {
              id:
                toStringValue(edge.id) ||
                createWorkflowEdgeId(
                  toStringValue(edge.source),
                  toStringValue(edge.target),
                ),
              source: toStringValue(edge.source),
              target: toStringValue(edge.target),
            } satisfies WorkflowCanvasEdge;
          })
        : [],
    },
  };

  if (
    !draft.config.trigger &&
    draft.config.conditions.length === 0 &&
    draft.config.actions.length === 0
  ) {
    draft.config.trigger = {
      id: createWorkflowEntityId("trigger"),
      type: "manual",
      label: "Manual trigger",
      description: "",
      config: {},
    };
  }

  if (draft.canvas.nodes.length === 0 && draft.canvas.edges.length === 0) {
    draft.canvas = buildWorkflowCanvas(draft.config);
  }

  return syncWorkflowDraftCanvas(draft);
}

export function normalizeValidationIssues(value: unknown): ValidationIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((candidate) => {
      const issue = toRecord(candidate);
      if (!issue.message || !issue.path || !issue.code) {
        return null;
      }

      return {
        path: toStringValue(issue.path),
        code: toStringValue(issue.code),
        message: toStringValue(issue.message),
        severity: issue.severity === "warning" ? "warning" : "error",
      } satisfies ValidationIssue;
    })
    .filter((candidate): candidate is ValidationIssue => candidate !== null);
}

export function getWorkflowVersionLabel(versionNumber: number | null): string {
  return typeof versionNumber === "number" && versionNumber > 0
    ? `v${versionNumber}`
    : "No published version";
}
