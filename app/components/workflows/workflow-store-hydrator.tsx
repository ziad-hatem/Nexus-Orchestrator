"use client";

import { useEffect } from "react";
import type {
  WorkflowDetail,
  WorkflowDraftState,
  WorkflowIngestionEventSummary,
  WorkflowLifecycleStatus,
  WorkflowPublishedSnapshot,
  WorkflowSummary,
  WorkflowTriggerDetails,
  WorkflowVersionSummary,
} from "@/lib/server/workflows/types";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

type WorkflowStoreHydratorProps = {
  directory?: {
    items: WorkflowSummary[];
    total: number;
    page: number;
    pageSize: number;
    filters: {
      query?: string;
      status?: WorkflowLifecycleStatus;
      category?: string;
    };
    categories: string[];
  };
  detail?: WorkflowDetail | null;
  draft?: WorkflowDraftState | null;
  trigger?: WorkflowTriggerDetails | null;
  versions?: WorkflowVersionSummary[];
  version?: WorkflowPublishedSnapshot | null;
  streams?: {
    items: WorkflowIngestionEventSummary[];
    total: number;
    page: number;
    pageSize: number;
  };
};

export function WorkflowStoreHydrator({
  directory,
  detail,
  draft,
  trigger,
  versions,
  version,
  streams,
}: WorkflowStoreHydratorProps) {
  const setWorkflowDirectory = useWorkspaceStore(
    (state) => state.setWorkflowDirectory,
  );
  const setWorkflowDetail = useWorkspaceStore((state) => state.setWorkflowDetail);
  const setWorkflowDraft = useWorkspaceStore((state) => state.setWorkflowDraft);
  const setWorkflowVersions = useWorkspaceStore(
    (state) => state.setWorkflowVersions,
  );
  const setWorkflowVersion = useWorkspaceStore((state) => state.setWorkflowVersion);
  const setWorkflowTrigger = useWorkspaceStore((state) => state.setWorkflowTrigger);
  const setWorkflowStreams = useWorkspaceStore((state) => state.setWorkflowStreams);

  useEffect(() => {
    if (!directory) {
      return;
    }

    setWorkflowDirectory(directory);
  }, [directory, setWorkflowDirectory]);

  useEffect(() => {
    if (detail === undefined) {
      return;
    }

    setWorkflowDetail(detail);
  }, [detail, setWorkflowDetail]);

  useEffect(() => {
    if (draft === undefined) {
      return;
    }

    setWorkflowDraft(draft);
  }, [draft, setWorkflowDraft]);

  useEffect(() => {
    if (trigger === undefined) {
      return;
    }

    setWorkflowTrigger(trigger);
  }, [setWorkflowTrigger, trigger]);

  useEffect(() => {
    if (versions === undefined) {
      return;
    }

    setWorkflowVersions(versions);
  }, [setWorkflowVersions, versions]);

  useEffect(() => {
    if (version === undefined) {
      return;
    }

    setWorkflowVersion(version);
  }, [setWorkflowVersion, version]);

  useEffect(() => {
    if (streams === undefined) {
      return;
    }

    setWorkflowStreams(streams);
  }, [setWorkflowStreams, streams]);

  return null;
}
