import { listAuditLogs, type AuditLogWithActor } from "@/lib/server/audit-log";
import {
  getExecutionQueueBacklog,
} from "@/lib/server/executions/queue";
import {
  listWorkflowRunRowsByOrganization,
} from "@/lib/server/executions/repository";
import {
  listWorkflowIngestionEventsByOrganization,
} from "@/lib/server/triggers/repository";
import type { WorkflowRunRow } from "@/lib/server/executions/types";
import type { WorkflowIngestionEventRow } from "@/lib/server/triggers/types";

export type OperationsRepositorySnapshot = {
  runs: WorkflowRunRow[];
  ingestionEvents: WorkflowIngestionEventRow[];
  audit: {
    summary: Awaited<ReturnType<typeof listAuditLogs>>["summary"];
    logs: AuditLogWithActor[];
    total: number;
    availableActions: string[];
  };
  queue: {
    ready: number;
    delayed: number;
  };
};

export async function getOperationsRepositorySnapshot(
  organizationId: string,
): Promise<OperationsRepositorySnapshot> {
  const [runs, ingestionEvents, audit, queue] = await Promise.all([
    listWorkflowRunRowsByOrganization(organizationId),
    listWorkflowIngestionEventsByOrganization(organizationId),
    listAuditLogs(organizationId, {
      page: 1,
      pageSize: 1,
    }),
    getExecutionQueueBacklog(),
  ]);

  return {
    runs,
    ingestionEvents,
    audit,
    queue,
  };
}
