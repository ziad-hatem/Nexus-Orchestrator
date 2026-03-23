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
import {
  hasRuntimeTemplateTokens,
  isIsoDateLike,
  isSafeWorkflowRecordFieldKey,
  normalizeEmail,
  normalizeWebhookPath,
} from "@/lib/server/validation";
import { validateTemplateString } from "@/lib/server/actions/templating";

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

function pushTemplateIssues(params: {
  issues: ValidationIssue[];
  actionId: string;
  path: string;
  code: string;
  value: string;
  invalidMessage: string;
}): void {
  const issues = validateTemplateString(params.value);
  for (const issue of issues) {
    pushIssue(params.issues, {
      path: `config.actions.${params.actionId}.${params.path}`,
      code: params.code,
      message: params.invalidMessage || issue.message,
      severity: "error",
    });
  }
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

  if (action.type === "legacy_custom" || action.legacyIssue) {
    pushIssue(issues, {
      path: `config.actions.${action.id}.type`,
      code: "legacy_action_type",
      message:
        action.legacyIssue ??
        "Legacy actions must be converted to Send webhook, Send email, Create task, or Update record before publishing.",
      severity: "error",
    });
    return;
  }

  switch (action.type) {
    case "send_webhook": {
      const url = toStringValue(config.url);
      const method = toStringValue(config.method) || "POST";
      const headers =
        config.headers && typeof config.headers === "object" && !Array.isArray(config.headers)
          ? (config.headers as Record<string, unknown>)
          : {};
      const body = typeof config.body === "string" ? config.body : "";

      if (!url) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.url`,
          code: "missing_send_webhook_url",
          message: "Send webhook actions require a destination URL.",
          severity: "error",
        });
      } else {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.url",
          code: "invalid_send_webhook_url_template",
          value: url,
          invalidMessage:
            "Webhook URL templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });

        if (!hasRuntimeTemplateTokens(url)) {
          try {
            new URL(url);
          } catch {
            pushIssue(issues, {
              path: `config.actions.${action.id}.config.url`,
              code: "invalid_send_webhook_url",
              message: "Send webhook actions must use a valid absolute URL.",
              severity: "error",
            });
          }
        }
      }

      if (!["POST", "PUT", "PATCH"].includes(method)) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.method`,
          code: "invalid_send_webhook_method",
          message: "Send webhook actions support POST, PUT, or PATCH.",
          severity: "error",
        });
      }

      for (const [headerName, headerValue] of Object.entries(headers)) {
        if (!headerName.trim()) {
          pushIssue(issues, {
            path: `config.actions.${action.id}.config.headers`,
            code: "invalid_send_webhook_header_key",
            message: "Webhook header names cannot be empty.",
            severity: "error",
          });
          continue;
        }

        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: `config.headers.${headerName}`,
          code: "invalid_send_webhook_header_template",
          value: typeof headerValue === "string" ? headerValue : JSON.stringify(headerValue),
          invalidMessage:
            "Webhook header templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });
      }

      if (body) {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.body",
          code: "invalid_send_webhook_body_template",
          value: body,
          invalidMessage:
            "Webhook body templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });
      }

      break;
    }
    case "send_email": {
      const to = toStringValue(config.to);
      const subject = typeof config.subject === "string" ? config.subject : "";
      const body = typeof config.body === "string" ? config.body : "";
      const replyTo = toStringValue(config.replyTo);

      if (!to) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.to`,
          code: "missing_send_email_to",
          message: "Send email actions require a recipient address.",
          severity: "error",
        });
      } else {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.to",
          code: "invalid_send_email_to_template",
          value: to,
          invalidMessage:
            "Email recipient templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });

        if (!hasRuntimeTemplateTokens(to) && !normalizeEmail(to)) {
          pushIssue(issues, {
            path: `config.actions.${action.id}.config.to`,
            code: "invalid_send_email_to",
            message: "Send email actions must use a valid recipient email address.",
            severity: "error",
          });
        }
      }

      if (!subject.trim()) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.subject`,
          code: "missing_send_email_subject",
          message: "Send email actions require a subject.",
          severity: "error",
        });
      } else {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.subject",
          code: "invalid_send_email_subject_template",
          value: subject,
          invalidMessage:
            "Email subject templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });
      }

      if (!body.trim()) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.body`,
          code: "missing_send_email_body",
          message: "Send email actions require a body.",
          severity: "error",
        });
      } else {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.body",
          code: "invalid_send_email_body_template",
          value: body,
          invalidMessage:
            "Email body templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });
      }

      if (replyTo) {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.replyTo",
          code: "invalid_send_email_reply_to_template",
          value: replyTo,
          invalidMessage:
            "Reply-to templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });

        if (!hasRuntimeTemplateTokens(replyTo) && !normalizeEmail(replyTo)) {
          pushIssue(issues, {
            path: `config.actions.${action.id}.config.replyTo`,
            code: "invalid_send_email_reply_to",
            message: "Reply-to must be a valid email address when it is static.",
            severity: "error",
          });
        }
      }

      break;
    }
    case "create_task": {
      const title = typeof config.title === "string" ? config.title : "";
      const description = typeof config.description === "string" ? config.description : "";
      const assigneeEmail = toStringValue(config.assigneeEmail);
      const dueAt = toStringValue(config.dueAt);

      if (!title.trim()) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.title`,
          code: "missing_create_task_title",
          message: "Create task actions require a title.",
          severity: "error",
        });
      } else {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.title",
          code: "invalid_create_task_title_template",
          value: title,
          invalidMessage:
            "Task title templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });
      }

      if (description) {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.description",
          code: "invalid_create_task_description_template",
          value: description,
          invalidMessage:
            "Task description templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });
      }

      if (assigneeEmail) {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.assigneeEmail",
          code: "invalid_create_task_assignee_template",
          value: assigneeEmail,
          invalidMessage:
            "Task assignee templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });

        if (
          !hasRuntimeTemplateTokens(assigneeEmail) &&
          !normalizeEmail(assigneeEmail)
        ) {
          pushIssue(issues, {
            path: `config.actions.${action.id}.config.assigneeEmail`,
            code: "invalid_create_task_assignee",
            message: "Task assignee must be a valid email address when it is static.",
            severity: "error",
          });
        }
      }

      if (dueAt) {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.dueAt",
          code: "invalid_create_task_due_at_template",
          value: dueAt,
          invalidMessage:
            "Task due date templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });

        if (!hasRuntimeTemplateTokens(dueAt) && !isIsoDateLike(dueAt)) {
          pushIssue(issues, {
            path: `config.actions.${action.id}.config.dueAt`,
            code: "invalid_create_task_due_at",
            message: "Task due date must be a valid date or datetime when it is static.",
            severity: "error",
          });
        }
      }

      break;
    }
    case "update_record_field": {
      const recordType = typeof config.recordType === "string" ? config.recordType : "";
      const recordKey = typeof config.recordKey === "string" ? config.recordKey : "";
      const field = typeof config.field === "string" ? config.field : "";
      const valueType = toStringValue(config.valueType) || "string";
      const valueTemplate =
        typeof config.valueTemplate === "string" ? config.valueTemplate : "";

      if (!recordType.trim()) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.recordType`,
          code: "missing_update_record_type",
          message: "Update record actions require a record type.",
          severity: "error",
        });
      } else {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.recordType",
          code: "invalid_update_record_type_template",
          value: recordType,
          invalidMessage:
            "Record type templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });
      }

      if (!recordKey.trim()) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.recordKey`,
          code: "missing_update_record_key",
          message: "Update record actions require a record key.",
          severity: "error",
        });
      } else {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.recordKey",
          code: "invalid_update_record_key_template",
          value: recordKey,
          invalidMessage:
            "Record key templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });
      }

      if (!field.trim()) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.field`,
          code: "missing_update_record_field",
          message: "Update record actions require a field name.",
          severity: "error",
        });
      } else {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.field",
          code: "invalid_update_record_field_template",
          value: field,
          invalidMessage:
            "Record field keys must stay static safe identifiers and may not use templating.",
        });

        if (hasRuntimeTemplateTokens(field) || !isSafeWorkflowRecordFieldKey(field)) {
          pushIssue(issues, {
            path: `config.actions.${action.id}.config.field`,
            code: "unsafe_update_record_field",
            message:
              "Update record actions must use a static safe field key containing only letters, numbers, underscores, or dashes.",
            severity: "error",
          });
        }
      }

      if (!["string", "number", "boolean", "null", "json"].includes(valueType)) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.valueType`,
          code: "invalid_update_record_value_type",
          message: "Update record actions must use a supported value type.",
          severity: "error",
        });
      }

      if (valueType !== "null" && !valueTemplate.trim()) {
        pushIssue(issues, {
          path: `config.actions.${action.id}.config.valueTemplate`,
          code: "missing_update_record_value_template",
          message: "Update record actions require a value template unless the type is null.",
          severity: "error",
        });
      }

      if (valueTemplate) {
        pushTemplateIssues({
          issues,
          actionId: action.id,
          path: "config.valueTemplate",
          code: "invalid_update_record_value_template",
          value: valueTemplate,
          invalidMessage:
            "Record value templates may only use {{ payload.* }} and {{ context.* }} tokens.",
        });

        if (!hasRuntimeTemplateTokens(valueTemplate) && valueType === "json") {
          try {
            JSON.parse(valueTemplate);
          } catch {
            pushIssue(issues, {
              path: `config.actions.${action.id}.config.valueTemplate`,
              code: "invalid_update_record_json_value",
              message:
                "JSON record values must be valid JSON when the template is static.",
              severity: "error",
            });
          }
        }
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
