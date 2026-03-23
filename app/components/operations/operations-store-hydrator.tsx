"use client";

import { useEffect } from "react";
import type { OperationsDashboardData } from "@/lib/server/operations/types";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

export function OperationsStoreHydrator({
  snapshot,
}: {
  snapshot: OperationsDashboardData;
}) {
  const setOperationsSnapshot = useWorkspaceStore(
    (state) => state.setOperationsSnapshot,
  );

  useEffect(() => {
    setOperationsSnapshot(snapshot);
  }, [setOperationsSnapshot, snapshot]);

  return null;
}
