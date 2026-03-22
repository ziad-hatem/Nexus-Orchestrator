import {
  isInternalEventKey,
  isWorkflowConditionOperator,
  isWorkflowConditionResolverScope,
  type ValidationIssue,
  type WorkflowActionConfig,
  type WorkflowConditionConfig,
  type WorkflowDraftDocument,
} from "@/lib/server/workflows/types";
import { isValidConditionResolverPath } from "@/lib/server/conditions/resolver";
import { normalizeWebhookPath } from "@/lib/server/validation";

function pushIssue(
  issues: ValidationIssue[],
  issue: ValidationIssue,
): void {
  issues.push(issue);
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validateActionConfig(
  action: WorkflowActionConfig,
  issues: ValidationIssue[],
): void {
  const config = toRecord(action.config);

  if (!action.label.trim()) {
    pushIssue(issues, {
      path: `config.actions.${action.id}.label`,
      code: "missing_action_label",
      message: "Action label is required.",
      severity: "error",
    });
  }

  if (action.type === "legacy_custom") {
    pushIssue(issues, {
      path: `config.actions.${action.id}.type`,
      code: "legacy_action_type",
      message:
        "Legacy actions must be converted to Notify, Webhook request, or Ticket update before publishing.",
      severity: "error",
    });
    return;
  }

  switch (action.type) {
    case "notify": {
      const channel = toStringValue(config.channel);
      const recipient = toStringValue(config.recipient);
      const template = toStringValue(config.template);
      const message = toStringValue(config.message);

      if (!["email", "sms", "in_app"].includes(channel)) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.channel`,
          code: "invalid_notify_channel",
          message: "Notify actions must use email, sms, or in_app.",
          severity: "error",
        });
      }

      if (!recipient) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.recipient`,
          code: "missing_notify_recipient",
          message: "Notify actions require a recipient.",
          severity: "error",
        });
      }

      if (!template && !message) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.message`,
          code: "missing_notify_content",
          message: "Notify actions require either a template or a message body.",
          severity: "error",
        });
      }

      break;
    }
    case "webhook_request": {
      const url = toStringValue(config.url);
      const method = toStringValue(config.method) || "POST";
      const payloadTemplate = toStringValue(config.payloadTemplate);

      if (!url) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.url`,
          code: "missing_webhook_request_url",
          message: "Webhook request actions require a destination URL.",
          severity: "error",
        });
      } else {
        try {
          new URL(url);
        } catch {
          pushIssue(issues, {
            path: `config.actions.${action.id}.config.url`,
            code: "invalid_webhook_request_url",
            message: "Webhook request actions must use a valid absolute URL.",
            severity: "error",
          });
        }
      }

      if (!["POST", "PUT", "PATCH"].includes(method)) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.method`,
          code: "invalid_webhook_request_method",
          message: "Webhook request actions support POST, PUT, or PATCH.",
          severity: "error",
        });
      }

      if (!payloadTemplate) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.payloadTemplate`,
          code: "missing_webhook_request_payload",
          message: "Webhook request actions require a payload template.",
          severity: "error",
        });
      }

      break;
    }
    case "ticket_update": {
      const field = toStringValue(config.field);
      const value = toStringValue(config.value);

      if (!["status", "priority", "assignee"].includes(field)) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.field`,
          code: "invalid_ticket_update_field",
          message: "Ticket update actions must change status, priority, or assignee.",
          severity: "error",
        });
      }

      if (!value) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.value`,
          code: "missing_ticket_update_value",
          message: "Ticket update actions require a target value.",
          severity: "error",
        });
      }

      break;
    }
    default:
      break;
  }
}

function validateConditionConfig(
  condition: WorkflowConditionConfig,
  issues: ValidationIssue[],
): void {
  if (!condition.label.trim()) {
    pushIssue(issues, {
      path: `config.conditions.${condition.id}.label`,
      code: "missing_condition_label",
      message: "Condition label is required.",
      severity: "error",
    });
  }

  if (condition.legacyIssue) {
    pushIssue(issues, {
      path: `config.conditions.${condition.id}.legacyExpression`,
      code: "legacy_condition_expression",
      message: condition.legacyIssue,
      severity: "error",
    });
  }

  if (!isWorkflowConditionResolverScope(condition.resolver.scope)) {
    pushIssue(issues, {
      path: `config.conditions.${condition.id}.resolver.scope`,
      code: "invalid_condition_scope",
      message: "Conditions must resolve from payload or context.",
      severity: "error",
    });
  }

  if (!condition.resolver.path.trim()) {
    pushIssue(issues, {
      path: `config.conditions.${condition.id}.resolver.path`,
      code: "missing_condition_resolver_path",
      message: "Condition field path is required.",
      severity: "error",
    });
  } else if (!isValidConditionResolverPath(condition.resolver.path)) {
    pushIssue(issues, {
      path: `config.conditions.${condition.id}.resolver.path`,
      code: "invalid_condition_resolver_path",
      message:
        "Condition field paths may only use letters, numbers, dots, dashes, and underscores.",
      severity: "error",
    });
  }

  if (!isWorkflowConditionOperator(condition.operator)) {
    pushIssue(issues, {
      path: `config.conditions.${condition.id}.operator`,
      code: "invalid_condition_operator",
      message: "Condition operator is not supported.",
      severity: "error",
    });
    return;
  }

  if (
    (condition.operator === "greater_than" ||
      condition.operator === "less_than") &&
    typeof condition.value !== "number"
  ) {
    pushIssue(issues, {
      path: `config.conditions.${condition.id}.value`,
      code: "invalid_condition_numeric_value",
      message:
        "Greater than and less than conditions require a numeric comparison value.",
      severity: "error",
    });
  }
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
        path: `config.trigger.${draft.config.trigger.id}.label`,
        code: "missing_trigger_label",
        message: "Trigger label is required.",
        severity: "error",
      });
    }

    if (draft.config.trigger.type === "schedule") {
      pushIssue(issues, {
        path: `config.trigger.${draft.config.trigger.id}.type`,
        code: "legacy_schedule_trigger",
        message:
          "Scheduled triggers are legacy-only. Choose manual, webhook, or internal event before publishing.",
        severity: "error",
      });
    }

    if (draft.config.trigger.type === "webhook") {
      const path = normalizeWebhookPath(
        String(draft.config.trigger.config.path ?? ""),
      );
      if (!path) {
        pushIssue(issues, {
          path: `config.trigger.${draft.config.trigger.id}.config.path`,
          code: "missing_webhook_path",
          message: "Webhook triggers must include a request path.",
          severity: "error",
        });
      }

      const method = String(draft.config.trigger.config.method ?? "POST").trim();
      if (method !== "POST") {
        pushIssue(issues, {
          path: `config.trigger.${draft.config.trigger.id}.config.method`,
          code: "invalid_webhook_method",
          message: "Webhook triggers only support POST in this phase.",
          severity: "error",
        });
      }
    }

    if (draft.config.trigger.type === "internal_event") {
      const eventKey = draft.config.trigger.config.eventKey;
      if (!isInternalEventKey(eventKey)) {
        pushIssue(issues, {
          path: `config.trigger.${draft.config.trigger.id}.config.eventKey`,
          code: "invalid_internal_event_key",
          message:
            "Internal event triggers must subscribe to ticket.created or payment.failed.",
          severity: "error",
        });
      }
    }
  }

  draft.config.conditions.forEach((condition) => {
    expectedNodeTypes.set(condition.id, "condition");
    validateConditionConfig(condition, issues);
  });

  if (draft.config.actions.length === 0) {
    pushIssue(issues, {
      path: "config.actions",
      code: "missing_actions",
      message: "At least one action must be configured before publishing.",
      severity: "error",
    });
  }

  draft.config.actions.forEach((action) => {
    expectedNodeTypes.set(action.id, "action");
    validateActionConfig(action, issues);
  });

  const nodeIds = new Set<string>();
  const nodeMap = new Map(
    draft.canvas.nodes.map((node) => [node.id, node] as const),
  );
  const triggerNodes = draft.canvas.nodes.filter((node) => node.type === "trigger");

  if (draft.config.trigger) {
    expectedNodeTypes.set(draft.config.trigger.id, "trigger");
  }

  draft.canvas.nodes.forEach((node) => {
    if (nodeIds.has(node.id)) {
      pushIssue(issues, {
        path: `canvas.nodes.${node.id}.id`,
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
        path: `canvas.nodes.${node.id}`,
        code: "orphan_canvas_node",
        message: `Node "${node.id}" does not map to a workflow trigger, condition, or action.`,
        severity: "error",
      });
      return;
    }

    if (node.type !== expectedType) {
      pushIssue(issues, {
        path: `canvas.nodes.${node.id}.type`,
        code: "mismatched_canvas_node_type",
        message: `Node "${node.id}" must be stored as a ${expectedType} node.`,
        severity: "error",
      });
    }
  });

  for (const [nodeId] of expectedNodeTypes) {
    if (!nodeIds.has(nodeId)) {
      pushIssue(issues, {
        path: `canvas.nodes.${nodeId}`,
        code: "missing_canvas_node",
        message: `Canvas node "${nodeId}" is missing from the saved graph.`,
        severity: "error",
      });
    }
  }

  if (draft.config.trigger && triggerNodes.length !== 1) {
    pushIssue(issues, {
      path: `canvas.nodes.${draft.config.trigger.id}`,
      code: "invalid_trigger_nodes",
      message: "Canvas must include exactly one trigger node.",
      severity: "error",
    });
  }

  const adjacency = new Map<string, string[]>();
  const incomingCounts = new Map<string, number>();
  const outgoingCounts = new Map<string, number>();
  draft.canvas.edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      pushIssue(issues, {
        path: `canvas.edges.${edge.id}`,
        code: "dangling_edge",
        message: "Canvas edges must reference existing nodes.",
        severity: "error",
      });
      return;
    }

    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) {
      return;
    }

    if (sourceNode.type === "action") {
      pushIssue(issues, {
        path: `canvas.edges.${edge.id}`,
        code: "action_outgoing_edge",
        message: "Action nodes must be terminal in this phase.",
        severity: "error",
      });
    }

    if (targetNode.type === "trigger") {
      pushIssue(issues, {
        path: `canvas.edges.${edge.id}`,
        code: "trigger_incoming_edge",
        message: "Trigger nodes cannot receive incoming edges.",
        severity: "error",
      });
    }

    if (edge.branchKey !== null) {
      pushIssue(issues, {
        path: `canvas.edges.${edge.id}.branchKey`,
        code: "legacy_condition_branch_key",
        message:
          "Condition branch labels are legacy-only. Reconnect this condition as a single pass path.",
        severity: "error",
      });
    }

    const current = adjacency.get(edge.source) ?? [];
    current.push(edge.target);
    adjacency.set(edge.source, current);
    incomingCounts.set(edge.target, (incomingCounts.get(edge.target) ?? 0) + 1);
    outgoingCounts.set(edge.source, (outgoingCounts.get(edge.source) ?? 0) + 1);
  });

  if (triggerNodes.length === 1) {
    const triggerNode = triggerNodes[0];
    if ((outgoingCounts.get(triggerNode.id) ?? 0) === 0) {
      pushIssue(issues, {
        path: `canvas.nodes.${triggerNode.id}.outgoing`,
        code: "missing_trigger_outgoing_edge",
        message: "The trigger must connect to at least one downstream node.",
        severity: "error",
      });
    }
    if ((outgoingCounts.get(triggerNode.id) ?? 0) > 1) {
      pushIssue(issues, {
        path: `canvas.nodes.${triggerNode.id}.outgoing`,
        code: "invalid_trigger_outgoing_count",
        message:
          "Trigger nodes must connect exactly one downstream path in this phase.",
        severity: "error",
      });
    }
  }

  for (const condition of draft.config.conditions) {
    const outgoingEdges = draft.canvas.edges.filter(
      (edge) => edge.source === condition.id,
    );

    if (outgoingEdges.length !== 1) {
      pushIssue(issues, {
        path: `canvas.nodes.${condition.id}.outgoing`,
        code: "invalid_condition_outgoing_count",
        message: "Condition nodes must connect exactly one pass path.",
        severity: "error",
      });
    }
  }

  for (const action of draft.config.actions) {
    if ((outgoingCounts.get(action.id) ?? 0) > 0) {
      pushIssue(issues, {
        path: `canvas.nodes.${action.id}.outgoing`,
        code: "action_must_be_terminal",
        message: "Action nodes cannot connect to downstream nodes in this phase.",
        severity: "error",
      });
    }
  }

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

    for (const nodeId of nodeIds) {
      if (visited.has(nodeId)) {
        continue;
      }

      pushIssue(issues, {
        path: `canvas.nodes.${nodeId}.reachability`,
        code: "unreachable_node",
        message: `Node "${nodeId}" must be reachable from the configured trigger.`,
        severity: "error",
      });
    }

    for (const nodeId of nodeIds) {
      const node = nodeMap.get(nodeId);
      if (!node || node.type === "trigger") {
        continue;
      }

      if ((incomingCounts.get(nodeId) ?? 0) === 0) {
        pushIssue(issues, {
          path: `canvas.nodes.${nodeId}.incoming`,
          code: "missing_incoming_edge",
          message: `Node "${nodeId}" must have an incoming connection.`,
          severity: "error",
        });
      }
    }
  }

  return issues;
}
