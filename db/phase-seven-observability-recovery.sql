-- Phase seven observability and run recovery
-- Apply after db/phase-six-action-layer.sql

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'workflow_run_attempt_status'
  ) then
    create type workflow_run_attempt_status as enum (
      'scheduled',
      'running',
      'success',
      'failed',
      'cancelled'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'workflow_run_launch_reason'
  ) then
    create type workflow_run_launch_reason as enum (
      'initial',
      'automatic_retry',
      'manual_retry'
    );
  end if;
end $$;

alter table public.workflow_runs
  add column if not exists next_retry_at timestamptz,
  add column if not exists last_retry_at timestamptz;

create table if not exists public.workflow_run_attempts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  workflow_version_id uuid not null references public.workflow_versions(id) on delete cascade,
  attempt_number integer not null,
  launch_reason workflow_run_launch_reason not null,
  requested_by_user_id uuid references public.users(id) on delete set null,
  request_note text,
  scheduled_for timestamptz not null default now(),
  backoff_seconds integer,
  status workflow_run_attempt_status not null default 'scheduled',
  failure_code text,
  failure_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_run_attempts_run_attempt_unique
    unique (run_id, attempt_number)
);

create index if not exists workflow_runs_next_retry_idx
  on public.workflow_runs (organization_id, status, next_retry_at desc)
  where next_retry_at is not null;

create index if not exists workflow_runs_failure_code_idx
  on public.workflow_runs (organization_id, failure_code, created_at desc)
  where failure_code is not null;

create index if not exists workflow_run_attempts_run_attempt_idx
  on public.workflow_run_attempts (run_id, attempt_number);

create index if not exists workflow_run_attempts_org_status_schedule_idx
  on public.workflow_run_attempts (organization_id, status, scheduled_for desc);

create index if not exists workflow_run_attempts_failure_idx
  on public.workflow_run_attempts (organization_id, failure_code, completed_at desc)
  where failure_code is not null;
