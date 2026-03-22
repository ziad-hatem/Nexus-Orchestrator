"use client";

import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  addEdge,
  applyNodeChanges,
  Background,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import { Crosshair, GitBranch, Link2, RadioTower, Workflow } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/utils";
import type {
  WorkflowActionType,
  WorkflowCanvas,
  WorkflowCanvasNode,
  WorkflowNodeType,
} from "@/lib/server/workflows/types";
import {
  createWorkflowEdgeId,
  getWorkflowActionTypeLabel,
} from "@/lib/server/workflows/types";

type WorkflowReactFlowCanvasProps = {
  canvas: WorkflowCanvas;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onOpenInspector: (nodeId: string) => void;
  onCanvasChange: (canvas: WorkflowCanvas) => void;
  onCreateNode: (
    nodeType: WorkflowNodeType,
    position?: WorkflowCanvasNode["position"],
  ) => string | null;
};

type FlowNodeData = {
  label: string;
  description: string;
  nodeType: WorkflowNodeType;
  actionType: WorkflowActionType | null;
};

type WorkflowFlowNode = Node<FlowNodeData, "workflowNode">;
type WorkflowFlowEdge = Edge;

const NODE_WIDTH = 288;
const NODE_HEIGHT = 160;
const SNAP_GRID: [number, number] = [24, 24];
const NODE_MIME_TYPE = "application/x-nexus-workflow-node";

const FLOW_NODE_ICONS = {
  trigger: RadioTower,
  condition: GitBranch,
  action: Workflow,
} as const satisfies Record<WorkflowNodeType, typeof Workflow>;

const EDGE_TONES = {
  trigger: {
    stroke: "var(--primary)",
    glow:
      "drop-shadow(0 0 10px color-mix(in srgb, var(--primary) 26%, transparent))",
    minimap: "var(--primary)",
  },
  condition: {
    stroke: "#f59e0b",
    glow: "drop-shadow(0 0 10px rgba(245,158,11,0.25))",
    minimap: "#f59e0b",
  },
  action: {
    stroke: "#10b981",
    glow: "drop-shadow(0 0 10px rgba(16,185,129,0.22))",
    minimap: "#10b981",
  },
} as const;

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function snapToGrid(value: number): number {
  return Math.round(value / SNAP_GRID[0]) * SNAP_GRID[0];
}

function snapPosition(position: WorkflowCanvasNode["position"]) {
  return {
    x: snapToGrid(position.x),
    y: snapToGrid(position.y),
  };
}

function canConnectNodes(params: {
  sourceNode: WorkflowCanvasNode | undefined;
  targetNode: WorkflowCanvasNode | undefined;
}) {
  const { sourceNode, targetNode } = params;
  if (!sourceNode || !targetNode) {
    return false;
  }

  if (sourceNode.id === targetNode.id) {
    return false;
  }

  if (sourceNode.type === "action") {
    return false;
  }

  if (targetNode.type === "trigger") {
    return false;
  }

  return true;
}

function normalizeCanvas(canvas: WorkflowCanvas): WorkflowCanvas {
  const validNodeIds = new Set(canvas.nodes.map((node) => node.id));
  const seenEdges = new Set<string>();

  return {
    nodes: canvas.nodes.map((node) => ({
      ...node,
      position: snapPosition(node.position),
    })),
    edges: canvas.edges.filter((edge) => {
      if (
        !validNodeIds.has(edge.source) ||
        !validNodeIds.has(edge.target) ||
        edge.source === edge.target
      ) {
        return false;
      }

      const key = `${edge.source}:${edge.branchKey ?? "default"}->${edge.target}`;
      if (seenEdges.has(key)) {
        return false;
      }

      seenEdges.add(key);
      return true;
    }),
  };
}

function getEdgeTone(nodeType: WorkflowNodeType) {
  return EDGE_TONES[nodeType];
}

function createFlowNode(
  node: WorkflowCanvasNode,
  isSelected: boolean,
): WorkflowFlowNode {
  return {
    id: node.id,
    type: "workflowNode",
    position: node.position,
    data: {
      label: node.label,
      description: node.description,
      nodeType: node.type,
      actionType:
        node.type === "action" && typeof node.config.actionType === "string"
          ? (node.config.actionType as WorkflowActionType)
          : null,
    },
    selected: isSelected,
    draggable: true,
    deletable: false,
    selectable: true,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    style: {
      width: NODE_WIDTH,
      minWidth: NODE_WIDTH,
    },
  };
}

function createFlowEdge(
  edge: WorkflowCanvas["edges"][number],
  nodeMap: Map<string, WorkflowCanvasNode>,
): WorkflowFlowEdge {
  const sourceNode = nodeMap.get(edge.source);
  const tone = getEdgeTone(sourceNode?.type ?? "action");

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: "default",
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: tone.stroke,
      width: 18,
      height: 18,
    },
    style: {
      stroke: tone.stroke,
      strokeWidth: 3,
      filter: tone.glow,
    },
  };
}

function exportCanvas(
  flowNodes: WorkflowFlowNode[],
  flowEdges: WorkflowFlowEdge[],
  sourceCanvas: WorkflowCanvas,
): WorkflowCanvas {
  const flowNodeMap = new Map(flowNodes.map((node) => [node.id, node]));

  return normalizeCanvas({
    nodes: sourceCanvas.nodes.map((node) => {
      const flowNode = flowNodeMap.get(node.id);
      return {
        ...node,
        position: flowNode
          ? snapPosition(flowNode.position)
          : snapPosition(node.position),
      };
    }),
    edges: flowEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      branchKey: null,
    })),
  });
}

function WorkflowCanvasNodeCard({
  data,
  selected,
}: NodeProps<WorkflowFlowNode>) {
  const Icon = FLOW_NODE_ICONS[data.nodeType];
  const canAcceptConnection = data.nodeType !== "trigger";
  const canStartConnection = data.nodeType !== "action";
  const actionTypeLabel =
    data.nodeType === "action" && data.actionType
      ? getWorkflowActionTypeLabel(data.actionType)
      : null;

  return (
    <div
      className={cn(
        "workflow-node-card__body",
        selected && "workflow-node-card__body--selected",
      )}
    >
      {canAcceptConnection ? (
        <Handle
          type="target"
          position={Position.Left}
          className="workflow-node-handle workflow-node-handle--input"
          isConnectableStart={false}
          aria-label={`Connect into ${data.label || data.nodeType}`}
        />
      ) : null}

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
            flowNodeAccent(data.nodeType),
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--surface-container-high)] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
              {data.nodeType}
            </span>
            {actionTypeLabel ? (
              <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-200">
                {actionTypeLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-3 truncate text-sm font-semibold text-[var(--on-surface)]">
            {data.label || "Untitled node"}
          </p>
          <p className="mt-2 min-h-[2.5rem] text-xs leading-5 text-[var(--on-surface-variant)]">
            {data.description || "No description set yet."}
          </p>
        </div>
      </div>

      {canStartConnection ? (
        <Handle
          id="default"
          type="source"
          position={Position.Right}
          className="workflow-node-handle workflow-node-handle--output"
          isConnectableEnd={false}
          aria-label={`Start connection from ${data.label || data.nodeType}`}
        />
      ) : null}
    </div>
  );
}

const nodeTypes = {
  workflowNode: WorkflowCanvasNodeCard,
};

export function WorkflowReactFlowCanvas({
  canvas,
  selectedNodeId,
  onSelectNode,
  onOpenInspector,
  onCanvasChange,
  onCreateNode,
}: WorkflowReactFlowCanvasProps) {
  const reactFlowRef = useRef<ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge> | null>(
    null,
  );
  const nodeMap = useMemo(
    () => new Map(canvas.nodes.map((node) => [node.id, node])),
    [canvas.nodes],
  );
  const flowNodes = useMemo(
    () =>
      canvas.nodes.map((node) =>
        createFlowNode(node, node.id === selectedNodeId),
      ),
    [canvas.nodes, selectedNodeId],
  );
  const flowEdges = useMemo(
    () => canvas.edges.map((edge) => createFlowEdge(edge, nodeMap)),
    [canvas.edges, nodeMap],
  );
  const [isConnecting, setIsConnecting] = useState(false);

  const handleNodesChange = (changes: NodeChange<WorkflowFlowNode>[]) => {
    const hasPositionChange = changes.some((change) => change.type === "position");
    if (!hasPositionChange) {
      return;
    }

    const nextNodes = applyNodeChanges(changes, flowNodes);
    onCanvasChange(exportCanvas(nextNodes, flowEdges, canvas));
  };

  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) {
      return;
    }

    const sourceNode = nodeMap.get(connection.source);
    const targetNode = nodeMap.get(connection.target);
    if (
      !canConnectNodes({
        sourceNode,
        targetNode,
      })
    ) {
      return;
    }

    const tone = getEdgeTone(sourceNode?.type ?? "action");
    const edgeId = createWorkflowEdgeId(
      connection.source,
      connection.target,
      null,
    );
    const baseEdges =
      sourceNode?.type === "condition" || sourceNode?.type === "trigger"
        ? flowEdges.filter(
            (edge) =>
              edge.source !== connection.source,
          )
        : flowEdges;

    const nextEdges = addEdge(
      {
        ...connection,
        id: edgeId,
        sourceHandle: "default",
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: tone.stroke,
          width: 18,
          height: 18,
        },
        style: {
          stroke: tone.stroke,
          strokeWidth: 3,
          filter: tone.glow,
        },
      },
      baseEdges,
    );

    onCanvasChange(exportCanvas(flowNodes, nextEdges, canvas));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const reactFlow = reactFlowRef.current;
    if (!reactFlow) {
      return;
    }

    const nodeType = event.dataTransfer.getData(NODE_MIME_TYPE) as
      | WorkflowNodeType
      | "";

    if (!nodeType) {
      return;
    }

    const flowPosition = reactFlow.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const nextPosition = {
      x: clamp(snapToGrid(flowPosition.x - NODE_WIDTH / 2), 0, 2000),
      y: clamp(snapToGrid(flowPosition.y - NODE_HEIGHT / 2), 0, 2000),
    };

    const createdNodeId = onCreateNode(nodeType, nextPosition);
    if (createdNodeId) {
      onSelectNode(createdNodeId);
    }
  };

  const handleCenterView = () => {
    reactFlowRef.current?.fitView({
      padding: 0.2,
      duration: 300,
      minZoom: 0.5,
      maxZoom: 1.2,
    });
  };

  return (
    <section
      className="glass-panel workflow-flow flex min-h-[48rem] flex-col overflow-hidden rounded-[1.75rem] xl:min-h-0"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={handleDrop}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] px-5 py-5 sm:px-6">
        <div>
          <p className="label-caps">Canvas</p>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
            Drag, connect, and arrange nodes
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isConnecting ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Link2 className="h-3.5 w-3.5" />
              Drag into another handle to connect
            </div>
          ) : null}

          <div className="inline-flex rounded-full bg-[var(--surface-container-low)] px-3 py-1 text-xs font-semibold text-[var(--on-surface-variant)]">
            {canvas.nodes.length} node{canvas.nodes.length === 1 ? "" : "s"} /{" "}
            {canvas.edges.length} connection
            {canvas.edges.length === 1 ? "" : "s"}
          </div>

          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={handleCenterView}
          >
            <Crosshair className="h-4 w-4" />
            Center view
          </Button>
        </div>
      </div>

      <div className="relative h-[48rem] min-h-[48rem] overflow-hidden xl:h-[calc(100vh-15rem)] xl:min-h-[62rem]">
        <ReactFlow<WorkflowFlowNode, WorkflowFlowEdge>
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onInit={(instance) => {
            reactFlowRef.current = instance;
            requestAnimationFrame(() => {
              instance.fitView({
                padding: 0.2,
                duration: 0,
                minZoom: 0.5,
                maxZoom: 1.2,
              });
            });
          }}
          onNodesChange={handleNodesChange}
          onConnect={handleConnect}
          onConnectStart={() => setIsConnecting(true)}
          onConnectEnd={() => setIsConnecting(false)}
          onNodeClick={(_event, node) => onSelectNode(node.id)}
          onNodeDoubleClick={(_event, node) => {
            onSelectNode(node.id);
            onOpenInspector(node.id);
          }}
          onPaneClick={() => onSelectNode(null)}
          isValidConnection={(connection) =>
            canConnectNodes({
              sourceNode: connection.source
                ? nodeMap.get(connection.source)
                : undefined,
              targetNode: connection.target
                ? nodeMap.get(connection.target)
                : undefined,
            })
          }
          connectionLineType={ConnectionLineType.Bezier}
          connectionLineStyle={{
            stroke: "var(--primary)",
            strokeWidth: 3,
            filter:
              "drop-shadow(0 0 14px color-mix(in srgb, var(--primary) 32%, transparent))",
          }}
          connectionMode={ConnectionMode.Strict}
          snapToGrid
          snapGrid={SNAP_GRID}
          nodesConnectable
          nodesDraggable
          elementsSelectable
          panOnDrag
          panOnScroll
          selectionOnDrag
          zoomOnDoubleClick={false}
          deleteKeyCode={null}
          minZoom={0.35}
          maxZoom={1.8}
          fitView
          fitViewOptions={{
            padding: 0.2,
            minZoom: 0.5,
            maxZoom: 1.2,
          }}
          proOptions={{ hideAttribution: true }}
          className="workflow-flow__board"
        >
          <Background
            gap={24}
            size={1}
            color="color-mix(in srgb, var(--outline-variant) 22%, transparent)"
          />
          <MiniMap
            pannable
            zoomable
            nodeBorderRadius={18}
            nodeStrokeWidth={3}
            className="workflow-flow__minimap"
            nodeColor={(node) =>
              EDGE_TONES[(node.data as FlowNodeData).nodeType].minimap
            }
          />
          <Controls
            position="bottom-right"
            className="workflow-flow__controls"
            showInteractive={false}
          />
        </ReactFlow>

        {canvas.nodes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-md rounded-[1.75rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] bg-[color:color-mix(in_srgb,var(--surface-container-lowest)_88%,transparent)] px-6 py-6 text-center shadow-[0_20px_44px_rgba(11,28,48,0.12)] backdrop-blur-md">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--surface-container-high)] text-primary">
                <Workflow className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-[var(--on-surface)]">
                The workflow canvas is empty
              </h3>
              <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                Drag a trigger, condition, or action from the palette to start
                laying out this workflow.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
