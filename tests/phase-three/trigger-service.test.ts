import assert from "node:assert/strict";
import test from "node:test";
import {
  executeManualTrigger,
  ingestInternalEvent,
  ingestWebhookDelivery,
  triggerServiceDeps,
  WorkflowTriggerDuplicateError,
  WorkflowTriggerRateLimitError,
} from "@/lib/server/triggers/service";
import type {
  TriggerBindingRow,
  WorkflowIngestionEventRow,
} from "@/lib/server/triggers/types";
import type { WorkflowRunRow } from "@/lib/server/executions/types";
import type {
  WorkflowRow,
  WorkflowVersionRow,
} from "@/lib/server/workflows/repository";
import { createEmptyWorkflowDraftDocument } from "@/lib/server/workflows/types";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalTriggerServiceDeps = { ...triggerServiceDeps };

test.afterEach(() => {
  restoreMutableExports(triggerServiceDeps, originalTriggerServiceDeps);
});

function createWorkflowRow(overrides: Partial<WorkflowRow> = {}): WorkflowRow {
  return {
    id: "workflow_db_1",
    organization_id: "org_1",
    workflow_key: "WFL-1234",
    slug: "incident-triage",
    name: "Incident triage",
    description: "Routes incidents",
    category: "Operations",
    tags: ["ops"],
    status: "published",
    latest_published_version_number: 1,
    created_by: "user_1",
    updated_by: "user_1",
    archived_by: null,
    archived_at: null,
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createVersionRow(
  overrides: Partial<WorkflowVersionRow> = {},
): WorkflowVersionRow {
  const draft = createEmptyWorkflowDraftDocument({
    name: "Incident triage",
    description: "Routes incidents",
    category: "Operations",
    triggerType: "manual",
  });

  return {
    id: "version_db_1",
    workflow_id: "workflow_db_1",
    organization_id: "org_1",
    version_number: 1,
    metadata: draft.metadata,
    config: draft.config,
    canvas: draft.canvas,
    validation_issues: [],
    publish_notes: null,
    published_by: "user_1",
    created_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createBindingRow(
  overrides: Partial<TriggerBindingRow> = {},
): TriggerBindingRow {
  return {
    id: "binding_1",
    organization_id: "org_1",
    workflow_id: "workflow_db_1",
    workflow_version_id: "version_db_1",
    source_type: "manual",
    match_key: "manual:WFL-1234",
    config_snapshot: {
      id: "trigger_1",
      type: "manual",
      label: "Manual trigger",
      description: "",
      config: {},
    },
    secret_hash: null,
    secret_last_four: null,
    secret_rotated_at: null,
    secret_last_used_at: null,
    is_active: true,
    created_by: "user_1",
    updated_by: "user_1",
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createIngestionEventRow(
  overrides: Partial<WorkflowIngestionEventRow> = {},
): WorkflowIngestionEventRow {
  return {
    id: "event_1",
    organization_id: "org_1",
    workflow_id: "workflow_db_1",
    workflow_version_id: "version_db_1",
    binding_id: "binding_1",
    run_id: null,
    source_type: "manual",
    match_key: "manual:WFL-1234",
    status: "accepted",
    source_context: {},
    payload: {},
    idempotency_key: null,
    error_code: null,
    error_message: null,
    request_ip: null,
    request_user_agent: null,
    triggered_by_user_id: null,
    created_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function createRunRow(overrides: Partial<WorkflowRunRow> = {}): WorkflowRunRow {
  return {
    id: "run_db_1",
    organization_id: "org_1",
    workflow_id: "workflow_db_1",
    workflow_version_id: "version_db_1",
    binding_id: "binding_1",
    run_key: "run_public_1",
    correlation_id: "corr_1",
    status: "pending",
    trigger_source: "manual",
    source_context: {},
    payload: {},
    idempotency_key: null,
    created_by_event_id: null,
    attempt_count: 0,
    max_attempts: 3,
    started_at: null,
    completed_at: null,
    cancel_requested_at: null,
    cancelled_at: null,
    last_heartbeat_at: null,
    next_retry_at: null,
    last_retry_at: null,
    failure_code: null,
    failure_message: null,
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

function installCommonTriggerServiceNoops() {
  triggerServiceDeps.createChildLogger = () => ({}) as never;
  triggerServiceDeps.writeLog = () => undefined;
  triggerServiceDeps.incrementWindowCounter = async () => ({
    key: "metric",
    current: 1,
    windowSeconds: 60,
  });
  triggerServiceDeps.evaluateOperationalAlerts = () => [];
  triggerServiceDeps.emitOperationalAlert = () => null;
  triggerServiceDeps.getOperationsAlertLookbackMinutes = () => 5;
}

test("executeManualTrigger creates one accepted event, run, attempt, and audit entry", async () => {
  const workflow = createWorkflowRow();
  const version = createVersionRow();
  const binding = createBindingRow();
  const createdEvents: WorkflowIngestionEventRow[] = [];
  const runAttempts: Array<{ runId: string; attemptNumber: number }> = [];
  const eventLinks: string[] = [];
  const auditActions: string[] = [];

  installCommonTriggerServiceNoops();
  triggerServiceDeps.getWorkflowRowByPublicId = async () => workflow;
  triggerServiceDeps.getActiveTriggerBindingByWorkflowDbId = async () => binding;
  triggerServiceDeps.getWorkflowDraftRowByWorkflowDbId = async () => null;
  triggerServiceDeps.getWorkflowVersionRow = async () => version;
  triggerServiceDeps.enforceRateLimit = async () => ({
    ok: true,
    remaining: 19,
    current: 1,
    limit: 20,
    windowSeconds: 60,
  });
  triggerServiceDeps.reserveIdempotencyKey = async () => ({
    reserved: true,
    key: "wf:manual:dedupe:key",
  });
  triggerServiceDeps.listWorkflowRowsByIds = async () => [workflow];
  triggerServiceDeps.listWorkflowVersionRowsByIds = async () => [version];
  triggerServiceDeps.createWorkflowIngestionEventRow = async (params) => {
    const row = createIngestionEventRow({
      organization_id: params.organizationId,
      workflow_id: params.workflowDbId,
      workflow_version_id: params.workflowVersionId,
      binding_id: params.bindingId,
      source_type: params.sourceType,
      match_key: params.matchKey,
      status: params.status,
      source_context: params.sourceContext,
      payload: params.payload,
      idempotency_key: params.idempotencyKey ?? null,
      request_ip: params.requestIp ?? null,
      request_user_agent: params.requestUserAgent ?? null,
      triggered_by_user_id: params.triggeredByUserId ?? null,
      run_id: params.runId ?? null,
    });
    createdEvents.push(row);
    return row;
  };
  triggerServiceDeps.createWorkflowRunRow = async (params) =>
    createRunRow({
      organization_id: params.organizationId,
      workflow_id: params.workflowDbId,
      workflow_version_id: params.workflowVersionId,
      binding_id: params.bindingId,
      run_key: params.runKey,
      correlation_id: params.correlationId,
      trigger_source: params.triggerSource,
      source_context: params.sourceContext,
      payload: params.payload,
      idempotency_key: params.idempotencyKey ?? null,
      max_attempts: params.maxAttempts,
    });
  triggerServiceDeps.getExecutionMaxRetries = () => 5;
  triggerServiceDeps.createWorkflowRunAttemptRow = async (params) => {
    runAttempts.push({
      runId: params.runId,
      attemptNumber: params.attemptNumber,
    });
    return {} as never;
  };
  triggerServiceDeps.updateWorkflowRunEventLink = async ({ eventId, runId }) => {
    eventLinks.push(`${eventId}:${runId}`);
  };
  triggerServiceDeps.updateWorkflowRunCreatedByEvent = async ({
    eventId,
    runId,
  }) => {
    eventLinks.push(`${runId}:${eventId}`);
  };
  triggerServiceDeps.enqueueWorkflowRunForExecution = async () => undefined;
  triggerServiceDeps.writeAuditLog = async (params) => {
    auditActions.push(params.action);
  };

  const result = await executeManualTrigger({
    organizationId: "org_1",
    workflowId: "WFL-1234",
    userId: "user_2",
    payload: { ticketId: "T-100" },
    idempotencyKey: "idem_1",
    requestIp: "198.51.100.20",
    requestUserAgent: "qa-suite",
  });

  assert.match(result.run.runId, /^RUN-/);
  assert.equal(createdEvents.length, 1);
  assert.equal(createdEvents[0]?.status, "accepted");
  assert.equal(runAttempts.length, 1);
  assert.equal(runAttempts[0]?.attemptNumber, 1);
  assert.equal(eventLinks.length, 2);
  assert.equal(auditActions[0], "workflow.manual_triggered");
  assert.deepEqual(createdEvents[0]?.payload, { ticketId: "T-100" });
  assert.equal(
    (createdEvents[0]?.source_context as { actorUserId?: string }).actorUserId,
    "user_2",
  );
});

test("simultaneous manual triggers with the same idempotency key create one run and one duplicate event", async () => {
  const workflow = createWorkflowRow();
  const version = createVersionRow();
  const binding = createBindingRow();
  const seenKeys = new Set<string | null>();
  const createdStatuses: string[] = [];
  let runCreateCount = 0;
  let auditCount = 0;

  installCommonTriggerServiceNoops();
  triggerServiceDeps.getWorkflowRowByPublicId = async () => workflow;
  triggerServiceDeps.getActiveTriggerBindingByWorkflowDbId = async () => binding;
  triggerServiceDeps.getWorkflowDraftRowByWorkflowDbId = async () => null;
  triggerServiceDeps.getWorkflowVersionRow = async () => version;
  triggerServiceDeps.enforceRateLimit = async () => ({
    ok: true,
    remaining: 19,
    current: 1,
    limit: 20,
    windowSeconds: 60,
  });
  triggerServiceDeps.reserveIdempotencyKey = async ({ key }) => {
    if (seenKeys.has(key)) {
      return { reserved: false, key };
    }

    seenKeys.add(key);
    return { reserved: true, key };
  };
  triggerServiceDeps.listWorkflowRowsByIds = async () => [workflow];
  triggerServiceDeps.listWorkflowVersionRowsByIds = async () => [version];
  triggerServiceDeps.createWorkflowIngestionEventRow = async (params) => {
    createdStatuses.push(params.status);
    return createIngestionEventRow({
      status: params.status,
      idempotency_key: params.idempotencyKey ?? null,
      source_context: params.sourceContext,
      payload: params.payload,
    });
  };
  triggerServiceDeps.createWorkflowRunRow = async () => {
    runCreateCount += 1;
    return createRunRow({
      id: `run_db_${runCreateCount}`,
      run_key: `run_public_${runCreateCount}`,
    });
  };
  triggerServiceDeps.getExecutionMaxRetries = () => 5;
  triggerServiceDeps.createWorkflowRunAttemptRow = async () => ({} as never);
  triggerServiceDeps.updateWorkflowRunEventLink = async () => undefined;
  triggerServiceDeps.updateWorkflowRunCreatedByEvent = async () => undefined;
  triggerServiceDeps.enqueueWorkflowRunForExecution = async () => undefined;
  triggerServiceDeps.writeAuditLog = async () => {
    auditCount += 1;
  };

  const results = await Promise.allSettled([
    executeManualTrigger({
      organizationId: "org_1",
      workflowId: "WFL-1234",
      userId: "user_2",
      idempotencyKey: "idem_concurrent",
    }),
    executeManualTrigger({
      organizationId: "org_1",
      workflowId: "WFL-1234",
      userId: "user_2",
      idempotencyKey: "idem_concurrent",
    }),
  ]);

  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof WorkflowTriggerDuplicateError,
    ).length,
    1,
  );
  assert.equal(runCreateCount, 1);
  assert.equal(auditCount, 1);
  assert.deepEqual(createdStatuses.sort(), ["accepted", "duplicate"]);
});

test("ingestWebhookDelivery rejects invalid API keys and records the rejection", async () => {
  const binding = createBindingRow({
    source_type: "webhook",
    match_key: "/hooks/acme/orders",
    secret_hash: "stored_hash",
    secret_last_four: "1234",
  });
  const createdEvents: WorkflowIngestionEventRow[] = [];
  const auditActions: string[] = [];

  installCommonTriggerServiceNoops();
  triggerServiceDeps.matchWebhookTriggerBinding = async () => binding;
  triggerServiceDeps.enforceRateLimit = async () => ({
    ok: true,
    remaining: 59,
    current: 1,
    limit: 60,
    windowSeconds: 60,
  });
  triggerServiceDeps.verifyWebhookApiKey = () => ({
    ok: false,
    reason: "invalid_api_key",
  });
  triggerServiceDeps.createWorkflowIngestionEventRow = async (params) => {
    const row = createIngestionEventRow({
      source_type: "webhook",
      match_key: params.matchKey,
      status: params.status,
      source_context: params.sourceContext,
      payload: params.payload,
      error_code: params.errorCode ?? null,
    });
    createdEvents.push(row);
    return row;
  };
  triggerServiceDeps.writeAuditLog = async (params) => {
    auditActions.push(params.action);
  };

  const result = await ingestWebhookDelivery({
    pathname: "/hooks/acme/orders",
    rawBody: '{"orderId":"123"}',
    payload: { orderId: "123" },
    apiKeyHeader: "wrong",
    requestIp: "198.51.100.40",
    requestUserAgent: "qa-suite",
  });

  assert.equal(result.kind, "rejected");
  assert.equal(createdEvents.length, 1);
  assert.equal(createdEvents[0]?.status, "rejected");
  assert.equal(
    (createdEvents[0]?.source_context as { apiKeyVerified?: boolean })
      .apiKeyVerified,
    false,
  );
  assert.equal(auditActions[0], "workflow.webhook_auth_rejected");
});

test("duplicate webhook deliveries only create one pending run", async () => {
  const workflow = createWorkflowRow();
  const version = createVersionRow();
  const binding = createBindingRow({
    source_type: "webhook",
    match_key: "/hooks/acme/orders",
    secret_hash: "stored_hash",
    secret_last_four: "1234",
  });
  const seenKeys = new Set<string | null>();
  const eventStatuses: string[] = [];
  let runCreateCount = 0;

  installCommonTriggerServiceNoops();
  triggerServiceDeps.matchWebhookTriggerBinding = async () => binding;
  triggerServiceDeps.enforceRateLimit = async () => ({
    ok: true,
    remaining: 59,
    current: 1,
    limit: 60,
    windowSeconds: 60,
  });
  triggerServiceDeps.verifyWebhookApiKey = () => ({
    ok: true,
    reason: "verified",
  });
  triggerServiceDeps.markTriggerBindingSecretUsed = async () => undefined;
  triggerServiceDeps.reserveIdempotencyKey = async ({ key }) => {
    if (seenKeys.has(key)) {
      return { reserved: false, key };
    }

    seenKeys.add(key);
    return { reserved: true, key };
  };
  triggerServiceDeps.listWorkflowRowsByIds = async () => [workflow];
  triggerServiceDeps.listWorkflowVersionRowsByIds = async () => [version];
  triggerServiceDeps.createWorkflowIngestionEventRow = async (params) => {
    eventStatuses.push(params.status);
    return createIngestionEventRow({
      source_type: "webhook",
      match_key: params.matchKey,
      status: params.status,
      source_context: params.sourceContext,
      payload: params.payload,
      idempotency_key: params.idempotencyKey ?? null,
    });
  };
  triggerServiceDeps.createWorkflowRunRow = async () => {
    runCreateCount += 1;
    return createRunRow({
      id: `run_db_${runCreateCount}`,
      run_key: `run_public_${runCreateCount}`,
      trigger_source: "webhook",
    });
  };
  triggerServiceDeps.getExecutionMaxRetries = () => 5;
  triggerServiceDeps.createWorkflowRunAttemptRow = async () => ({} as never);
  triggerServiceDeps.updateWorkflowRunEventLink = async () => undefined;
  triggerServiceDeps.updateWorkflowRunCreatedByEvent = async () => undefined;
  triggerServiceDeps.enqueueWorkflowRunForExecution = async () => undefined;

  const results = await Promise.all([
    ingestWebhookDelivery({
      pathname: "/hooks/acme/orders",
      rawBody: '{"orderId":"123"}',
      payload: { orderId: "123" },
      apiKeyHeader: "valid",
      deliveryId: "delivery_1",
    }),
    ingestWebhookDelivery({
      pathname: "/hooks/acme/orders",
      rawBody: '{"orderId":"123"}',
      payload: { orderId: "123" },
      apiKeyHeader: "valid",
      deliveryId: "delivery_1",
    }),
  ]);

  assert.equal(results.filter((result) => result.kind === "accepted").length, 1);
  assert.equal(results.filter((result) => result.kind === "duplicate").length, 1);
  assert.equal(runCreateCount, 1);
  assert.deepEqual(eventStatuses.sort(), ["accepted", "duplicate"]);
});

test("ingestInternalEvent fans out accepted runs to every matching binding", async () => {
  const workflowA = createWorkflowRow({
    id: "workflow_db_1",
    workflow_key: "WFL-1001",
    name: "Ticket intake",
  });
  const workflowB = createWorkflowRow({
    id: "workflow_db_2",
    workflow_key: "WFL-1002",
    name: "Ticket escalation",
  });
  const versionA = createVersionRow({
    id: "version_db_1",
    workflow_id: "workflow_db_1",
    version_number: 1,
  });
  const versionB = createVersionRow({
    id: "version_db_2",
    workflow_id: "workflow_db_2",
    version_number: 2,
  });
  const bindings = [
    createBindingRow({
      id: "binding_a",
      workflow_id: "workflow_db_1",
      workflow_version_id: "version_db_1",
      source_type: "internal_event",
      match_key: "ticket.created",
    }),
    createBindingRow({
      id: "binding_b",
      workflow_id: "workflow_db_2",
      workflow_version_id: "version_db_2",
      source_type: "internal_event",
      match_key: "ticket.created",
    }),
  ];
  const createdStatuses: string[] = [];
  let runCreateCount = 0;

  installCommonTriggerServiceNoops();
  triggerServiceDeps.matchInternalEventBindings = async () => bindings;
  triggerServiceDeps.enforceRateLimit = async () => ({
    ok: true,
    remaining: 119,
    current: 1,
    limit: 120,
    windowSeconds: 60,
  });
  triggerServiceDeps.reserveIdempotencyKey = async () => ({
    reserved: true,
    key: "wf:internal:dedupe:ticket.created:evt_1",
  });
  triggerServiceDeps.listWorkflowRowsByIds = async (workflowIds) =>
    [workflowA, workflowB].filter((workflow) => workflowIds.includes(workflow.id));
  triggerServiceDeps.listWorkflowVersionRowsByIds = async (versionIds) =>
    [versionA, versionB].filter((version) => versionIds.includes(version.id));
  triggerServiceDeps.createWorkflowIngestionEventRow = async (params) => {
    createdStatuses.push(params.status);
    return createIngestionEventRow({
      id: `event_${createdStatuses.length}`,
      organization_id: params.organizationId,
      workflow_id: params.workflowDbId,
      workflow_version_id: params.workflowVersionId,
      binding_id: params.bindingId,
      source_type: "internal_event",
      match_key: params.matchKey,
      status: params.status,
      source_context: params.sourceContext,
      payload: params.payload,
      idempotency_key: params.idempotencyKey ?? null,
    });
  };
  triggerServiceDeps.createWorkflowRunRow = async (params) => {
    runCreateCount += 1;
    return createRunRow({
      id: `run_db_${runCreateCount}`,
      organization_id: params.organizationId,
      workflow_id: params.workflowDbId,
      workflow_version_id: params.workflowVersionId,
      binding_id: params.bindingId,
      run_key: `run_public_${runCreateCount}`,
      trigger_source: "internal_event",
      source_context: params.sourceContext,
      payload: params.payload,
      idempotency_key: params.idempotencyKey ?? null,
    });
  };
  triggerServiceDeps.getExecutionMaxRetries = () => 5;
  triggerServiceDeps.createWorkflowRunAttemptRow = async () => ({} as never);
  triggerServiceDeps.updateWorkflowRunEventLink = async () => undefined;
  triggerServiceDeps.updateWorkflowRunCreatedByEvent = async () => undefined;
  triggerServiceDeps.enqueueWorkflowRunForExecution = async () => undefined;

  const result = await ingestInternalEvent({
    eventId: "evt_1",
    eventKey: "ticket.created",
    source: "ticketing",
    payload: { ticketId: "T-100" },
    occurredAt: "2026-03-23T00:00:00.000Z",
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.matchedWorkflows, 2);
  assert.equal(result.runs.length, 2);
  assert.equal(runCreateCount, 2);
  assert.deepEqual(createdStatuses, ["accepted", "accepted"]);
});

test("internal-event rate limiting writes one limited event per matched binding and throws", async () => {
  const bindings = [
    createBindingRow({
      id: "binding_a",
      source_type: "internal_event",
      match_key: "payment.failed",
    }),
    createBindingRow({
      id: "binding_b",
      workflow_id: "workflow_db_2",
      workflow_version_id: "version_db_2",
      source_type: "internal_event",
      match_key: "payment.failed",
    }),
  ];
  const createdStatuses: string[] = [];

  installCommonTriggerServiceNoops();
  triggerServiceDeps.matchInternalEventBindings = async () => bindings;
  triggerServiceDeps.enforceRateLimit = async () => ({
    ok: false,
    remaining: 0,
    current: 121,
    limit: 120,
    windowSeconds: 60,
  });
  triggerServiceDeps.createWorkflowIngestionEventRow = async (params) => {
    createdStatuses.push(params.status);
    return createIngestionEventRow({
      binding_id: params.bindingId,
      workflow_id: params.workflowDbId,
      workflow_version_id: params.workflowVersionId,
      status: params.status,
      source_type: "internal_event",
      match_key: params.matchKey,
      source_context: params.sourceContext,
      payload: params.payload,
      idempotency_key: params.idempotencyKey ?? null,
    });
  };

  await assert.rejects(
    () =>
      ingestInternalEvent({
        eventId: "evt_2",
        eventKey: "payment.failed",
        source: "billing",
        payload: { paymentId: "P-1" },
      }),
    (error: unknown) => error instanceof WorkflowTriggerRateLimitError,
  );

  assert.deepEqual(createdStatuses, ["rate_limited", "rate_limited"]);
});
