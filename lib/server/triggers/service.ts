import "server-only";

import { writeAuditLog } from "@/lib/server/audit-log";
import { getOptionalEnv } from "@/lib/env";
import {
  createWorkflowIngestionEventRow,
  createWorkflowRunRow,
  createTriggerBindingRow,
  deactivateTriggerBindingsForWorkflow,
  getActiveTriggerBindingByWorkflowDbId,
  listWorkflowIngestionEventsByOrganization,
  listWorkflowIngestionEventsByWorkflowDbId,
  listWorkflowRowsByIds,
  listWorkflowVersionRowsByIds,
  markTriggerBindingSecretUsed,
  updateTriggerBindingSecret,
  updateWorkflowRunCreatedByEvent,
  updateWorkflowRunEventLink,
} from "@/lib/server/triggers/repository";
import type {
  StreamFilters,
  TriggerAttemptFilters,
  TriggerBindingRow,
  WorkflowIngestionEventRow,
} from "@/lib/server/triggers/types";
import {
  buildInternalEventIdempotencyKey,
  buildInternalEventRateLimitKey,
  buildManualIdempotencyKey,
  buildManualRateLimitKey,
  buildWebhookIdempotencyKey,
  buildWebhookRateLimitKey,
  enforceRateLimit,
  incrementWindowCounter,
  reserveIdempotencyKey,
} from "@/lib/server/triggers/rate-limit";
import {
  createWebhookSecret,
  verifyWebhookApiKey,
} from "@/lib/server/triggers/security";
import {
  emitOperationalAlert,
  evaluateOperationalAlerts,
  getOperationsAlertLookbackMinutes,
} from "@/lib/observability/alerts";
import { createChildLogger, writeLog } from "@/lib/observability/logger";
import {
  matchInternalEventBindings,
  matchWebhookTriggerBinding,
} from "@/lib/server/triggers/matcher";
import {
  getWorkflowDraftRowByWorkflowDbId,
  getWorkflowRowByPublicId,
  getWorkflowVersionRow,
  isDuplicateConstraintError,
  type WorkflowRow,
  type WorkflowVersionRow,
} from "@/lib/server/workflows/repository";
import {
  getExecutionMaxRetries,
} from "@/lib/server/executions/queue";
import { createWorkflowRunAttemptRow } from "@/lib/server/executions/repository";
import {
  enqueueWorkflowRunForExecution,
} from "@/lib/server/executions/service";
import {
  normalizeWorkflowDraftDocument,
  createWorkflowCorrelationId,
  createWorkflowRunPublicId,
  type InternalEventKey,
  type WorkflowIngestionEventSummary,
  type WorkflowPendingRunSummary,
  type WorkflowSourceContext,
  type WorkflowTriggerConfig,
  type WorkflowTriggerDetails,
  type WorkflowTriggerSummary,
  type WorkflowTriggerType,
} from "@/lib/server/workflows/types";
import { normalizeWebhookPath } from "@/lib/server/validation";

const MANUAL_RATE_LIMIT_WINDOW_SECONDS = 60;
const MANUAL_RATE_LIMIT_MAX_REQUESTS = 20;
const WEBHOOK_RATE_LIMIT_WINDOW_SECONDS = 60;
const WEBHOOK_RATE_LIMIT_MAX_REQUESTS = 60;
const INTERNAL_EVENT_RATE_LIMIT_WINDOW_SECONDS = 60;
const INTERNAL_EVENT_RATE_LIMIT_MAX_REQUESTS = 120;
const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;
const WEBHOOK_REJECTION_METRIC_PREFIX = "wf:metrics:webhook:rejected";
const WEBHOOK_RATE_LIMIT_METRIC_PREFIX = "wf:metrics:webhook:rate_limited";
const WEBHOOK_DUPLICATE_METRIC_PREFIX = "wf:metrics:webhook:duplicate";

export class WorkflowTriggerSecurityError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export class WorkflowTriggerDuplicateError extends Error {
  constructor(message = "This delivery was already processed.") {
    super(message);
  }
}

export class WorkflowTriggerRateLimitError extends Error {
  constructor(message = "Trigger request exceeded the current rate limit.") {
    super(message);
  }
}

export class WorkflowTriggerNotFoundError extends Error {
  constructor(message = "Workflow trigger was not found.") {
    super(message);
  }
}

export class WorkflowTriggerConflictError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function createTriggerLogger(context: Record<string, unknown>) {
  return createChildLogger({
    route: "server.triggers.service",
    ...context,
  });
}

function getWebhookMetricWindowSeconds(): number {
  return getOperationsAlertLookbackMinutes() * 60;
}

async function trackWebhookMetric(params: {
  binding: TriggerBindingRow;
  metric: "rejected" | "rate_limited" | "duplicate";
  reason?: string | null;
}) {
  const prefix =
    params.metric === "rejected"
      ? WEBHOOK_REJECTION_METRIC_PREFIX
      : params.metric === "rate_limited"
        ? WEBHOOK_RATE_LIMIT_METRIC_PREFIX
        : WEBHOOK_DUPLICATE_METRIC_PREFIX;
  const counter = await incrementWindowCounter({
    key: `${prefix}:${params.binding.organization_id}:${params.binding.id}`,
    windowSeconds: getWebhookMetricWindowSeconds(),
  });

  if (params.metric !== "rejected") {
    return counter.current;
  }

  const [alert] = evaluateOperationalAlerts({
    queueBacklog: 0,
    staleRunningCount: 0,
    recentWebhookRejections: counter.current,
    retryExhaustionCount: 0,
  }).filter((candidate) => candidate.key === "webhook_rejection_spike");

  if (alert && alert.status !== "ok") {
    emitOperationalAlert({
      alert,
      context: {
        organizationId: params.binding.organization_id,
        workflowId: params.binding.workflow_id,
        securityEvent: "webhook_rejection_spike",
      },
      extras: {
        bindingId: params.binding.id,
        reason: params.reason ?? null,
      },
    });
  }

  return counter.current;
}

function getPublicAppOrigin(): string | null {
  return getOptionalEnv("NEXT_PUBLIC_APP_URL") ?? getOptionalEnv("NEXTAUTH_URL");
}

function toAbsoluteAppUrl(pathname: string | null): string | null {
  if (!pathname) {
    return null;
  }

  const origin = getPublicAppOrigin();
  if (!origin) {
    return null;
  }

  return new URL(pathname, origin).toString();
}

function normalizeTriggerConfig(value: unknown): WorkflowTriggerConfig | null {
  const record = toRecord(value);
  if (!record.type || !record.id) {
    return null;
  }

  const trigger = normalizeWorkflowDraftDocument({
    metadata: {},
    config: {
      trigger: record,
      conditions: [],
      actions: [],
    },
    canvas: { nodes: [], edges: [] },
  }).config.trigger;

  return trigger ?? null;
}

function mapSourceContext(value: unknown): WorkflowSourceContext {
  const record = toRecord(value);
  return {
    sourceLabel:
      typeof record.sourceLabel === "string" ? record.sourceLabel : "unknown",
    eventKey:
      typeof record.eventKey === "string"
        ? (record.eventKey as InternalEventKey)
        : null,
    requestPath:
      typeof record.requestPath === "string" ? record.requestPath : null,
    requestMethod:
      typeof record.requestMethod === "string" ? record.requestMethod : null,
    requestId: typeof record.requestId === "string" ? record.requestId : null,
    requestIp: typeof record.requestIp === "string" ? record.requestIp : null,
    requestUserAgent:
      typeof record.requestUserAgent === "string"
        ? record.requestUserAgent
        : null,
    timestamp: typeof record.timestamp === "string" ? record.timestamp : null,
    actorUserId:
      typeof record.actorUserId === "string" ? record.actorUserId : null,
    deliveryId:
      typeof record.deliveryId === "string" ? record.deliveryId : null,
    apiKeyVerified:
      typeof record.apiKeyVerified === "boolean"
        ? record.apiKeyVerified
        : null,
    rawBody: typeof record.rawBody === "string" ? record.rawBody : null,
  };
}

function getMatchKeyForTrigger(params: {
  workflowKey: string;
  trigger: WorkflowTriggerConfig;
}): string {
  switch (params.trigger.type) {
    case "webhook":
      return normalizeWebhookPath(String(params.trigger.config.path ?? ""));
    case "internal_event":
      return String(params.trigger.config.eventKey ?? "").trim();
    case "manual":
      return `manual:${params.workflowKey}`;
    case "schedule":
    default:
      throw new WorkflowTriggerConflictError(
        "Scheduled triggers are not supported in phase three.",
      );
  }
}

function buildWebhookSecretState(
  binding: TriggerBindingRow | null,
  trigger: WorkflowTriggerConfig | null,
) {
  if ((binding?.source_type ?? trigger?.type) !== "webhook") {
    return null;
  }

  const bindingTrigger =
    (binding ? normalizeTriggerConfig(binding.config_snapshot) : null) ?? trigger;

  const endpointPath = normalizeWebhookPath(
    String(binding?.match_key ?? bindingTrigger?.config.path ?? ""),
  );

  return {
    hasSecret: Boolean(binding?.secret_hash),
    lastFour: binding?.secret_last_four ?? null,
    endpointPath,
    endpointUrl: toAbsoluteAppUrl(endpointPath),
    apiKeyRequired: true,
    secretRotatedAt: binding?.secret_rotated_at ?? null,
    secretLastUsedAt: binding?.secret_last_used_at ?? null,
  };
}

function buildTriggerSummary(params: {
  workflow: WorkflowRow;
  publishedVersionNumber: number | null;
  binding: TriggerBindingRow | null;
  publishedTrigger: WorkflowTriggerConfig | null;
  draftTrigger: WorkflowTriggerConfig | null;
}): WorkflowTriggerSummary {
  const activeTrigger = params.binding
    ? normalizeTriggerConfig(params.binding.config_snapshot)
    : params.publishedTrigger;

  return {
    bindingId: params.binding?.id ?? null,
    workflowId: params.workflow.workflow_key,
    workflowName: params.workflow.name,
    workflowStatus: params.workflow.status,
    workflowVersionNumber: params.publishedVersionNumber,
    sourceType: (params.binding?.source_type ?? activeTrigger?.type ?? null) as
      | WorkflowTriggerType
      | null,
    label: activeTrigger?.label ?? null,
    description: activeTrigger?.description ?? null,
    matchKey: params.binding?.match_key ?? null,
    config: activeTrigger?.config ?? {},
    hasPublishedBinding: Boolean(params.binding),
    draftTrigger: params.draftTrigger,
    webhook: buildWebhookSecretState(params.binding, activeTrigger),
  };
}

async function loadWorkflowTriggerState(params: {
  organizationId: string;
  workflowId: string;
}) {
  const workflow = await getWorkflowRowByPublicId({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  });

  if (!workflow) {
    throw new WorkflowTriggerNotFoundError();
  }

  const [binding, draftRow, version] = await Promise.all([
    getActiveTriggerBindingByWorkflowDbId(workflow.id),
    getWorkflowDraftRowByWorkflowDbId(workflow.id),
    workflow.latest_published_version_number
      ? getWorkflowVersionRow({
          workflowDbId: workflow.id,
          versionNumber: workflow.latest_published_version_number,
        })
      : Promise.resolve(null),
  ]);

  const publishedTrigger = version
    ? normalizeWorkflowDraftDocument({
        metadata: version.metadata,
        config: version.config,
        canvas: version.canvas,
      }).config.trigger
    : null;
  const draftTrigger = draftRow
    ? normalizeWorkflowDraftDocument({
        metadata: draftRow.metadata,
        config: draftRow.config,
        canvas: draftRow.canvas,
      }).config.trigger
    : null;

  return {
    workflow,
    binding,
    version,
    publishedTrigger,
    draftTrigger,
  };
}

async function mapIngestionEventsToSummaries(
  rows: WorkflowIngestionEventRow[],
): Promise<WorkflowIngestionEventSummary[]> {
  const [workflows, versions] = await Promise.all([
    listWorkflowRowsByIds(rows.map((row) => row.workflow_id)),
    listWorkflowVersionRowsByIds(rows.map((row) => row.workflow_version_id)),
  ]);
  const workflowMap = new Map(workflows.map((row) => [row.id, row]));
  const versionMap = new Map(versions.map((row) => [row.id, row]));

  return rows
    .map((row) => {
      const workflow = workflowMap.get(row.workflow_id);
      const version = versionMap.get(row.workflow_version_id);
      const sourceContext = mapSourceContext(row.source_context);

      if (!workflow || !version) {
        return null;
      }

      return {
        eventId: row.id,
        workflowId: workflow.workflow_key,
        workflowName: workflow.name,
        workflowVersionNumber: version.version_number,
        sourceType: row.source_type,
        status: row.status,
        eventKey: sourceContext.eventKey ?? null,
        matchKey: row.match_key,
        idempotencyKey: row.idempotency_key,
        errorCode: row.error_code,
        errorMessage: row.error_message,
        payload: toRecord(row.payload),
        sourceContext,
        requestIp: row.request_ip,
        requestUserAgent: row.request_user_agent,
        runId: row.run_id,
        createdAt: row.created_at,
      } satisfies WorkflowIngestionEventSummary;
    })
    .filter(
      (candidate): candidate is WorkflowIngestionEventSummary =>
        candidate !== null,
    );
}

async function createAcceptedIngestionWithRun(params: {
  binding: TriggerBindingRow;
  payload: Record<string, unknown>;
  sourceContext: WorkflowSourceContext;
  idempotencyKey?: string | null;
  requestIp?: string | null;
  requestUserAgent?: string | null;
  triggeredByUserId?: string | null;
}): Promise<{
  event: WorkflowIngestionEventRow;
  run: WorkflowPendingRunSummary;
}> {
  const [workflowLookup] = await listWorkflowRowsByIds([params.binding.workflow_id]);
  const [versionLookup] = await listWorkflowVersionRowsByIds([
    params.binding.workflow_version_id,
  ]);

  if (!workflowLookup || !versionLookup) {
    throw new WorkflowTriggerNotFoundError();
  }

  const event = await createWorkflowIngestionEventRow({
    organizationId: params.binding.organization_id,
    workflowDbId: params.binding.workflow_id,
    workflowVersionId: params.binding.workflow_version_id,
    bindingId: params.binding.id,
    sourceType: params.binding.source_type,
    matchKey: params.binding.match_key,
    status: "accepted",
    sourceContext: params.sourceContext,
    payload: params.payload,
    idempotencyKey: params.idempotencyKey ?? null,
    requestIp: params.requestIp,
    requestUserAgent: params.requestUserAgent,
    triggeredByUserId: params.triggeredByUserId,
  });

  const run = await createWorkflowRunRow({
    organizationId: params.binding.organization_id,
    workflowDbId: params.binding.workflow_id,
    workflowVersionId: params.binding.workflow_version_id,
    bindingId: params.binding.id,
    runKey: createWorkflowRunPublicId(),
    correlationId: createWorkflowCorrelationId(),
    triggerSource: params.binding.source_type,
    sourceContext: params.sourceContext,
    payload: params.payload,
    maxAttempts: getExecutionMaxRetries(),
    idempotencyKey: params.idempotencyKey ?? null,
  });
  await createWorkflowRunAttemptRow({
    runId: run.id,
    organizationId: run.organization_id,
    workflowId: run.workflow_id,
    workflowVersionId: run.workflow_version_id,
    attemptNumber: 1,
    launchReason: "initial",
    scheduledFor: run.created_at,
    backoffSeconds: 0,
    status: "scheduled",
  });

  await Promise.all([
    updateWorkflowRunEventLink({
      eventId: event.id,
      runId: run.id,
    }),
    updateWorkflowRunCreatedByEvent({
      runId: run.id,
      eventId: event.id,
    }),
    enqueueWorkflowRunForExecution({
      run,
      reason: "trigger",
    }),
  ]);

  return {
    event: {
      ...event,
      run_id: run.id,
    },
    run: {
      runId: run.run_key,
      workflowId: workflowLookup.workflow_key,
      workflowName: workflowLookup.name,
      workflowVersionNumber: versionLookup.version_number,
      triggerSource: run.trigger_source,
      status: run.status,
      correlationId: run.correlation_id,
      createdAt: run.created_at,
      idempotencyKey: run.idempotency_key,
    },
  };
}

export async function materializePublishedTriggerBinding(params: {
  organizationId: string;
  workflow: WorkflowRow;
  version: WorkflowVersionRow;
  trigger: WorkflowTriggerConfig;
  userId: string;
  request?: Request | null;
}) {
  await deactivateTriggerBindingsForWorkflow({
    workflowDbId: params.workflow.id,
    userId: params.userId,
  });

  const matchKey = getMatchKeyForTrigger({
    workflowKey: params.workflow.workflow_key,
    trigger: params.trigger,
  });
  if (params.trigger.type === "schedule") {
    throw new WorkflowTriggerConflictError(
      "Scheduled triggers are not supported in phase three.",
    );
  }
  const sourceType = params.trigger.type;
  const webhookSecret =
    sourceType === "webhook" ? createWebhookSecret() : null;

  let binding;
  try {
    binding = await createTriggerBindingRow({
      organizationId: params.organizationId,
      workflowDbId: params.workflow.id,
      workflowVersionId: params.version.id,
      sourceType,
      matchKey,
      configSnapshot: {
        ...params.trigger,
        config:
          sourceType === "webhook"
            ? {
                ...params.trigger.config,
                method: "POST",
                path: matchKey,
              }
            : params.trigger.config,
      },
      secretHash: webhookSecret?.hashed ?? null,
      secretLastFour: webhookSecret?.lastFour ?? null,
      userId: params.userId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isDuplicateConstraintError(message)) {
      throw new WorkflowTriggerConflictError(
        sourceType === "webhook"
          ? "This webhook path is already in use by another published workflow."
          : "An active trigger binding already exists for this workflow.",
      );
    }

    throw error;
  }

  await writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    action: "workflow.trigger_binding_activated",
    entityType: "workflow",
    entityId: params.workflow.workflow_key,
    metadata: {
      workflowId: params.workflow.workflow_key,
      version: params.version.version_number,
      sourceType: binding.source_type,
      matchKey: binding.match_key,
    },
    request: params.request,
  });

  return {
    binding,
    webhookSecret: webhookSecret?.plainText ?? null,
  };
}

export async function getWorkflowTriggerDetails(params: {
  organizationId: string;
  workflowId: string;
  canTriggerManually: boolean;
}): Promise<WorkflowTriggerDetails> {
  const state = await loadWorkflowTriggerState(params);
  const attempts = await listWorkflowIngestionEventsByWorkflowDbId({
    workflowDbId: state.workflow.id,
  });

  return {
    workflowId: state.workflow.workflow_key,
    workflowName: state.workflow.name,
    workflowStatus: state.workflow.status,
    publishedVersionNumber: state.workflow.latest_published_version_number,
    canTriggerManually:
      params.canTriggerManually && state.binding?.source_type === "manual",
    trigger: buildTriggerSummary({
      workflow: state.workflow,
      publishedVersionNumber: state.workflow.latest_published_version_number,
      binding: state.binding,
      publishedTrigger: state.publishedTrigger,
      draftTrigger: state.draftTrigger,
    }),
    recentAttempts: (await mapIngestionEventsToSummaries(attempts)).slice(0, 8),
  };
}

export async function listWorkflowTriggerAttempts(params: {
  organizationId: string;
  workflowId: string;
  filters: TriggerAttemptFilters;
}) {
  const workflow = await getWorkflowRowByPublicId({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  });

  if (!workflow) {
    throw new WorkflowTriggerNotFoundError();
  }

  const summaries = await mapIngestionEventsToSummaries(
    await listWorkflowIngestionEventsByWorkflowDbId({
      workflowDbId: workflow.id,
    }),
  );
  const filtered = summaries.filter((item) =>
    params.filters.status ? item.status === params.filters.status : true,
  );
  const total = filtered.length;
  const start = (params.filters.page - 1) * params.filters.pageSize;

  return {
    attempts: filtered.slice(start, start + params.filters.pageSize),
    total,
    page: params.filters.page,
    pageSize: params.filters.pageSize,
  };
}

export async function listWorkflowStreams(params: {
  organizationId: string;
  filters: StreamFilters;
}) {
  const summaries = await mapIngestionEventsToSummaries(
    await listWorkflowIngestionEventsByOrganization(params.organizationId),
  );
  const query = params.filters.query?.toLowerCase();
  const filtered = summaries.filter((item) => {
    if (params.filters.source && item.sourceType !== params.filters.source) {
      return false;
    }
    if (params.filters.status && item.status !== params.filters.status) {
      return false;
    }
    if (params.filters.workflowId && item.workflowId !== params.filters.workflowId) {
      return false;
    }
    if (params.filters.eventKey && item.eventKey !== params.filters.eventKey) {
      return false;
    }
    if (
      query &&
      ![
        item.workflowId,
        item.workflowName,
        item.matchKey,
        item.eventKey ?? "",
        item.errorMessage ?? "",
        item.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    ) {
      return false;
    }
    return true;
  });
  const total = filtered.length;
  const start = (params.filters.page - 1) * params.filters.pageSize;

  return {
    items: filtered.slice(start, start + params.filters.pageSize),
    total,
    page: params.filters.page,
    pageSize: params.filters.pageSize,
  };
}

export async function regenerateWorkflowWebhookSecret(params: {
  organizationId: string;
  workflowId: string;
  userId: string;
  request?: Request | null;
}) {
  const state = await loadWorkflowTriggerState(params);
  if (!state.binding || state.binding.source_type !== "webhook") {
    throw new WorkflowTriggerConflictError(
      "Publish a webhook workflow before rotating its API key.",
    );
  }

  const secret = createWebhookSecret();
  const binding = await updateTriggerBindingSecret({
    bindingId: state.binding.id,
    secretHash: secret.hashed,
    secretLastFour: secret.lastFour,
    userId: params.userId,
  });

  await writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    action: "workflow.webhook_secret_regenerated",
    entityType: "workflow",
    entityId: state.workflow.workflow_key,
    metadata: {
      workflowId: state.workflow.workflow_key,
      bindingId: binding.id,
      endpointPath: binding.match_key,
      secretLastFour: binding.secret_last_four,
    },
    request: params.request,
  });

  return {
    bindingId: binding.id,
    workflowId: state.workflow.workflow_key,
    endpointPath: binding.match_key,
    endpointUrl: toAbsoluteAppUrl(binding.match_key),
    plainTextSecret: secret.plainText,
    lastFour: binding.secret_last_four,
  };
}

export async function executeManualTrigger(params: {
  organizationId: string;
  workflowId: string;
  userId: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
  request?: Request | null;
  requestIp?: string | null;
  requestUserAgent?: string | null;
}) {
  const state = await loadWorkflowTriggerState(params);
  if (state.workflow.status === "archived") {
    throw new WorkflowTriggerConflictError(
      "Archived workflows cannot be triggered.",
    );
  }
  if (!state.binding || state.binding.source_type !== "manual") {
    throw new WorkflowTriggerConflictError(
      "Publish a manual trigger workflow before executing it.",
    );
  }

  const rateLimit = await enforceRateLimit({
    key: buildManualRateLimitKey({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      userId: params.userId,
    }),
    limit: MANUAL_RATE_LIMIT_MAX_REQUESTS,
    windowSeconds: MANUAL_RATE_LIMIT_WINDOW_SECONDS,
  });

  const sourceContext: WorkflowSourceContext = {
    sourceLabel: "manual",
    actorUserId: params.userId,
    requestIp: params.requestIp ?? null,
    requestUserAgent: params.requestUserAgent ?? null,
    timestamp: new Date().toISOString(),
  };

  if (!rateLimit.ok) {
    await createWorkflowIngestionEventRow({
      organizationId: state.binding.organization_id,
      workflowDbId: state.binding.workflow_id,
      workflowVersionId: state.binding.workflow_version_id,
      bindingId: state.binding.id,
      sourceType: "manual",
      matchKey: state.binding.match_key,
      status: "rate_limited",
      sourceContext,
      payload: params.payload ?? {},
      idempotencyKey: params.idempotencyKey ?? null,
      errorCode: "rate_limited",
      errorMessage: "Manual trigger rate limit exceeded.",
      requestIp: params.requestIp,
      requestUserAgent: params.requestUserAgent,
      triggeredByUserId: params.userId,
    });
    throw new WorkflowTriggerRateLimitError();
  }

  const idempotencyReservation = await reserveIdempotencyKey({
    key: buildManualIdempotencyKey({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      userId: params.userId,
      idempotencyKey: params.idempotencyKey,
    }),
    ttlSeconds: IDEMPOTENCY_TTL_SECONDS,
  });

  if (!idempotencyReservation.reserved) {
    await createWorkflowIngestionEventRow({
      organizationId: state.binding.organization_id,
      workflowDbId: state.binding.workflow_id,
      workflowVersionId: state.binding.workflow_version_id,
      bindingId: state.binding.id,
      sourceType: "manual",
      matchKey: state.binding.match_key,
      status: "duplicate",
      sourceContext,
      payload: params.payload ?? {},
      idempotencyKey: params.idempotencyKey ?? null,
      errorCode: "duplicate_delivery",
      errorMessage: "This manual trigger idempotency key was already used.",
      requestIp: params.requestIp,
      requestUserAgent: params.requestUserAgent,
      triggeredByUserId: params.userId,
    });
    throw new WorkflowTriggerDuplicateError();
  }

  const accepted = await createAcceptedIngestionWithRun({
    binding: state.binding,
    payload: params.payload ?? {},
    sourceContext,
    idempotencyKey: params.idempotencyKey ?? null,
    requestIp: params.requestIp,
    requestUserAgent: params.requestUserAgent,
    triggeredByUserId: params.userId,
  });

  await writeAuditLog({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    action: "workflow.manual_triggered",
    entityType: "workflow",
    entityId: params.workflowId,
    metadata: {
      workflowId: params.workflowId,
      runId: accepted.run.runId,
      bindingId: state.binding.id,
    },
    request: params.request,
  });

  return accepted;
}

export async function ingestWebhookDelivery(params: {
  pathname: string;
  rawBody: string;
  payload: Record<string, unknown>;
  requestIp?: string | null;
  requestUserAgent?: string | null;
  apiKeyHeader?: string | null;
  deliveryId?: string | null;
}) {
  const binding = await matchWebhookTriggerBinding(params.pathname);
  if (!binding) {
    return {
      kind: "not_found" as const,
    };
  }
  const logger = createTriggerLogger({
    organizationId: binding.organization_id,
    workflowId: binding.workflow_id,
    securityEvent: "webhook_ingestion",
    path: params.pathname,
  });

  const sourceContext: WorkflowSourceContext = {
    sourceLabel: "webhook",
    requestPath: binding.match_key,
    requestMethod: "POST",
    requestIp: params.requestIp ?? null,
    requestUserAgent: params.requestUserAgent ?? null,
    timestamp: new Date().toISOString(),
    deliveryId: params.deliveryId ?? null,
    rawBody: params.rawBody,
  };

  const rateLimit = await enforceRateLimit({
    key: buildWebhookRateLimitKey({
      bindingId: binding.id,
      ipAddress: params.requestIp ?? "unknown",
    }),
    limit: WEBHOOK_RATE_LIMIT_MAX_REQUESTS,
    windowSeconds: WEBHOOK_RATE_LIMIT_WINDOW_SECONDS,
  });

  if (!rateLimit.ok) {
    await trackWebhookMetric({
      binding,
      metric: "rate_limited",
      reason: "rate_limited",
    }).catch(() => undefined);
    await createWorkflowIngestionEventRow({
      organizationId: binding.organization_id,
      workflowDbId: binding.workflow_id,
      workflowVersionId: binding.workflow_version_id,
      bindingId: binding.id,
      sourceType: "webhook",
      matchKey: binding.match_key,
      status: "rate_limited",
      sourceContext,
      payload: params.payload,
      idempotencyKey: params.deliveryId ?? null,
      errorCode: "rate_limited",
      errorMessage: "Webhook rate limit exceeded.",
      requestIp: params.requestIp,
      requestUserAgent: params.requestUserAgent,
    });
    writeLog(logger, "warn", "Webhook delivery exceeded rate limit", {
      bindingId: binding.id,
      requestIp: params.requestIp ?? null,
    });
    return {
      kind: "rate_limited" as const,
      binding,
    };
  }

  const verification = verifyWebhookApiKey({
    apiKeyHeader: params.apiKeyHeader ?? null,
    secretHash: binding.secret_hash,
  });

  if (!verification.ok) {
    await trackWebhookMetric({
      binding,
      metric: "rejected",
      reason: verification.reason,
    }).catch(() => undefined);
    await createWorkflowIngestionEventRow({
      organizationId: binding.organization_id,
      workflowDbId: binding.workflow_id,
      workflowVersionId: binding.workflow_version_id,
      bindingId: binding.id,
      sourceType: "webhook",
      matchKey: binding.match_key,
      status: "rejected",
      sourceContext: {
        ...sourceContext,
        apiKeyVerified: false,
      },
      payload: params.payload,
      idempotencyKey: params.deliveryId ?? null,
      errorCode: verification.reason,
      errorMessage: "Webhook API key validation failed.",
      requestIp: params.requestIp,
      requestUserAgent: params.requestUserAgent,
    });
    await writeAuditLog({
      organizationId: binding.organization_id,
      actorUserId: null,
      action: "workflow.webhook_auth_rejected",
      entityType: "workflow",
      entityId: binding.workflow_id,
      metadata: {
        bindingId: binding.id,
        endpointPath: binding.match_key,
        reason: verification.reason,
        requestIp: params.requestIp ?? null,
        requestUserAgent: params.requestUserAgent ?? null,
      },
    });
    writeLog(logger, "warn", "Webhook API key validation failed", {
      bindingId: binding.id,
      reason: verification.reason,
      requestIp: params.requestIp ?? null,
    });
    return {
      kind: "rejected" as const,
      binding,
      reason: verification.reason,
    };
  }

  await markTriggerBindingSecretUsed(binding.id).catch(() => undefined);

  const dedupeKey = buildWebhookIdempotencyKey({
    bindingId: binding.id,
    deliveryId: params.deliveryId ?? null,
    rawBody: params.rawBody,
  });
  const idempotencyReservation = await reserveIdempotencyKey({
    key: dedupeKey,
    ttlSeconds: IDEMPOTENCY_TTL_SECONDS,
  });

  if (!idempotencyReservation.reserved) {
    await trackWebhookMetric({
      binding,
      metric: "duplicate",
      reason: "duplicate_delivery",
    }).catch(() => undefined);
    await createWorkflowIngestionEventRow({
      organizationId: binding.organization_id,
      workflowDbId: binding.workflow_id,
      workflowVersionId: binding.workflow_version_id,
      bindingId: binding.id,
      sourceType: "webhook",
      matchKey: binding.match_key,
      status: "duplicate",
      sourceContext: {
        ...sourceContext,
        apiKeyVerified: true,
      },
      payload: params.payload,
      idempotencyKey: dedupeKey,
      errorCode: "duplicate_delivery",
      errorMessage: "Duplicate webhook delivery rejected.",
      requestIp: params.requestIp,
      requestUserAgent: params.requestUserAgent,
    });
    writeLog(logger, "warn", "Duplicate webhook delivery rejected", {
      bindingId: binding.id,
      idempotencyKey: dedupeKey,
    });
    return {
      kind: "duplicate" as const,
      binding,
    };
  }

  const accepted = await createAcceptedIngestionWithRun({
    binding,
    payload: params.payload,
    sourceContext: {
      ...sourceContext,
      apiKeyVerified: true,
    },
    idempotencyKey: dedupeKey,
    requestIp: params.requestIp,
    requestUserAgent: params.requestUserAgent,
  });

  writeLog(logger, "info", "Webhook delivery accepted", {
    bindingId: binding.id,
    runId: accepted.run.runId,
    correlationId: accepted.run.correlationId,
  });

  return {
    kind: "accepted" as const,
    binding,
    ...accepted,
  };
}

export async function ingestInternalEvent(params: {
  eventId: string;
  eventKey: InternalEventKey;
  source: string;
  payload: Record<string, unknown>;
  occurredAt?: string;
}) {
  const bindings = await matchInternalEventBindings(params.eventKey);
  if (bindings.length === 0) {
    return {
      status: "accepted" as const,
      matchedWorkflows: 0,
      runs: [] as WorkflowPendingRunSummary[],
    };
  }

  const rateLimit = await enforceRateLimit({
    key: buildInternalEventRateLimitKey(params.eventKey),
    limit: INTERNAL_EVENT_RATE_LIMIT_MAX_REQUESTS,
    windowSeconds: INTERNAL_EVENT_RATE_LIMIT_WINDOW_SECONDS,
  });

  const sourceContext: WorkflowSourceContext = {
    sourceLabel: params.source,
    eventKey: params.eventKey,
    timestamp: params.occurredAt ?? new Date().toISOString(),
  };

  if (!rateLimit.ok) {
    await Promise.all(
      bindings.map((binding) =>
        createWorkflowIngestionEventRow({
          organizationId: binding.organization_id,
          workflowDbId: binding.workflow_id,
          workflowVersionId: binding.workflow_version_id,
          bindingId: binding.id,
          sourceType: "internal_event",
          matchKey: binding.match_key,
          status: "rate_limited",
          sourceContext,
          payload: params.payload,
          idempotencyKey: params.eventId,
          errorCode: "rate_limited",
          errorMessage: "Internal event ingestion rate limit exceeded.",
        }),
      ),
    );
    throw new WorkflowTriggerRateLimitError();
  }

  const reservation = await reserveIdempotencyKey({
    key: buildInternalEventIdempotencyKey({
      eventId: params.eventId,
      eventKey: params.eventKey,
    }),
    ttlSeconds: IDEMPOTENCY_TTL_SECONDS,
  });

  if (!reservation.reserved) {
    await Promise.all(
      bindings.map((binding) =>
        createWorkflowIngestionEventRow({
          organizationId: binding.organization_id,
          workflowDbId: binding.workflow_id,
          workflowVersionId: binding.workflow_version_id,
          bindingId: binding.id,
          sourceType: "internal_event",
          matchKey: binding.match_key,
          status: "duplicate",
          sourceContext,
          payload: params.payload,
          idempotencyKey: params.eventId,
          errorCode: "duplicate_delivery",
          errorMessage: "This internal event id was already processed.",
        }),
      ),
    );
    throw new WorkflowTriggerDuplicateError();
  }

  const runs = await Promise.all(
    bindings.map(async (binding) => {
      const accepted = await createAcceptedIngestionWithRun({
        binding,
        payload: params.payload,
        sourceContext,
        idempotencyKey: params.eventId,
      });

      return accepted.run;
    }),
  );

  return {
    status: "accepted" as const,
    matchedWorkflows: bindings.length,
    runs,
  };
}

export async function deactivateWorkflowTriggerBindings(params: {
  workflowDbId: string;
  userId: string;
}) {
  await deactivateTriggerBindingsForWorkflow({
    workflowDbId: params.workflowDbId,
    userId: params.userId,
  });
}
