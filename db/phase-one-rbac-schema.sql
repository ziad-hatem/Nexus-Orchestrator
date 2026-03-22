-- Phase one RBAC + multi-organization schema upgrades
-- Apply after db/topbar-schema.sql and db/team-schema.sql

do $$
begin
  if exists (
    select 1
    from pg_type
    where typname = 'organization_role'
  ) then
    if exists (
      select 1
      from pg_enum
      where enumtypid = 'organization_role'::regtype
        and enumlabel = 'admin'
    ) then
      alter type organization_role rename value 'admin' to 'org_admin';
    end if;

    if exists (
      select 1
      from pg_enum
      where enumtypid = 'organization_role'::regtype
        and enumlabel = 'manager'
    ) then
      alter type organization_role rename value 'manager' to 'workflow_editor';
    end if;

    if exists (
      select 1
      from pg_enum
      where enumtypid = 'organization_role'::regtype
        and enumlabel = 'support'
    ) then
      alter type organization_role rename value 'support' to 'operator';
    end if;

    if exists (
      select 1
      from pg_enum
      where enumtypid = 'organization_role'::regtype
        and enumlabel = 'read_only'
    ) then
      alter type organization_role rename value 'read_only' to 'viewer';
    end if;
  end if;
end $$;

alter table public.audit_logs
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists ip_address text,
  add column if not exists user_agent text;

alter table public.organization_invites
  add column if not exists display_name text;

create index if not exists organizations_slug_idx
  on public.organizations (slug);

create index if not exists audit_logs_org_created_idx
  on public.audit_logs (organization_id, created_at desc);

create index if not exists audit_logs_org_action_idx
  on public.audit_logs (organization_id, action, created_at desc);

create index if not exists organization_invites_token_hash_idx
  on public.organization_invites (token_hash);

create index if not exists organization_invites_org_pending_idx
  on public.organization_invites (organization_id, created_at desc)
  where accepted_at is null and revoked_at is null;
