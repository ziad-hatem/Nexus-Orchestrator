-- Phase two workflow lifecycle schema upgrades
-- Apply after db/phase-one-rbac-schema.sql

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workflow_lifecycle_status') then
    create type workflow_lifecycle_status as enum (
      'draft_only',
      'published',
      'published_with_draft',
      'archived'
    );
  end if;
end $$;

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_key text not null,
  slug text not null,
  name text not null,
  description text not null default '',
  category text not null,
  tags jsonb not null default '[]'::jsonb,
  status workflow_lifecycle_status not null default 'draft_only',
  latest_published_version_number integer,
  created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid not null references public.users(id) on delete restrict,
  archived_by uuid references public.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, workflow_key),
  unique (organization_id, slug)
);

create table if not exists public.workflow_drafts (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null unique references public.workflows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  canvas jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  validation_issues jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  metadata jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  canvas jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  validation_issues jsonb not null default '[]'::jsonb,
  publish_notes text,
  published_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workflow_id, version_number)
);

create index if not exists workflows_org_status_idx
  on public.workflows (organization_id, status, updated_at desc);

create index if not exists workflows_org_category_idx
  on public.workflows (organization_id, category, updated_at desc);

create index if not exists workflows_org_slug_idx
  on public.workflows (organization_id, slug);

create index if not exists workflows_org_workflow_key_idx
  on public.workflows (organization_id, workflow_key);

create index if not exists workflow_drafts_org_updated_idx
  on public.workflow_drafts (organization_id, updated_at desc);

create index if not exists workflow_versions_org_workflow_created_idx
  on public.workflow_versions (organization_id, workflow_id, created_at desc);

create index if not exists workflow_versions_org_version_idx
  on public.workflow_versions (organization_id, workflow_id, version_number desc);
