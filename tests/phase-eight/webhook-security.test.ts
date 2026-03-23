import assert from "node:assert/strict";
import test from "node:test";
import {
  createWebhookSecret,
  verifyWebhookApiKey,
} from "@/lib/server/triggers/security-core";
import {
  ingestWebhookDelivery,
  regenerateWorkflowWebhookSecret,
  triggerServiceDeps,
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
    tags: ["nexus"],
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
    triggerType: "webhook",
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
    source_type: "webhook",
    match_key: "/hooks/acme/orders",
    config_snapshot: {
      id: "trigger_1",
      type: "webhook",
      label: "Webhook",
      description: "",
      config: { path: "/hooks/acme/orders", method: "POST" },
    },
    secret_hash: "stored_hash",
    secret_last_four: "1234",
    secret_rotated_at: "2026-03-23T00:00:00.000Z",
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
    source_type: "webhook",
    match_key: "/hooks/acme/orders",
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
    run_key: "RUN-1001",
    correlation_id: "corr_1",
    status: "pending",
    trigger_source: "webhook",
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

test("rotated webhook secrets reject the old value and accept the new value", () => {
  const original = createWebhookSecret();
  const rotated = createWebhookSecret();

  assert.deepEqual(
    verifyWebhookApiKey({
      apiKeyHeader: original.plainText,
      secretHash: rotated.hashed,
    }),
    { ok: false, reason: "invalid_api_key" },
  );
  assert.deepEqual(
    verifyWebhookApiKey({
      apiKeyHeader: rotated.plainText,
      secretHash: rotated.hashed,
    }),
    { ok: true, reason: "verified" },
  );
});

test("regenerateWorkflowWebhookSecret audits only safe secret metadata", async () => {
  let auditedMetadata: Record<string, unknown> | null = null;

  installCommonTriggerServiceNoops();
  triggerServiceDeps.getWorkflowRowByPublicId = async () => createWorkflowRow();
  triggerServiceDeps.getActiveTriggerBindingByWorkflowDbId = async () =>
    createBindingRow();
  triggerServiceDeps.getWorkflowDraftRowByWorkflowDbId = async () => null;
  triggerServiceDeps.getWorkflowVersionRow = async () => createVersionRow();
  triggerServiceDeps.updateTriggerBindingSecret = async () =>
    createBindingRow({
      secret_last_four: "5678",
    });
  triggerServiceDeps.writeAuditLog = async (params) => {
    auditedMetadata = params.metadata ?? null;
  };

  const result = await regenerateWorkflowWebhookSecret({
    organizationId: "org_1",
    workflowId: "WFL-1234",
    userId: "user_1",
  });

  assert.equal(result.lastFour, "5678");
  assert.equal(result.plainTextSecret.startsWith("nwhsec_"), true);
  assert.ok(auditedMetadata);
  const safeMetadata = auditedMetadata as Record<string, unknown>;
  assert.equal("plainTextSecret" in safeMetadata, false);
  assert.equal("secretHash" in safeMetadata, false);
  assert.equal(safeMetadata["secretLastFour"], "5678");
});

test("ingestWebhookDelivery marks webhook secret usage after successful verification", async () => {
  let markedBindingId = "";

  installCommonTriggerServiceNoops();
  triggerServiceDeps.matchWebhookTriggerBinding = async () => createBindingRow();
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
  triggerServiceDeps.markTriggerBindingSecretUsed = async (bindingId) => {
    markedBindingId = bindingId;
  };
  triggerServiceDeps.reserveIdempotencyKey = async ({ key }) => ({
    reserved: true,
    key,
  });
  triggerServiceDeps.listWorkflowRowsByIds = async () => [createWorkflowRow()];
  triggerServiceDeps.listWorkflowVersionRowsByIds = async () => [createVersionRow()];
  triggerServiceDeps.createWorkflowIngestionEventRow = async (params) =>
    createIngestionEventRow({
      match_key: params.matchKey,
      status: params.status,
      source_context: params.sourceContext,
      payload: params.payload,
      idempotency_key: params.idempotencyKey ?? null,
    });
  triggerServiceDeps.createWorkflowRunRow = async () => createRunRow();
  triggerServiceDeps.getExecutionMaxRetries = () => 5;
  triggerServiceDeps.createWorkflowRunAttemptRow = async () => ({} as never);
  triggerServiceDeps.updateWorkflowRunEventLink = async () => undefined;
  triggerServiceDeps.updateWorkflowRunCreatedByEvent = async () => undefined;
  triggerServiceDeps.enqueueWorkflowRunForExecution = async () => undefined;

  const result = await ingestWebhookDelivery({
    pathname: "/hooks/acme/orders",
    rawBody: '{"orderId":"123"}',
    payload: { orderId: "123" },
    apiKeyHeader: "nwhsec_valid",
    requestIp: "198.51.100.40",
    requestUserAgent: "qa-suite",
  });

  assert.equal(result.kind, "accepted");
  assert.equal(markedBindingId, "binding_1");
});
