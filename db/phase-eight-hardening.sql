-- Phase eight audit, security, and hardening
-- Apply after db/phase-seven-observability-recovery.sql

alter table public.workflow_trigger_bindings
  add column if not exists secret_rotated_at timestamptz,
  add column if not exists secret_last_used_at timestamptz;

update public.workflow_trigger_bindings
set secret_rotated_at = coalesce(updated_at, created_at)
where secret_hash is not null
  and secret_rotated_at is null;

create index if not exists audit_logs_org_entity_created_idx
  on public.audit_logs (organization_id, entity_type, created_at desc);

create index if not exists audit_logs_actor_created_idx
  on public.audit_logs (organization_id, actor_user_id, created_at desc)
  where actor_user_id is not null;

create index if not exists workflow_trigger_bindings_active_webhook_secret_usage_idx
  on public.workflow_trigger_bindings (
    organization_id,
    secret_last_used_at desc,
    secret_rotated_at desc
  )
  where is_active = true and source_type = 'webhook';

create index if not exists workflow_ingestion_events_org_source_status_created_idx
  on public.workflow_ingestion_events (
    organization_id,
    source_type,
    status,
    created_at desc
  );

create index if not exists workflow_ingestion_events_org_error_created_idx
  on public.workflow_ingestion_events (
    organization_id,
    error_code,
    created_at desc
  )
  where error_code is not null;

create index if not exists workflow_runs_running_heartbeat_idx
  on public.workflow_runs (
    organization_id,
    last_heartbeat_at desc,
    updated_at desc
  )
  where status = 'running';

create index if not exists workflow_runs_retry_backlog_idx
  on public.workflow_runs (
    organization_id,
    next_retry_at asc,
    created_at desc
  )
  where status = 'retrying';
