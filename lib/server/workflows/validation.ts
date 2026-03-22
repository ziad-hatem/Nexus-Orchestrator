import {
  type ValidationIssue,
  type WorkflowDraftDocument,
} from "@/lib/server/workflows/types";

function pushIssue(
  issues: ValidationIssue[],
  issue: ValidationIssue,
): void {
  issues.push(issue);
}

export function validateWorkflowDraftDocument(
  draft: WorkflowDraftDocument,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const expectedNodeTypes = new Map<string, WorkflowDraftDocument["canvas"]["nodes"][number]["type"]>();

  if (!draft.metadata.name.trim()) {
    pushIssue(issues, {
      path: "metadata.name",
      code: "missing_name",
      message: "Workflow name is required before publishing.",
      severity: "error",
    });
  }

  if (!draft.metadata.category.trim()) {
    pushIssue(issues, {
      path: "metadata.category",
      code: "missing_category",
      message: "Workflow category is required before publishing.",
      severity: "error",
    });
  }

  if (!draft.config.trigger) {
    pushIssue(issues, {
      path: "config.trigger",
      code: "missing_trigger",
      message: "Exactly one trigger must be configured before publishing.",
      severity: "error",
    });
  } else {
    if (!draft.config.trigger.label.trim()) {
      pushIssue(issues, {
        path: "config.trigger.label",
        code: "missing_trigger_label",
        message: "Trigger label is required.",
        severity: "error",
      });
    }

    if (draft.config.trigger.type === "schedule") {
      const cron = String(draft.config.trigger.config.cron ?? "").trim();
      if (!cron) {
        pushIssue(issues, {
          path: "config.trigger.config.cron",
          code: "missing_schedule_cron",
          message: "Scheduled triggers must include a cron expression.",
          severity: "error",
        });
      }
    }

    if (draft.config.trigger.type === "webhook") {
      const path = String(draft.config.trigger.config.path ?? "").trim();
      if (!path) {
        pushIssue(issues, {
          path: "config.trigger.config.path",
          code: "missing_webhook_path",
          message: "Webhook triggers must include a request path.",
          severity: "error",
        });
      }
    }
  }

  draft.config.conditions.forEach((condition, index) => {
    expectedNodeTypes.set(condition.id, "condition");

    if (!condition.label.trim()) {
      pushIssue(issues, {
        path: `config.conditions.${index}.label`,
        code: "missing_condition_label",
        message: "Condition label is required.",
        severity: "error",
      });
    }

    if (!condition.expression.trim()) {
      pushIssue(issues, {
        path: `config.conditions.${index}.expression`,
        code: "missing_condition_expression",
        message: "Condition expression is required.",
        severity: "error",
      });
    }
  });

  if (draft.config.actions.length === 0) {
    pushIssue(issues, {
      path: "config.actions",
      code: "missing_actions",
      message: "At least one action must be configured before publishing.",
      severity: "error",
    });
  }

  draft.config.actions.forEach((action, index) => {
    expectedNodeTypes.set(action.id, "action");

    if (!action.label.trim()) {
      pushIssue(issues, {
        path: `config.actions.${index}.label`,
        code: "missing_action_label",
        message: "Action label is required.",
        severity: "error",
      });
    }

    if (!action.operation.trim()) {
      pushIssue(issues, {
        path: `config.actions.${index}.operation`,
        code: "missing_action_operation",
        message: "Action operation is required.",
        severity: "error",
      });
    }

    if (!action.target.trim()) {
      pushIssue(issues, {
        path: `config.actions.${index}.target`,
        code: "missing_action_target",
        message: "Action target is required.",
        severity: "error",
      });
    }
  });

  const nodeIds = new Set<string>();
  const triggerNodes = draft.canvas.nodes.filter((node) => node.type === "trigger");

  if (draft.config.trigger) {
    expectedNodeTypes.set(draft.config.trigger.id, "trigger");
  }

  draft.canvas.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      pushIssue(issues, {
        path: `canvas.nodes.${index}.id`,
        code: "duplicate_node_id",
        message: `Node "${node.id}" is duplicated in the canvas.`,
        severity: "error",
      });
      return;
    }

    nodeIds.add(node.id);

    const expectedType = expectedNodeTypes.get(node.id);
    if (!expectedType) {
      pushIssue(issues, {
        path: `canvas.nodes.${index}.id`,
        code: "orphan_canvas_node",
        message: `Node "${node.id}" does not map to a workflow trigger, condition, or action.`,
        severity: "error",
      });
      return;
    }

    if (node.type !== expectedType) {
      pushIssue(issues, {
        path: `canvas.nodes.${index}.type`,
        code: "mismatched_canvas_node_type",
        message: `Node "${node.id}" must be stored as a ${expectedType} node.`,
        severity: "error",
      });
    }
  });

  for (const [nodeId] of expectedNodeTypes) {
    if (!nodeIds.has(nodeId)) {
      pushIssue(issues, {
        path: "canvas.nodes",
        code: "missing_canvas_node",
        message: `Canvas node "${nodeId}" is missing from the saved graph.`,
        severity: "error",
      });
    }
  };

  if (draft.config.trigger && triggerNodes.length !== 1) {
    pushIssue(issues, {
      path: "canvas.nodes",
      code: "invalid_trigger_nodes",
      message: "Canvas must include exactly one trigger node.",
      severity: "error",
    });
  }

  const adjacency = new Map<string, string[]>();
  draft.canvas.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      pushIssue(issues, {
        path: `canvas.edges.${index}`,
        code: "dangling_edge",
        message: "Canvas edges must reference existing nodes.",
        severity: "error",
      });
      return;
    }

    const current = adjacency.get(edge.source) ?? [];
    current.push(edge.target);
    adjacency.set(edge.source, current);
  });

  if (triggerNodes.length === 1) {
    const visited = new Set<string>();
    const queue = [triggerNodes[0].id];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) {
        continue;
      }

      visited.add(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }

    if (visited.size !== nodeIds.size) {
      pushIssue(issues, {
        path: "canvas.edges",
        code: "disconnected_graph",
        message:
          "Every node must be reachable from the configured trigger before publishing.",
        severity: "error",
      });
    }
  }

  return issues;
}
