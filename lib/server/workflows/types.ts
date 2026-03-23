import { normalizeLegacyConditionRecord } from "@/lib/server/conditions/legacy-normalizer";

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
  "internal_event",
] as const;

export const WORKFLOW_SUPPORTED_TRIGGER_TYPES = [
  "manual",
  "webhook",
  "internal_event",
] as const;

export const WORKFLOW_SUPPORTED_ACTION_TYPES = [
  "send_webhook",
  "send_email",
  "create_task",
  "update_record_field",
] as const;

export const WORKFLOW_ACTION_TYPES = [
  ...WORKFLOW_SUPPORTED_ACTION_TYPES,
  "legacy_custom",
] as const;

export const WORKFLOW_CONDITION_BRANCH_KEYS = [
  "true",
  "false",
] as const;

export const WORKFLOW_RECORD_VALUE_TYPES = [
  "string",
  "number",
  "boolean",
  "null",
  "json",
] as const;

export const WORKFLOW_CONDITION_RESOLVER_SCOPES = [
  "payload",
  "context",
] as const;

export const WORKFLOW_CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "greater_than",
  "less_than",
  "exists",
] as const;

export const WORKFLOW_RUN_STATUSES = [
  "pending",
  "running",
  "success",
  "failed",
  "retrying",
  "cancelled",
] as const;

export const INTERNAL_EVENT_KEYS = [
  "ticket.created",
  "payment.failed",
] as const;

export type WorkflowLifecycleStatus =
  (typeof WORKFLOW_LIFECYCLE_STATUSES)[number];
export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];
export type WorkflowTriggerType = (typeof WORKFLOW_TRIGGER_TYPES)[number];
export type SupportedWorkflowTriggerType =
  (typeof WORKFLOW_SUPPORTED_TRIGGER_TYPES)[number];
export type SupportedWorkflowActionType =
  (typeof WORKFLOW_SUPPORTED_ACTION_TYPES)[number];
export type WorkflowActionType =
  (typeof WORKFLOW_ACTION_TYPES)[number];
export type WorkflowConditionBranchKey =
  (typeof WORKFLOW_CONDITION_BRANCH_KEYS)[number];
export type WorkflowRecordValueType =
  (typeof WORKFLOW_RECORD_VALUE_TYPES)[number];
export type WorkflowConditionResolverScope =
  (typeof WORKFLOW_CONDITION_RESOLVER_SCOPES)[number];
export type WorkflowConditionOperator =
  (typeof WORKFLOW_CONDITION_OPERATORS)[number];
export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUSES)[number];
export type InternalEventKey = (typeof INTERNAL_EVENT_KEYS)[number];
export type ValidationSeverity = "error" | "warning";
export type WorkflowTriggerSource = SupportedWorkflowTriggerType;
export type WorkflowIngestionStatus =
  | "accepted"
  | "rejected"
  | "duplicate"
  | "rate_limited";
export type WorkflowConditionValue = string | number | boolean | null;

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

export type WorkflowConditionResolver = {
  scope: WorkflowConditionResolverScope;
  path: string;
};

export type WorkflowConditionConfig = {
  id: string;
  label: string;
  description: string;
  resolver: WorkflowConditionResolver;
  operator: WorkflowConditionOperator;
  value: WorkflowConditionValue;
  legacyExpression?: string | null;
  legacyIssue?: string | null;
};

export type WorkflowActionConfig = {
  id: string;
  label: string;
  description: string;
  type: WorkflowActionType;
  config: Record<string, unknown>;
  legacySourceType?: string | null;
  legacyIssue?: string | null;
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
  branchKey: WorkflowConditionBranchKey | null;
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

export type WorkflowSourceContext = {
  sourceLabel: string;
  eventKey?: InternalEventKey | null;
  requestPath?: string | null;
  requestMethod?: string | null;
  requestId?: string | null;
  requestIp?: string | null;
  requestUserAgent?: string | null;
  timestamp?: string | null;
  actorUserId?: string | null;
  deliveryId?: string | null;
  apiKeyVerified?: boolean | null;
  rawBody?: string | null;
};

export type WorkflowPendingRunSummary = {
  runId: string;
  workflowId: string;
  workflowName: string;
  workflowVersionNumber: number;
  triggerSource: WorkflowTriggerSource;
  status: WorkflowRunStatus;
  correlationId: string;
  createdAt: string;
  idempotencyKey: string | null;
};

export type WorkflowIngestionEventSummary = {
  eventId: string;
  workflowId: string;
  workflowName: string;
  workflowVersionNumber: number;
  sourceType: WorkflowTriggerSource;
  status: WorkflowIngestionStatus;
  eventKey: InternalEventKey | null;
  matchKey: string;
  idempotencyKey: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  payload: Record<string, unknown>;
  sourceContext: WorkflowSourceContext;
  requestIp: string | null;
  requestUserAgent: string | null;
  runId: string | null;
  createdAt: string;
};

export type WorkflowWebhookSecretState = {
  hasSecret: boolean;
  lastFour: string | null;
  endpointPath: string | null;
  endpointUrl: string | null;
  apiKeyRequired: boolean;
  secretRotatedAt: string | null;
  secretLastUsedAt: string | null;
};

export type WorkflowTriggerSummary = {
  bindingId: string | null;
  workflowId: string;
  workflowName: string;
  workflowStatus: WorkflowLifecycleStatus;
  workflowVersionNumber: number | null;
  sourceType: WorkflowTriggerType | null;
  label: string | null;
  description: string | null;
  matchKey: string | null;
  config: Record<string, unknown>;
  hasPublishedBinding: boolean;
  draftTrigger: WorkflowTriggerConfig | null;
  webhook: WorkflowWebhookSecretState | null;
};

export type WorkflowTriggerDetails = {
  workflowId: string;
  workflowName: string;
  workflowStatus: WorkflowLifecycleStatus;
  publishedVersionNumber: number | null;
  canTriggerManually: boolean;
  trigger: WorkflowTriggerSummary;
  recentAttempts: WorkflowIngestionEventSummary[];
};

export type WorkflowRunAttemptLaunchReason =
  | "initial"
  | "automatic_retry"
  | "manual_retry";

export type WorkflowRunAttemptStatus =
  | "scheduled"
  | "running"
  | "success"
  | "failed"
  | "cancelled";

export type WorkflowRunFailureSummary = {
  failureCode: string;
  count: number;
};

export type WorkflowRunListSummary = {
  total: number;
  pending: number;
  running: number;
  success: number;
  failed: number;
  retrying: number;
  cancelled: number;
  topFailureCodes: WorkflowRunFailureSummary[];
};

export type WorkflowRunSummary = {
  runId: string;
  workflowId: string;
  workflowName: string;
  workflowCategory: string;
  workflowStatus: string;
  workflowVersionNumber: number;
  triggerSource: WorkflowTriggerSource;
  status: WorkflowRunStatus;
  correlationId: string;
  attemptCount: number;
  maxAttempts: number;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  lastHeartbeatAt: string | null;
  nextRetryAt: string | null;
  lastRetryAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  idempotencyKey: string | null;
  retryEligible: boolean;
  cancelEligible: boolean;
};

export type WorkflowRunStepStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "cancelled"
  | "skipped";

export type WorkflowRunStepRecord = {
  stepId: string;
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  sequenceNumber: number;
  attemptNumber: number;
  branchTaken: WorkflowConditionBranchKey | null;
  status: WorkflowRunStepStatus;
  correlationId: string;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
  logs: Array<Record<string, unknown>>;
  startedAt: string | null;
  completedAt: string | null;
};

export type WorkflowRunAttemptRecord = {
  attemptNumber: number;
  launchReason: WorkflowRunAttemptLaunchReason;
  requestedBy: WorkflowActor | null;
  requestNote: string | null;
  scheduledFor: string | null;
  backoffSeconds: number | null;
  status: WorkflowRunAttemptStatus;
  failureCode: string | null;
  failureMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type WorkflowRunDetail = WorkflowRunSummary & {
  sourceContext: WorkflowSourceContext;
  payload: Record<string, unknown>;
  createdByEventId: string | null;
  cancelRequestedAt: string | null;
  attempts: WorkflowRunAttemptRecord[];
  versionValidationIssues: ValidationIssue[];
  recentEvent: {
    eventId: string;
    status: WorkflowIngestionStatus;
    eventKey: InternalEventKey | null;
    createdAt: string;
  } | null;
  steps: WorkflowRunStepRecord[];
  triggerActor: WorkflowActor | null;
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

function toStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, candidate]) => [key.trim(), toStringValue(candidate).trim()])
      .filter(([key]) => key.length > 0),
  );
}

function toNumberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildLegacyCustomAction(params: {
  action: Record<string, unknown>;
  rawConfig: Record<string, unknown>;
  issue: string;
  sourceType: string;
}): WorkflowActionConfig {
  const legacyOperation =
    toStringValue(params.action.operation) ||
    toStringValue(params.rawConfig.operation);
  const legacyTarget =
    toStringValue(params.action.target) || toStringValue(params.rawConfig.target);

  return {
    id: toStringValue(params.action.id) || createWorkflowEntityId("action"),
    label:
      toStringValue(params.action.label) ||
      getWorkflowActionTypeLabel("legacy_custom"),
    description: toStringValue(params.action.description),
    type: "legacy_custom",
    config: {
      operation: legacyOperation,
      target: legacyTarget,
      ...params.rawConfig,
    },
    legacySourceType: params.sourceType || null,
    legacyIssue: params.issue,
  } satisfies WorkflowActionConfig;
}

function buildLegacyNotifyEmailBody(params: {
  message: string;
  templateReference: string;
}): string {
  return [params.message.trim(), params.templateReference.trim()]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeSupportedWorkflowActionConfig(
  type: SupportedWorkflowActionType,
  rawConfig: Record<string, unknown>,
): Record<string, unknown> {
  switch (type) {
    case "send_webhook":
      return {
        ...createDefaultWorkflowActionConfig(type),
        ...rawConfig,
        url: toStringValue(rawConfig.url).trim(),
        method: toStringValue(rawConfig.method).trim() || "POST",
        headers: toStringMap(rawConfig.headers),
        body: toStringValue(rawConfig.body),
      };
    case "send_email":
      return {
        ...createDefaultWorkflowActionConfig(type),
        ...rawConfig,
        to: toStringValue(rawConfig.to).trim(),
        subject: toStringValue(rawConfig.subject),
        body: toStringValue(rawConfig.body),
        replyTo: toStringValue(rawConfig.replyTo).trim(),
      };
    case "create_task":
      return {
        ...createDefaultWorkflowActionConfig(type),
        ...rawConfig,
        title: toStringValue(rawConfig.title),
        description: toStringValue(rawConfig.description),
        assigneeEmail: toStringValue(rawConfig.assigneeEmail).trim(),
        dueAt: toStringValue(rawConfig.dueAt).trim(),
      };
    case "update_record_field":
    default:
      return {
        ...createDefaultWorkflowActionConfig(type),
        ...rawConfig,
        recordType: toStringValue(rawConfig.recordType).trim(),
        recordKey: toStringValue(rawConfig.recordKey).trim(),
        field: toStringValue(rawConfig.field).trim(),
        valueType:
          typeof rawConfig.valueType === "string" ? rawConfig.valueType : "string",
        valueTemplate: toStringValue(rawConfig.valueTemplate),
      };
  }
}

function normalizeWorkflowActionRecord(value: unknown): WorkflowActionConfig {
  const action = toRecord(value);
  const rawConfig = toRecord(action.config);
  const rawType = toStringValue(action.type).trim();
  const rawLabel = toStringValue(action.label);
  const rawDescription = toStringValue(action.description);
  const legacyOperation =
    toStringValue(action.operation) || toStringValue(rawConfig.operation);
  const legacyTarget =
    toStringValue(action.target) || toStringValue(rawConfig.target);

  if (isSupportedWorkflowActionType(rawType)) {
    return {
      id: toStringValue(action.id) || createWorkflowEntityId("action"),
      label: rawLabel || getWorkflowActionTypeLabel(rawType),
      description: rawDescription,
      type: rawType,
      config: normalizeSupportedWorkflowActionConfig(rawType, rawConfig),
      legacySourceType: null,
      legacyIssue: null,
    } satisfies WorkflowActionConfig;
  }

  if (rawType === "webhook_request") {
    return {
      id: toStringValue(action.id) || createWorkflowEntityId("action"),
      label: rawLabel || getWorkflowActionTypeLabel("send_webhook"),
      description: rawDescription,
      type: "send_webhook",
      config: normalizeSupportedWorkflowActionConfig("send_webhook", {
        url: rawConfig.url,
        method: rawConfig.method,
        headers: rawConfig.headers,
        body:
          typeof rawConfig.body === "string"
            ? rawConfig.body
            : rawConfig.payloadTemplate,
      }),
      legacySourceType: "webhook_request",
      legacyIssue: null,
    } satisfies WorkflowActionConfig;
  }

  if (rawType === "notify") {
    const channel =
      toStringValue(rawConfig.channel).trim() ||
      toStringValue(action.channel).trim() ||
      "email";

    if (channel === "email") {
      const recipient = toStringValue(rawConfig.recipient).trim();
      const templateReference = toStringValue(rawConfig.template);
      const message = toStringValue(rawConfig.message);
      const subject =
        rawLabel.trim() ||
        templateReference.trim() ||
        "Workflow notification";

      return {
        id: toStringValue(action.id) || createWorkflowEntityId("action"),
        label: rawLabel || getWorkflowActionTypeLabel("send_email"),
        description: rawDescription,
        type: "send_email",
        config: normalizeSupportedWorkflowActionConfig("send_email", {
          to: recipient,
          subject,
          body: buildLegacyNotifyEmailBody({
            message,
            templateReference: templateReference
              ? `Legacy template reference: ${templateReference}`
              : "",
          }),
        }),
        legacySourceType: "notify",
        legacyIssue: null,
      } satisfies WorkflowActionConfig;
    }

    return buildLegacyCustomAction({
      action,
      rawConfig,
      sourceType: "notify",
      issue:
        "Legacy notify actions using SMS or in-app delivery must be converted to Send email, Send webhook, Create task, or Update record before publishing.",
    });
  }

  if (rawType === "ticket_update") {
    return buildLegacyCustomAction({
      action,
      rawConfig,
      sourceType: "ticket_update",
      issue:
        "Legacy ticket update actions must be converted to Send webhook, Send email, Create task, or Update record before publishing.",
    });
  }

  if (rawType === "legacy_custom" || legacyOperation || legacyTarget || rawType) {
    return buildLegacyCustomAction({
      action,
      rawConfig,
      sourceType: rawType || "legacy_custom",
      issue:
        "This action came from an older workflow format and must be converted to a supported phase-six action before publishing.",
    });
  }

  return {
    id: toStringValue(action.id) || createWorkflowEntityId("action"),
    label: rawLabel || getWorkflowActionTypeLabel("send_email"),
    description: rawDescription,
    type: "send_email",
    config: createDefaultWorkflowActionConfig("send_email"),
    legacySourceType: null,
    legacyIssue: null,
  } satisfies WorkflowActionConfig;
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

export function createWorkflowRunPublicId(): string {
  const raw = createWorkflowEntityId("run")
    .replace(/^run-/, "")
    .split("-")[0]
    ?.toUpperCase();

  return `RUN-${raw ?? "0000"}`;
}

export function createWorkflowCorrelationId(): string {
  return createWorkflowEntityId("corr").replace(/^corr-/, "corr_");
}

export function isWorkflowActionType(value: unknown): value is WorkflowActionType {
  return (
    typeof value === "string" &&
    WORKFLOW_ACTION_TYPES.includes(value as WorkflowActionType)
  );
}

export function isSupportedWorkflowActionType(
  value: unknown,
): value is SupportedWorkflowActionType {
  return (
    typeof value === "string" &&
    WORKFLOW_SUPPORTED_ACTION_TYPES.includes(
      value as SupportedWorkflowActionType,
    )
  );
}

export function isWorkflowConditionBranchKey(
  value: unknown,
): value is WorkflowConditionBranchKey {
  return (
    typeof value === "string" &&
    WORKFLOW_CONDITION_BRANCH_KEYS.includes(
      value as WorkflowConditionBranchKey,
    )
  );
}

export function isWorkflowConditionResolverScope(
  value: unknown,
): value is WorkflowConditionResolverScope {
  return (
    typeof value === "string" &&
    WORKFLOW_CONDITION_RESOLVER_SCOPES.includes(
      value as WorkflowConditionResolverScope,
    )
  );
}

export function isWorkflowConditionOperator(
  value: unknown,
): value is WorkflowConditionOperator {
  return (
    typeof value === "string" &&
    WORKFLOW_CONDITION_OPERATORS.includes(value as WorkflowConditionOperator)
  );
}

export function getWorkflowConditionOperatorLabel(
  operator: WorkflowConditionOperator,
): string {
  switch (operator) {
    case "equals":
      return "Equals";
    case "not_equals":
      return "Not equals";
    case "contains":
      return "Contains";
    case "greater_than":
      return "Greater than";
    case "less_than":
      return "Less than";
    case "exists":
    default:
      return "Exists";
  }
}

export function getWorkflowActionTypeLabel(type: WorkflowActionType): string {
  switch (type) {
    case "send_webhook":
      return "Send webhook";
    case "send_email":
      return "Send email";
    case "create_task":
      return "Create task";
    case "update_record_field":
      return "Update record field";
    case "legacy_custom":
    default:
      return "Legacy custom";
  }
}

export function createDefaultWorkflowActionConfig(
  type: SupportedWorkflowActionType,
): Record<string, unknown> {
  switch (type) {
    case "send_webhook":
      return {
        url: "",
        method: "POST",
        headers: {},
        body: "",
      };
    case "send_email":
      return {
        to: "",
        subject: "",
        body: "",
        replyTo: "",
      };
    case "create_task":
      return {
        title: "",
        description: "",
        assigneeEmail: "",
        dueAt: "",
      };
    case "update_record_field":
    default:
      return {
        recordType: "",
        recordKey: "",
        field: "status",
        valueType: "string",
        valueTemplate: "",
      };
  }
}

export function createWorkflowActionDefinition(
  type: SupportedWorkflowActionType = "send_email",
): WorkflowActionConfig {
  return {
    id: createWorkflowEntityId("action"),
    type,
    label: getWorkflowActionTypeLabel(type),
    description: "",
    config: createDefaultWorkflowActionConfig(type),
    legacySourceType: null,
    legacyIssue: null,
  };
}

export function createWorkflowConditionDefinition(): WorkflowConditionConfig {
  return {
    id: createWorkflowEntityId("condition"),
    label: "New condition",
    description: "",
    resolver: {
      scope: "payload",
      path: "",
    },
    operator: "equals",
    value: "",
    legacyExpression: null,
    legacyIssue: null,
  };
}

export function createWorkflowEdgeId(
  source: string,
  target: string,
  branchKey: WorkflowConditionBranchKey | null = null,
): string {
  return branchKey
    ? `edge-${source}-${branchKey}-${target}`
    : `edge-${source}-${target}`;
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
        resolverScope: condition.resolver.scope,
        resolverPath: condition.resolver.path,
        operator: condition.operator,
        value: condition.value,
        legacyIssue: condition.legacyIssue ?? null,
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
        actionType: action.type,
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
              : triggerType === "internal_event"
                ? "Internal event trigger"
              : "Manual trigger",
        description: "",
        config:
          triggerType === "schedule"
            ? { cron: "" }
            : triggerType === "webhook"
              ? { method: "POST", path: "" }
              : triggerType === "internal_event"
                ? { eventKey: "ticket.created" }
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

  const edges: WorkflowCanvasEdge[] = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const sourceNode = nodes[index];
    const targetNode = nodes[index + 1];
    if (sourceNode.type === "action") {
      continue;
    }

    edges.push({
      id: createWorkflowEdgeId(sourceNode.id, targetNode.id, null),
      source: sourceNode.id,
      target: targetNode.id,
      branchKey: null,
    });
  }

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
  const nodeTypeById = new Map(nodes.map((node) => [node.id, node.type]));
  const seenEdges = new Set<string>();
  const conditionPassTargets = new Map<string, string>();
  const edges = document.canvas.edges
    .map((edge) => {
      const source = edge.source;
      const target = edge.target;
      const sourceType = nodeTypeById.get(source);
      const normalizedBranchKey =
        sourceType === "condition" && edge.branchKey === "true" ? null : null;

      return {
        id:
          edge.id?.trim() ||
          createWorkflowEdgeId(source, target, normalizedBranchKey),
        source,
        target,
        branchKey: normalizedBranchKey,
        sourceType,
        originalBranchKey: edge.branchKey ?? null,
      };
    })
    .filter((edge) => {
      if (
        !validNodeIds.has(edge.source) ||
        !validNodeIds.has(edge.target) ||
        edge.source === edge.target
      ) {
        return false;
      }

      if (
        edge.sourceType === "condition" &&
        edge.originalBranchKey === "false"
      ) {
        return false;
      }

      if (edge.sourceType === "condition") {
        if (conditionPassTargets.has(edge.source)) {
          return false;
        }

        conditionPassTargets.set(edge.source, edge.target);
      }

      const key = `${edge.source}:${edge.branchKey ?? "default"}->${edge.target}`;
      if (seenEdges.has(key)) {
        return false;
      }

      seenEdges.add(key);
      return true;
    })
    .map((edge) => {
      const { sourceType, originalBranchKey, ...normalizedEdge } = edge;
      void sourceType;
      void originalBranchKey;
      return normalizedEdge;
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
            return normalizeLegacyConditionRecord({
              ...condition,
              id:
                toStringValue(condition.id) ||
                createWorkflowEntityId("condition"),
            });
          })
        : [],
      actions: Array.isArray(config.actions)
        ? config.actions.map((candidate) =>
            normalizeWorkflowActionRecord(candidate),
          )
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
                  isWorkflowConditionBranchKey(edge.branchKey)
                    ? edge.branchKey
                    : null,
                ),
              source: toStringValue(edge.source),
              target: toStringValue(edge.target),
              branchKey: isWorkflowConditionBranchKey(edge.branchKey)
                ? edge.branchKey
                : null,
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

export function isInternalEventKey(value: unknown): value is InternalEventKey {
  return (
    typeof value === "string" &&
    INTERNAL_EVENT_KEYS.includes(value as InternalEventKey)
  );
}

export function isSupportedWorkflowTriggerType(
  value: unknown,
): value is SupportedWorkflowTriggerType {
  return (
    typeof value === "string" &&
    WORKFLOW_SUPPORTED_TRIGGER_TYPES.includes(
      value as SupportedWorkflowTriggerType,
    )
  );
}
