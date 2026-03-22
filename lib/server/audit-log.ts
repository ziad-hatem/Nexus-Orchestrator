import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type AuditMetadata = Record<string, unknown>;

export type AuditLogEntry = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: AuditMetadata;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

type AuditLogActor = {
  id: string;
  name: string | null;
  email: string;
};

export type AuditLogWithActor = AuditLogEntry & {
  actor: AuditLogActor | null;
};

type WriteAuditLogParams = {
  organizationId: string;
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: AuditMetadata;
  request?: NextRequest | Request | null;
};

export type AuditLogFilters = {
  action?: string;
  query?: string;
  page: number;
  pageSize: number;
};

function extractIpAddress(request?: NextRequest | Request | null): string | null {
  if (!request) {
    return null;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.headers.get("x-real-ip");
}

function extractUserAgent(request?: NextRequest | Request | null): string | null {
  return request?.headers.get("user-agent") ?? null;
}

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    organization_id: params.organizationId,
    actor_user_id: params.actorUserId ?? null,
    action: params.action,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? {},
    ip_address: extractIpAddress(params.request),
    user_agent: extractUserAgent(params.request),
  });

  if (error) {
    throw new Error(`Failed to write audit log: ${error.message}`);
  }
}

function matchesAuditQuery(log: AuditLogEntry, query: string): boolean {
  const haystacks = [
    log.action,
    log.entity_type ?? "",
    log.entity_id ?? "",
    JSON.stringify(log.metadata ?? {}),
  ];

  const lowered = query.toLowerCase();
  return haystacks.some((value) => value.toLowerCase().includes(lowered));
}

export async function listAuditLogs(
  organizationId: string,
  filters: AuditLogFilters,
): Promise<{ logs: AuditLogWithActor[]; total: number }> {
  const supabase = createSupabaseAdminClient();
  const page = Math.max(1, filters.page);
  const pageSize = Math.max(1, Math.min(filters.pageSize, 50));

  let query = supabase
    .from("audit_logs")
    .select(
      "id, organization_id, actor_user_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filters.action) {
    query = query.eq("action", filters.action);
  }

  const { data, error, count } = await query.returns<AuditLogEntry[]>();

  if (error) {
    throw new Error(`Failed to load audit logs: ${error.message}`);
  }

  const rawLogs = data ?? [];
  const filteredLogs = filters.query
    ? rawLogs.filter((log) => matchesAuditQuery(log, filters.query ?? ""))
    : rawLogs;

  const actorIds = Array.from(
    new Set(
      filteredLogs
        .map((log) => log.actor_user_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  const actorsById = new Map<string, AuditLogActor>();
  if (actorIds.length > 0) {
    const { data: actors, error: actorsError } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", actorIds)
      .returns<AuditLogActor[]>();

    if (actorsError) {
      throw new Error(`Failed to load audit actors: ${actorsError.message}`);
    }

    for (const actor of actors ?? []) {
      actorsById.set(actor.id, actor);
    }
  }

  return {
    logs: filteredLogs.map((log) => ({
      ...log,
      actor: log.actor_user_id ? actorsById.get(log.actor_user_id) ?? null : null,
    })),
    total: count ?? filteredLogs.length,
  };
}
