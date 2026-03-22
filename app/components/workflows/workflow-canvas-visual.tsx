"use client";

import { ArrowRight, GitBranch, Play, RadioTower, Workflow } from "lucide-react";
import type { WorkflowCanvas } from "@/lib/server/workflows/types";
import { cn } from "@/app/components/ui/utils";

type WorkflowCanvasVisualProps = {
  canvas: WorkflowCanvas;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  readOnly?: boolean;
  className?: string;
};

function nodeIcon(nodeType: string) {
  switch (nodeType) {
    case "trigger":
      return RadioTower;
    case "condition":
      return GitBranch;
    case "action":
    default:
      return Workflow;
  }
}

function nodeAccent(nodeType: string): string {
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

export function WorkflowCanvasVisual({
  canvas,
  selectedNodeId,
  onSelectNode,
  readOnly = false,
  className,
}: WorkflowCanvasVisualProps) {
  if (canvas.nodes.length === 0) {
    return (
      <div
        className={cn(
          "glass-panel flex min-h-[18rem] items-center justify-center rounded-[1.75rem] p-8 text-center",
          className,
        )}
      >
        <div className="max-w-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--surface-container-high)] text-primary">
            <Play className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-[var(--on-surface)]">
            The workflow canvas is empty
          </h2>
          <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
            Add a trigger and at least one action to generate a publishable workflow graph.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      className={cn(
        "glass-panel overflow-hidden rounded-[1.75rem] p-5 sm:p-6",
        className,
      )}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="label-caps">Canvas</p>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
            Automation flow
          </h2>
        </div>
        <div className="text-xs text-[var(--on-surface-variant)]">
          {readOnly
            ? "Published snapshot"
            : "Select a node to edit its safe draft configuration"}
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-center gap-4">
          {canvas.nodes.map((node, index) => {
            const Icon = nodeIcon(node.type);
            const selected = selectedNodeId === node.id;

            return (
              <div key={node.id} className="flex items-center gap-4">
                <button
                  type="button"
                  className={cn(
                    "group w-[18rem] rounded-[1.5rem] border p-4 text-left transition",
                    selected
                      ? "border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] shadow-[0_12px_30px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
                      : "border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--surface-container-lowest)] hover:bg-[var(--surface-container-low)]",
                    readOnly && "cursor-default",
                  )}
                  disabled={readOnly || !onSelectNode}
                  onClick={() => onSelectNode?.(node.id)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                        nodeAccent(node.type),
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded-full bg-[var(--surface-container-high)] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
                          {node.type}
                        </span>
                      </div>
                      <h3 className="mt-3 truncate text-base font-semibold text-[var(--on-surface)]">
                        {node.label || "Untitled node"}
                      </h3>
                      <p className="mt-2 min-h-[2.75rem] text-sm leading-6 text-[var(--on-surface-variant)]">
                        {node.description || "No description set yet."}
                      </p>
                    </div>
                  </div>
                </button>

                {index < canvas.nodes.length - 1 ? (
                  <div className="flex items-center gap-2 px-1 text-[var(--outline)]">
                    <div className="h-px w-8 bg-current opacity-60" />
                    <ArrowRight className="h-4 w-4" />
                    <div className="h-px w-8 bg-current opacity-60" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
