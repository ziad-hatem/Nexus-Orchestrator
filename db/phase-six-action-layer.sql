-- Phase six action execution layer
-- Apply after db/phase-four-execution-engine.sql

create extension if not exists pgcrypto;

create table if not exists public.workflow_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  workflow_version_id uuid not null references public.workflow_versions(id) on delete cascade,
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  step_id uuid not null references public.workflow_run_steps(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open',
  assignee_user_id uuid references public.users(id) on delete set null,
  assignee_email text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_type text not null,
  record_key text not null,
  fields jsonb not null default '{}'::jsonb,
  created_by_workflow_id uuid references public.workflows(id) on delete set null,
  created_by_workflow_version_id uuid references public.workflow_versions(id) on delete set null,
  created_by_run_id uuid references public.workflow_runs(id) on delete set null,
  created_by_step_id uuid references public.workflow_run_steps(id) on delete set null,
  updated_by_workflow_id uuid references public.workflows(id) on delete set null,
  updated_by_workflow_version_id uuid references public.workflow_versions(id) on delete set null,
  updated_by_run_id uuid references public.workflow_runs(id) on delete set null,
  updated_by_step_id uuid references public.workflow_run_steps(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflow_tasks_org_run_idx
  on public.workflow_tasks (organization_id, run_id, created_at desc);

create index if not exists workflow_tasks_org_assignee_idx
  on public.workflow_tasks (organization_id, assignee_user_id, created_at desc);

create unique index if not exists workflow_records_org_type_key_uidx
  on public.workflow_records (organization_id, record_type, record_key);

create index if not exists workflow_records_org_updated_idx
  on public.workflow_records (organization_id, updated_at desc);
