import {
  CheckCircle2,
  Clock3,
  Loader2,
  OctagonAlert,
  PauseCircle,
  XCircle,
} from "lucide-react";
import type { WorkflowRunStepRecord } from "@/lib/server/workflows/types";

type ExecutionStepTimelineProps = {
  steps: WorkflowRunStepRecord[];
};

function iconForStatus(status: WorkflowRunStepRecord["status"]) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "running":
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-destructive" />;
    case "cancelled":
      return <PauseCircle className="h-5 w-5 text-amber-500" />;
    case "skipped":
      return <OctagonAlert className="h-5 w-5 text-slate-500" />;
    case "pending":
    default:
      return <Clock3 className="h-5 w-5 text-slate-500" />;
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function toReadableValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return value || '""';
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    Array.isArray(value)
  ) {
    return JSON.stringify(value);
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return "undefined";
}

export function ExecutionStepTimeline({ steps }: ExecutionStepTimelineProps) {
  return (
    <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
      <p className="label-caps">Step execution</p>
      <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
        Persisted execution timeline
      </h2>

      <div className="mt-6 space-y-4">
        {steps.length > 0 ? (
          steps.map((step) => {
            const conditionOutput =
              step.nodeType === "condition" ? toRecord(step.outputPayload) : null;
            const matched =
              conditionOutput && typeof conditionOutput.matched === "boolean"
                ? conditionOutput.matched
                : null;
            const terminationReason =
              conditionOutput &&
              typeof conditionOutput.terminationReason === "string"
                ? conditionOutput.terminationReason
                : null;

            return (
              <article
                key={step.stepId}
                className="rounded-[1.5rem] bg-[var(--surface-container-low)] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-[var(--surface-container-high)] p-3">
                      {iconForStatus(step.status)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--on-surface)]">
                          {step.nodeLabel}
                        </p>
                        <span className="rounded-full bg-[var(--surface-container-high)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
                          {step.nodeType}
                        </span>
                        <span className="rounded-full bg-[var(--surface-container-high)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
                          Attempt {step.attemptNumber}
                        </span>
                        {step.branchTaken ? (
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                            {step.branchTaken} branch
                          </span>
                        ) : null}
                        {matched !== null ? (
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                              matched
                                ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200"
                                : "bg-amber-500/12 text-amber-800 dark:text-amber-200"
                            }`}
                          >
                            {matched ? "Matched" : "Not matched"}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
                        Sequence {step.sequenceNumber} | Correlation {step.correlationId}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-[var(--on-surface-variant)]">
                    <p>Started: {step.startedAt ?? "Not started"}</p>
                    <p className="mt-1">
                      Completed: {step.completedAt ?? "In progress"}
                    </p>
                  </div>
                </div>

                {step.errorMessage ? (
                  <div className="mt-4 rounded-2xl bg-[var(--error-container)]/70 px-4 py-3 text-sm text-[var(--error)]">
                    {step.errorMessage}
                  </div>
                ) : null}

                {conditionOutput ? (
                  <div className="mt-4 rounded-2xl bg-[var(--surface-container-high)] p-4">
                    <p className="label-caps">Condition result</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                        <p className="label-caps">Resolver</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                          {String(conditionOutput.resolverScope ?? "payload")}.
                          {String(conditionOutput.resolverPath ?? "")}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                        <p className="label-caps">Operator</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                          {String(conditionOutput.operator ?? "unknown")}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                        <p className="label-caps">Expected value</p>
                        <p className="mt-2 break-all text-sm font-semibold text-[var(--on-surface)]">
                          {toReadableValue(conditionOutput.expectedValue)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                        <p className="label-caps">Resolved value</p>
                        <p className="mt-2 break-all text-sm font-semibold text-[var(--on-surface)]">
                          {toReadableValue(conditionOutput.resolvedValue)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                        <p className="label-caps">Next step</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                          {String(conditionOutput.nextNodeId ?? "None")}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                        <p className="label-caps">Termination</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                          {terminationReason ?? "continued"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl bg-[#0b1c30] p-4">
                    <p className="label-caps text-blue-100/80">Input payload</p>
                    <pre className="mt-3 overflow-x-auto text-xs text-blue-100">
                      {JSON.stringify(step.inputPayload, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-2xl bg-[#0b1c30] p-4">
                    <p className="label-caps text-blue-100/80">Output payload</p>
                    <pre className="mt-3 overflow-x-auto text-xs text-blue-100">
                      {JSON.stringify(step.outputPayload, null, 2)}
                    </pre>
                  </div>
                </div>

                {step.logs.length > 0 ? (
                  <div className="mt-4 rounded-2xl bg-[var(--surface-container-high)] p-4">
                    <p className="label-caps">Execution logs</p>
                    <div className="mt-3 space-y-2">
                      {step.logs.map((log, index) => (
                        <div
                          key={`${step.stepId}:log:${index}`}
                          className="rounded-xl bg-[var(--surface-container-low)] px-3 py-2 text-xs text-[var(--on-surface-variant)]"
                        >
                          <p className="font-medium text-[var(--on-surface)]">
                            {typeof log.message === "string"
                              ? log.message
                              : "Log event"}
                          </p>
                          {typeof log.at === "string" ? (
                            <p className="mt-1 text-[11px]">{log.at}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="rounded-[1.5rem] bg-[var(--surface-container-low)] p-5 text-sm text-[var(--on-surface-variant)]">
            No step records have been persisted for this run yet.
          </div>
        )}
      </div>
    </section>
  );
}
