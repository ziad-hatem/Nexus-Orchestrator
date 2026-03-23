import type {
  InternalEventKey,
  WorkflowIngestionStatus,
  WorkflowSourceContext,
  WorkflowTriggerSource,
} from "@/lib/server/workflows/types";

export type TriggerBindingRow = {
  id: string;
  organization_id: string;
  workflow_id: string;
  workflow_version_id: string;
  source_type: WorkflowTriggerSource;
  match_key: string;
  config_snapshot: unknown;
  secret_hash: string | null;
  secret_last_four: string | null;
  secret_rotated_at: string | null;
  secret_last_used_at: string | null;
  is_active: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type TriggerBindingWorkflowRow = TriggerBindingRow & {
  workflow_key: string;
  workflow_name: string;
  workflow_status: string;
  category?: string | null;
  latest_published_version_number: number | null;
};

export type WorkflowIngestionEventRow = {
  id: string;
  organization_id: string;
  workflow_id: string;
  workflow_version_id: string;
  binding_id: string;
  run_id: string | null;
  source_type: WorkflowTriggerSource;
  match_key: string;
  status: WorkflowIngestionStatus;
  source_context: unknown;
  payload: unknown;
  idempotency_key: string | null;
  error_code: string | null;
  error_message: string | null;
  request_ip: string | null;
  request_user_agent: string | null;
  triggered_by_user_id: string | null;
  created_at: string;
};

export type WorkflowIngestionEventWithWorkflowRow = WorkflowIngestionEventRow & {
  workflow_key: string;
  workflow_name: string;
  version_number: number;
};

export type WebhookSecretMaterial = {
  plainText: string;
  hashed: string;
  lastFour: string;
};

export type WebhookApiKeyVerificationResult = {
  ok: boolean;
  reason:
    | "verified"
    | "missing_api_key"
    | "invalid_api_key"
    | "invalid_api_key_shape";
};

export type TriggerRouteSource = "manual" | "webhook" | "internal_event";

export type TriggerIngestionContext = {
  sourceType: TriggerRouteSource;
  matchKey: string;
  payload: Record<string, unknown>;
  rawBody?: string | null;
  sourceContext: WorkflowSourceContext;
  idempotencyKey?: string | null;
  requestIp?: string | null;
  requestUserAgent?: string | null;
  triggeredByUserId?: string | null;
};

export type StreamFilters = {
  query?: string;
  source?: WorkflowTriggerSource;
  status?: WorkflowIngestionStatus;
  workflowId?: string;
  eventKey?: InternalEventKey;
  page: number;
  pageSize: number;
};

export type TriggerAttemptFilters = {
  status?: WorkflowIngestionStatus;
  page: number;
  pageSize: number;
};
