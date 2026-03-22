-- Phase three trigger ingestion schema upgrades
-- Apply after db/phase-two-workflows-schema.sql

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workflow_trigger_source') then
    create type workflow_trigger_source as enum (
      'manual',
      'webhook',
      'internal_event'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'workflow_ingestion_status') then
    create type workflow_ingestion_status as enum (
      'accepted',
      'rejected',
      'duplicate',
      'rate_limited'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'workflow_run_status') then
    create type workflow_run_status as enum (
      'pending'
    );
  end if;
end $$;

create table if not exists public.workflow_trigger_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  workflow_version_id uuid not null references public.workflow_versions(id) on delete cascade,
  source_type workflow_trigger_source not null,
  match_key text not null,
  config_snapshot jsonb not null default '{}'::jsonb,
  secret_hash text,
  secret_last_four text,
  is_active boolean not null default true,
  created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  workflow_version_id uuid not null references public.workflow_versions(id) on delete cascade,
  binding_id uuid not null references public.workflow_trigger_bindings(id) on delete cascade,
  status workflow_run_status not null default 'pending',
  trigger_source workflow_trigger_source not null,
  source_context jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_by_event_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_ingestion_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  workflow_version_id uuid not null references public.workflow_versions(id) on delete cascade,
  binding_id uuid not null references public.workflow_trigger_bindings(id) on delete cascade,
  run_id uuid references public.workflow_runs(id) on delete set null,
  source_type workflow_trigger_source not null,
  match_key text not null,
  status workflow_ingestion_status not null,
  source_context jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text,
  error_code text,
  error_message text,
  request_ip text,
  request_user_agent text,
  triggered_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'workflow_runs'
      and constraint_name = 'workflow_runs_created_by_event_id_fkey'
  ) then
    alter table public.workflow_runs
      add constraint workflow_runs_created_by_event_id_fkey
      foreign key (created_by_event_id)
      references public.workflow_ingestion_events(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists workflow_trigger_bindings_active_workflow_idx
  on public.workflow_trigger_bindings (workflow_id)
  where is_active = true;

create unique index if not exists workflow_trigger_bindings_active_webhook_match_idx
  on public.workflow_trigger_bindings (source_type, match_key)
  where is_active = true and source_type = 'webhook';

create index if not exists workflow_trigger_bindings_active_match_idx
  on public.workflow_trigger_bindings (source_type, match_key, is_active, created_at desc);

create index if not exists workflow_trigger_bindings_internal_event_idx
  on public.workflow_trigger_bindings (source_type, match_key, organization_id)
  where is_active = true and source_type = 'internal_event';

create index if not exists workflow_ingestion_events_org_created_idx
  on public.workflow_ingestion_events (organization_id, created_at desc);

create index if not exists workflow_ingestion_events_workflow_created_idx
  on public.workflow_ingestion_events (workflow_id, created_at desc);

create index if not exists workflow_ingestion_events_binding_status_idx
  on public.workflow_ingestion_events (binding_id, status, created_at desc);

create index if not exists workflow_runs_org_created_idx
  on public.workflow_runs (organization_id, created_at desc);

create index if not exists workflow_runs_workflow_created_idx
  on public.workflow_runs (workflow_id, created_at desc);
