"use client";

import { useEffect } from "react";
import type { AuditLogWithActor } from "@/lib/server/audit-log";
import type { DashboardSummary } from "@/lib/server/org-service";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

type DashboardStoreHydratorProps = {
  summary: DashboardSummary;
  recentActivity: AuditLogWithActor[];
};

export function DashboardStoreHydrator({
  summary,
  recentActivity,
}: DashboardStoreHydratorProps) {
  const setDashboardData = useWorkspaceStore((state) => state.setDashboardData);

  useEffect(() => {
    setDashboardData({
      summary,
      recentActivity,
    });
  }, [recentActivity, setDashboardData, summary]);

  return null;
}
