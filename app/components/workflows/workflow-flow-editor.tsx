"use client";

import dynamic from "next/dynamic";
import type { DragEvent } from "react";
import { GitBranch, RadioTower, Sparkles, Workflow } from "lucide-react";
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
};

const WorkflowReactFlowCanvas = dynamic(
  () =>
    import("./workflow-react-flow-canvas").then(
      (module) => module.WorkflowReactFlowCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <section className="glass-panel flex min-h-[48rem] items-center justify-center rounded-[1.75rem] xl:min-h-0">
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
          <p className="text-sm font-semibold text-[var(--on-surface)]">{title}</p>
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
}: WorkflowFlowEditorProps) {
  return (
    <section className="grid gap-4 xl:h-full xl:min-h-0 xl:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="glass-panel rounded-[1.75rem] p-5 sm:p-6 xl:overflow-y-auto">
        <p className="label-caps">Node palette</p>
        <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
          Drag nodes into the canvas
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
          Drop a node anywhere, connect it from handle to handle, then
          double-click any node to open the popup inspector.
        </p>

        <div className="mt-6 space-y-3">
          <NodePaletteCard
            nodeType="trigger"
            title="Trigger"
            description="Only one trigger can start the workflow."
            disabled={hasTrigger}
          />
          <NodePaletteCard
            nodeType="condition"
            title="Condition"
            description="Gate the flow with a payload or context rule before actions continue."
          />
          <NodePaletteCard
            nodeType="action"
            title="Action"
            description="Send webhooks, deliver email, create tasks, or update tenant-safe records."
          />
        </div>

        <div className="mt-6 rounded-[1.5rem] bg-[var(--surface-container-low)] p-4">
          <div className="flex items-start gap-3">
            <div className="premium-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--on-surface)]">
                Builder tips
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--on-surface-variant)]">
                React Flow now powers the board, so you can drag nodes freely,
                connect from the glowing handles, and keep editing inside the
                popup inspector without managing extra branch labels.
              </p>
            </div>
          </div>
        </div>
      </aside>

      <WorkflowReactFlowCanvas
        canvas={canvas}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        onOpenInspector={onOpenInspector}
        onCanvasChange={onCanvasChange}
        onCreateNode={onCreateNode}
      />
    </section>
  );
}
