import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getExecutionQueueBacklog } from "@/lib/server/executions/queue";

export const ORG_REALTIME_CHANNELS = [
  "streams",
  "executions",
  "operations",
  "audit",
] as const;

export type OrgRealtimeChannel = (typeof ORG_REALTIME_CHANNELS)[number];

export const orgRealtimeServiceDeps = {
  createSupabaseAdminClient,
  getExecutionQueueBacklog,
};

type TableCursor = {
  count: number;
  latestId: string | null;
  latestTimestamp: string | null;
};

function getClient() {
  return orgRealtimeServiceDeps.createSupabaseAdminClient();
}

async function getOrganizationTableCursor(params: {
  table:
    | "audit_logs"
    | "workflow_ingestion_events"
    | "workflow_runs";
  organizationId: string;
  timestampColumn: "created_at" | "updated_at";
}): Promise<TableCursor> {
  const supabase = getClient();
  const [countResult, latestResult] = await Promise.all([
    supabase
      .from(params.table)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", params.organizationId),
    supabase
      .from(params.table)
      .select(`id, ${params.timestampColumn}`)
      .eq("organization_id", params.organizationId)
      .order(params.timestampColumn, { ascending: false })
      .limit(1)
      .returns<Record<string, unknown>[]>(),
  ]);

  if (countResult.error) {
    throw new Error(
      `Failed to count ${params.table} for org realtime updates: ${countResult.error.message}`,
    );
  }
  if (latestResult.error) {
    throw new Error(
      `Failed to load latest ${params.table} for org realtime updates: ${latestResult.error.message}`,
    );
  }

  const latestRow = latestResult.data?.[0];
  const latestTimestampValue = latestRow?.[params.timestampColumn];

  return {
    count: countResult.count ?? 0,
    latestId: typeof latestRow?.id === "string" ? latestRow.id : null,
    latestTimestamp:
      typeof latestTimestampValue === "string" ? latestTimestampValue : null,
  };
}

export async function getOrganizationRealtimeVersion(params: {
  organizationId: string;
  channel: OrgRealtimeChannel;
}): Promise<string> {
  if (params.channel === "audit") {
    return JSON.stringify(
      await getOrganizationTableCursor({
        table: "audit_logs",
        organizationId: params.organizationId,
        timestampColumn: "created_at",
      }),
    );
  }

  if (params.channel === "streams") {
    return JSON.stringify(
      await getOrganizationTableCursor({
        table: "workflow_ingestion_events",
        organizationId: params.organizationId,
        timestampColumn: "created_at",
      }),
    );
  }

  if (params.channel === "executions") {
    return JSON.stringify(
      await getOrganizationTableCursor({
        table: "workflow_runs",
        organizationId: params.organizationId,
        timestampColumn: "updated_at",
      }),
    );
  }

  const [audit, streams, executions, queue] = await Promise.all([
    getOrganizationTableCursor({
      table: "audit_logs",
      organizationId: params.organizationId,
      timestampColumn: "created_at",
    }),
    getOrganizationTableCursor({
      table: "workflow_ingestion_events",
      organizationId: params.organizationId,
      timestampColumn: "created_at",
    }),
    getOrganizationTableCursor({
      table: "workflow_runs",
      organizationId: params.organizationId,
      timestampColumn: "updated_at",
    }),
    orgRealtimeServiceDeps.getExecutionQueueBacklog(),
  ]);

  return JSON.stringify({
    audit,
    streams,
    executions,
    queue,
  });
}
