"use client";

import type {
  WorkflowIngestionEventSummary,
  WorkflowTriggerDetails,
} from "@/lib/server/workflows/types";
import { WorkflowStoreHydrator } from "@/app/components/workflows/workflow-store-hydrator";

type WorkflowTriggerStoreHydratorProps = {
  trigger?: WorkflowTriggerDetails | null;
  streams?: {
    items: WorkflowIngestionEventSummary[];
    total: number;
    page: number;
    pageSize: number;
  };
};

export function WorkflowTriggerStoreHydrator({
  trigger,
  streams,
}: WorkflowTriggerStoreHydratorProps) {
  return <WorkflowStoreHydrator trigger={trigger} streams={streams} />;
}
