import type { NextRequest } from "next/server";
import {
  redactRecord,
  redactSensitiveData,
} from "@/lib/observability/redaction";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const auditLogDeps = {
  createSupabaseAdminClient,
};

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

export type AuditActionSummary = {
  action: string;
  count: number;
};

export type AuditCoverageSummary = {
  requiredActions: string[];
  observedActions: string[];
  missingActions: string[];
  coveredCount: number;
  totalRequired: number;
};

export type AuditLogSummary = {
  total: number;
  uniqueActorCount: number;
  securityEventCount: number;
  topActions: AuditActionSummary[];
  coverage: AuditCoverageSummary;
};

export const PRIVILEGED_AUDIT_ACTIONS = [
  "organization.created",
  "invite.sent",
  "invite.accepted",
  "membership.role_changed",
  "membership.suspended",
  "membership.reactivated",
  "workflow.created",
  "workflow.draft_updated",
  "workflow.published",
  "workflow.archived",
  "workflow.trigger_binding_activated",
  "workflow.webhook_secret_regenerated",
  "workflow.webhook_auth_rejected",
  "workflow.manual_triggered",
  "workflow.run_cancel_requested",
  "workflow.run_retried",
  "system.retention_pruned",
] as const;

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
  const supabase = auditLogDeps.createSupabaseAdminClient();
  const metadata = redactRecord(params.metadata ?? {});
  const { error } = await supabase.from("audit_logs").insert({
    organization_id: params.organizationId,
    actor_user_id: params.actorUserId ?? null,
    action: params.action,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    metadata,
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

export function summarizeAuditLogs(logs: AuditLogEntry[]): AuditLogSummary {
  const topActionsMap = new Map<string, number>();
  const uniqueActorIds = new Set<string>();
  const securityEventCount = logs.filter((log) => {
    if (log.actor_user_id) {
      uniqueActorIds.add(log.actor_user_id);
    }

    return (
      log.action.includes("membership.") ||
      log.action.includes("invite.") ||
      log.action.includes("webhook") ||
      log.action.includes("workflow.run_") ||
      log.action.includes("organization.")
    );
  }).length;

  for (const log of logs) {
    topActionsMap.set(log.action, (topActionsMap.get(log.action) ?? 0) + 1);
  }

  const topActions = Array.from(topActionsMap.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([action, count]) => ({ action, count }));

  const observedRequiredActions = PRIVILEGED_AUDIT_ACTIONS.filter((action) =>
    topActionsMap.has(action),
  );

  return {
    total: logs.length,
    uniqueActorCount: uniqueActorIds.size,
    securityEventCount,
    topActions,
    coverage: {
      requiredActions: [...PRIVILEGED_AUDIT_ACTIONS],
      observedActions: observedRequiredActions,
      missingActions: PRIVILEGED_AUDIT_ACTIONS.filter(
        (action) => !topActionsMap.has(action),
      ),
      coveredCount: observedRequiredActions.length,
      totalRequired: PRIVILEGED_AUDIT_ACTIONS.length,
    },
  };
}

export async function listAuditLogs(
  organizationId: string,
  filters: AuditLogFilters,
): Promise<{
  logs: AuditLogWithActor[];
  total: number;
  summary: AuditLogSummary;
  availableActions: string[];
}> {
  const supabase = auditLogDeps.createSupabaseAdminClient();
  const page = Math.max(1, filters.page);
  const pageSize = Math.max(1, Math.min(filters.pageSize, 50));

  let query = supabase
    .from("audit_logs")
    .select(
      "id, organization_id, actor_user_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (filters.action) {
    query = query.eq("action", filters.action);
  }

  const { data, error } = await query.returns<AuditLogEntry[]>();

  if (error) {
    throw new Error(`Failed to load audit logs: ${error.message}`);
  }

  const rawLogs = data ?? [];
  const normalizedLogs = rawLogs.map((log) => ({
    ...log,
    metadata: redactSensitiveData(log.metadata ?? {}),
  }));
  const filteredLogs = filters.query
    ? normalizedLogs.filter((log) => matchesAuditQuery(log, filters.query ?? ""))
    : normalizedLogs;
  const paginatedLogs = filteredLogs.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const actorIds = Array.from(
    new Set(
      paginatedLogs
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
    logs: paginatedLogs.map((log) => ({
      ...log,
      actor: log.actor_user_id ? actorsById.get(log.actor_user_id) ?? null : null,
    })),
    total: filteredLogs.length,
    summary: summarizeAuditLogs(filteredLogs),
    availableActions: Array.from(new Set(normalizedLogs.map((log) => log.action))).sort(),
  };
}
