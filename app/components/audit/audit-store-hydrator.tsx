"use client";

import { useEffect } from "react";
import type {
  AuditLogSummary,
  AuditLogWithActor,
} from "@/lib/server/audit-log";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

type AuditStoreHydratorProps = {
  logs: AuditLogWithActor[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    query?: string;
    action?: string;
  };
  availableActions: string[];
  summary: AuditLogSummary;
};

export function AuditStoreHydrator({
  logs,
  total,
  page,
  pageSize,
  filters,
  availableActions,
  summary,
}: AuditStoreHydratorProps) {
  const setAuditFeed = useWorkspaceStore((state) => state.setAuditFeed);

  useEffect(() => {
    setAuditFeed({
      logs,
      total,
      page,
      pageSize,
      filters,
      availableActions,
      summary,
    });
  }, [
    availableActions,
    filters,
    logs,
    page,
    pageSize,
    setAuditFeed,
    summary,
    total,
  ]);

  return null;
}
