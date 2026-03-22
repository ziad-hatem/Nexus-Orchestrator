"use client";

import { useEffect } from "react";
import type { AuditLogWithActor } from "@/lib/server/audit-log";
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
};

export function AuditStoreHydrator({
  logs,
  total,
  page,
  pageSize,
  filters,
  availableActions,
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
    });
  }, [
    availableActions,
    filters,
    logs,
    page,
    pageSize,
    setAuditFeed,
    total,
  ]);

  return null;
}
