"use client";

import dynamic from "next/dynamic";
import { useState, type DragEvent } from "react";
import {
  ChevronRight,
  GitBranch,
  RadioTower,
  Sparkles,
  Workflow,
} from "lucide-react";
import type {
  WorkflowCanvas,
  WorkflowCanvasNode,
  WorkflowNodeType,
} from "@/lib/server/workflows/types";
import { cn } from "@/app/components/ui/utils";

type WorkflowFlowEditorProps = {
  canvas: WorkflowCanvas;
  hasTrigger: boolean;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onOpenInspector: (nodeId: string) => void;
  onCanvasChange: (canvas: WorkflowCanvas) => void;
  onCreateNode: (
    nodeType: WorkflowNodeType,
    position?: WorkflowCanvasNode["position"],
  ) => string | null;
  onDeleteNode: (nodeId: string) => void;
};

type WorkflowReactFlowCanvasProps = Omit<WorkflowFlowEditorProps, "hasTrigger">;

const WorkflowReactFlowCanvas = dynamic(
  () =>
    import("./workflow-react-flow-canvas").then(
      (module) => module.WorkflowReactFlowCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <section className="glass-panel flex h-[48rem] min-h-[48rem] items-center justify-center rounded-[1.75rem] xl:h-[calc(100vh-15rem)] xl:min-h-[62rem]">
        <div className="max-w-sm rounded-[1.5rem] bg-[var(--surface-container-low)] px-6 py-5 text-center">
          <p className="label-caps">Canvas</p>
          <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
            Loading the workflow canvas...
          </p>
        </div>
      </section>
    ),
  },
);

const FLOW_NODE_ICONS = {
  trigger: RadioTower,
  condition: GitBranch,
  action: Workflow,
} as const satisfies Record<WorkflowNodeType, typeof Workflow>;

const NODE_MIME_TYPE = "application/x-nexus-workflow-node";

function flowNodeAccent(nodeType: WorkflowNodeType): string {
  switch (nodeType) {
    case "trigger":
      return "bg-primary text-white";
    case "condition":
      return "bg-amber-500/14 text-amber-800 dark:text-amber-200";
    case "action":
    default:
      return "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200";
  }
}

function NodePaletteCard({
  nodeType,
  title,
  description,
  disabled = false,
}: {
  nodeType: WorkflowNodeType;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  const Icon = FLOW_NODE_ICONS[nodeType];

  const handleDragStart = (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData(NODE_MIME_TYPE, nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <button
      type="button"
      draggable={!disabled}
      disabled={disabled}
      onDragStart={handleDragStart}
      className={cn(
        "w-full rounded-[1.3rem] border p-4 text-left transition",
        disabled
          ? "cursor-not-allowed border-[color:color-mix(in_srgb,var(--outline-variant)_42%,transparent)] bg-[var(--surface-container-low)] opacity-55"
          : "border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] bg-[var(--surface-container-lowest)] hover:bg-[var(--surface-container-low)]",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
            flowNodeAccent(nodeType),
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--on-surface)]">
            {title}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--on-surface-variant)]">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

export function WorkflowFlowEditor({
  canvas,
  hasTrigger,
  selectedNodeId,
  onSelectNode,
  onOpenInspector,
  onCanvasChange,
  onCreateNode,
  onDeleteNode,
}: WorkflowFlowEditorProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <section className="relative xl:h-full xl:min-h-0">
      {/* ── Collapsible palette overlay ── */}
      <div
        className={cn(
          "absolute left-0 top-0 z-30 hidden h-full w-[17rem] transition-transform duration-300 ease-in-out xl:block",
          paletteOpen ? "translate-x-0" : "-translate-x-[13.75rem]",
        )}
        onMouseEnter={() => setPaletteOpen(true)}
        onMouseLeave={() => setPaletteOpen(false)}
      >
        <aside className="glass-panel relative h-full overflow-y-auto rounded-l-[1.75rem] rounded-r-[1.25rem] p-5 shadow-[4px_0_24px_rgba(11,28,48,0.10)]">
          {/* Collapsed indicator — pinned to the right edge, fades out when open */}
          <div
            className={cn(
              "absolute right-0 top-0 flex h-full w-[3.25rem] flex-col items-center justify-center gap-3 transition-opacity duration-200",
              paletteOpen ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <ChevronRight className="h-5 w-5 animate-pulse text-[var(--on-surface-variant)]" />
            <div className="flex flex-col items-center gap-2">
              <RadioTower className="h-4 w-4 text-primary" />
              <GitBranch className="h-4 w-4 text-amber-500" />
              <Workflow className="h-4 w-4 text-emerald-500" />
            </div>
          </div>

          {/* Full palette content — always laid out, just fades in/out */}
          <div
            className={cn(
              "transition-opacity duration-200",
              paletteOpen ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <p className="label-caps">Node palette</p>
            <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-[var(--on-surface)]">
              Drag nodes
            </h2>
            <p className="mt-2 text-xs leading-5 text-[var(--on-surface-variant)]">
              Drop a node anywhere, connect it, then double-click to inspect.
            </p>

            <div className="mt-5 space-y-3">
              <NodePaletteCard
                nodeType="trigger"
                title="Trigger"
                description="Only one trigger can start the workflow."
                disabled={hasTrigger}
              />
              <NodePaletteCard
                nodeType="condition"
                title="Condition"
                description="Gate the flow with a payload or context rule."
              />
              <NodePaletteCard
                nodeType="action"
                title="Action"
                description="Webhooks, email, tasks, or record updates."
              />
            </div>

            <div className="mt-5 rounded-[1.5rem] bg-[var(--surface-container-low)] p-4">
              <div className="flex items-start gap-3">
                <div className="premium-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--on-surface)]">
                    Tips
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-[var(--on-surface-variant)]">
                    Drag nodes freely, connect from handles, press Delete to
                    remove selected nodes or edges.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Mobile palette (always visible, no hover trick) ── */}
      <aside className="glass-panel rounded-[1.75rem] p-5 sm:p-6 xl:hidden">
        <p className="label-caps">Node palette</p>
        <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
          Drag nodes into the canvas
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <NodePaletteCard
            nodeType="trigger"
            title="Trigger"
            description="Only one trigger can start the workflow."
            disabled={hasTrigger}
          />
          <NodePaletteCard
            nodeType="condition"
            title="Condition"
            description="Gate the flow with a payload or context rule."
          />
          <NodePaletteCard
            nodeType="action"
            title="Action"
            description="Webhooks, email, tasks, or record updates."
          />
        </div>
      </aside>

      {/* ── Full-width canvas ── */}
      <WorkflowReactFlowCanvas
        canvas={canvas}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        onOpenInspector={onOpenInspector}
        onCanvasChange={onCanvasChange}
        onCreateNode={onCreateNode}
        onDeleteNode={onDeleteNode}
      />
    </section>
  );
}
