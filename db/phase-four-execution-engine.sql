-- Phase four execution engine core
-- Apply after db/phase-three-trigger-ingestion.sql

create extension if not exists pgcrypto;

do $$
begin
  alter type workflow_run_status add value if not exists 'running';
  alter type workflow_run_status add value if not exists 'success';
  alter type workflow_run_status add value if not exists 'failed';
  alter type workflow_run_status add value if not exists 'retrying';
  alter type workflow_run_status add value if not exists 'cancelled';

  if not exists (select 1 from pg_type where typname = 'workflow_run_step_status') then
    create type workflow_run_step_status as enum (
      'pending',
      'running',
      'success',
      'failed',
      'cancelled',
      'skipped'
    );
  end if;
end $$;

alter table public.workflow_runs
  add column if not exists run_key text,
  add column if not exists correlation_id text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists failure_code text,
  add column if not exists failure_message text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.workflow_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  workflow_version_id uuid not null references public.workflow_versions(id) on delete cascade,
  node_id text not null,
  node_type text not null,
  node_label text not null,
  node_snapshot jsonb not null default '{}'::jsonb,
  sequence_number integer not null,
  attempt_number integer not null default 1,
  branch_taken text,
  status workflow_run_step_status not null default 'pending',
  correlation_id text not null,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  logs jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workflow_runs_run_key_idx
  on public.workflow_runs (organization_id, run_key);

create unique index if not exists workflow_runs_correlation_id_idx
  on public.workflow_runs (correlation_id);

create index if not exists workflow_runs_status_created_idx
  on public.workflow_runs (organization_id, status, created_at desc);

create index if not exists workflow_runs_workflow_status_created_idx
  on public.workflow_runs (workflow_id, status, created_at desc);

create index if not exists workflow_runs_cancel_requested_idx
  on public.workflow_runs (status, cancel_requested_at)
  where cancel_requested_at is not null;

create index if not exists workflow_run_steps_run_sequence_idx
  on public.workflow_run_steps (run_id, attempt_number, sequence_number, created_at);

create index if not exists workflow_run_steps_run_status_idx
  on public.workflow_run_steps (run_id, status, created_at);
