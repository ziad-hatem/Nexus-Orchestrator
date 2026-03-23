"use client";

import { useEffect } from "react";
import type {
  WorkflowRunDetail,
  WorkflowRunListSummary,
  WorkflowRunSummary,
} from "@/lib/server/workflows/types";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

type ExecutionStoreHydratorProps = {
  directory?: {
    items: WorkflowRunSummary[];
    summary: WorkflowRunListSummary;
    total: number;
    page: number;
    pageSize: number;
    filters: {
      query?: string;
      status?: WorkflowRunSummary["status"];
      source?: WorkflowRunSummary["triggerSource"];
      workflowId?: string;
    };
  };
  detail?: WorkflowRunDetail | null;
};

export function ExecutionStoreHydrator({
  directory,
  detail,
}: ExecutionStoreHydratorProps) {
  const setExecutionDirectory = useWorkspaceStore(
    (state) => state.setExecutionDirectory,
  );
  const setExecutionDetail = useWorkspaceStore(
    (state) => state.setExecutionDetail,
  );

  useEffect(() => {
    if (directory === undefined) {
      return;
    }

    setExecutionDirectory(directory);
  }, [directory, setExecutionDirectory]);

  useEffect(() => {
    if (detail === undefined) {
      return;
    }

    setExecutionDetail(detail);
  }, [detail, setExecutionDetail]);

  return null;
}
