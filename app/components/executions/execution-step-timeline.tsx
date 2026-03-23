import {
  CheckCircle2,
  Clock3,
  Loader2,
  OctagonAlert,
  PauseCircle,
  XCircle,
} from "lucide-react";
import type {
  WorkflowRunAttemptRecord,
  WorkflowRunStepRecord,
} from "@/lib/server/workflows/types";

type ExecutionStepTimelineProps = {
  steps: WorkflowRunStepRecord[];
  attempts?: WorkflowRunAttemptRecord[];
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

function formatLaunchReason(value: WorkflowRunAttemptRecord["launchReason"] | undefined) {
  return (value ?? "initial").replaceAll("_", " ");
}

export function ExecutionStepTimeline({
  steps,
  attempts = [],
}: ExecutionStepTimelineProps) {
  const stepGroups = steps.reduce<Map<number, WorkflowRunStepRecord[]>>((groups, step) => {
    const current = groups.get(step.attemptNumber) ?? [];
    current.push(step);
    groups.set(step.attemptNumber, current);
    return groups;
  }, new Map());
  const attemptLookup = new Map(
    attempts.map((attempt) => [attempt.attemptNumber, attempt]),
  );
  const orderedAttemptNumbers = Array.from(
    new Set([...attemptLookup.keys(), ...stepGroups.keys()]),
  ).sort((left, right) => left - right);

  return (
    <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
      <p className="label-caps">Step execution</p>
      <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
        Persisted execution timeline
      </h2>
      <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
        Payload snapshots and structured logs are redacted automatically for secrets while preserving business context.
      </p>

      <div className="mt-6 space-y-5">
        {orderedAttemptNumbers.length > 0 ? (
          orderedAttemptNumbers.map((attemptNumber) => {
            const attempt = attemptLookup.get(attemptNumber);
            const attemptSteps = stepGroups.get(attemptNumber) ?? [];

            return (
              <section
                key={`attempt:${attemptNumber}`}
                className="rounded-[1.65rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_18%,transparent)] bg-[var(--surface-container-low)]/65 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--on-surface)]">
                      Attempt {attemptNumber}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
                      {formatLaunchReason(attempt?.launchReason)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-[var(--on-surface-variant)]">
                    <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 capitalize text-[var(--on-surface)]">
                      {attempt?.status ?? "completed"}
                    </span>
                    {attempt?.scheduledFor ? <span>Scheduled {attempt.scheduledFor}</span> : null}
                    {attempt?.backoffSeconds ? <span>Backoff {attempt.backoffSeconds}s</span> : null}
                  </div>
                </div>

                {attempt?.failureMessage ? (
                  <div className="mt-4 rounded-2xl bg-[var(--error-container)]/70 px-4 py-3 text-sm text-[var(--error)]">
                    <p>{attempt.failureMessage}</p>
                    {attempt.failureCode ? (
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em]">
                        {attempt.failureCode}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {attempt?.requestNote ? (
                  <div className="mt-4 rounded-2xl bg-[var(--surface-container-high)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
                    {attempt.requestNote}
                  </div>
                ) : null}

                <div className="mt-4 space-y-4">
                  {attemptSteps.length > 0 ? (
                    attemptSteps.map((step) => {
                      const conditionOutput =
                        step.nodeType === "condition" ? toRecord(step.outputPayload) : null;
                      const actionOutput =
                        step.nodeType === "action" ? toRecord(step.outputPayload) : null;
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

                          {actionOutput && typeof actionOutput.actionType === "string" ? (
                            <div className="mt-4 rounded-2xl bg-[var(--surface-container-high)] p-4">
                              <p className="label-caps">Action outcome</p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {actionOutput.actionType === "send_webhook" ? (
                                  <>
                                    <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                                      <p className="label-caps">Request</p>
                                      <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                                        {String(actionOutput.method ?? "POST")}{" "}
                                        {String(actionOutput.url ?? "Unknown URL")}
                                      </p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                                      <p className="label-caps">Status</p>
                                      <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                                        {String(actionOutput.status ?? "Unknown")}
                                      </p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3 sm:col-span-2 xl:col-span-1">
                                      <p className="label-caps">Response preview</p>
                                      <p className="mt-2 break-all text-sm font-semibold text-[var(--on-surface)]">
                                        {String(actionOutput.responsePreview ?? "No response body")}
                                      </p>
                                    </div>
                                  </>
                                ) : null}

                                {actionOutput.actionType === "send_email" ? (
                                  <>
                                    <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                                      <p className="label-caps">Recipient</p>
                                      <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                                        {String(actionOutput.recipient ?? "Unknown")}
                                      </p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                                      <p className="label-caps">Subject</p>
                                      <p className="mt-2 break-all text-sm font-semibold text-[var(--on-surface)]">
                                        {String(actionOutput.subject ?? "Unknown")}
                                      </p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                                      <p className="label-caps">Provider id</p>
                                      <p className="mt-2 break-all text-sm font-semibold text-[var(--on-surface)]">
                                        {String(actionOutput.providerMessageId ?? "Unavailable")}
                                      </p>
                                    </div>
                                  </>
                                ) : null}

                                {actionOutput.actionType === "create_task" ? (
                                  <>
                                    <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                                      <p className="label-caps">Task id</p>
                                      <p className="mt-2 break-all text-sm font-semibold text-[var(--on-surface)]">
                                        {String(actionOutput.taskId ?? "Unknown")}
                                      </p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                                      <p className="label-caps">Title</p>
                                      <p className="mt-2 break-all text-sm font-semibold text-[var(--on-surface)]">
                                        {String(actionOutput.title ?? "Unknown")}
                                      </p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                                      <p className="label-caps">Assignee</p>
                                      <p className="mt-2 break-all text-sm font-semibold text-[var(--on-surface)]">
                                        {String(actionOutput.assigneeEmail ?? "Unassigned")}
                                      </p>
                                    </div>
                                  </>
                                ) : null}

                                {actionOutput.actionType === "update_record_field" ? (
                                  <>
                                    <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                                      <p className="label-caps">Record</p>
                                      <p className="mt-2 break-all text-sm font-semibold text-[var(--on-surface)]">
                                        {String(actionOutput.recordType ?? "record")} /{" "}
                                        {String(actionOutput.recordKey ?? "unknown")}
                                      </p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                                      <p className="label-caps">Field</p>
                                      <p className="mt-2 break-all text-sm font-semibold text-[var(--on-surface)]">
                                        {String(actionOutput.field ?? "unknown")}
                                      </p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-3">
                                      <p className="label-caps">Value</p>
                                      <p className="mt-2 break-all text-sm font-semibold text-[var(--on-surface)]">
                                        {toReadableValue(actionOutput.value)}
                                      </p>
                                    </div>
                                  </>
                                ) : null}
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
                                    {"data" in log && log.data ? (
                                      <pre className="mt-2 overflow-x-auto text-[11px]">
                                        {JSON.stringify(log.data, null, 2)}
                                      </pre>
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
                      No step records were persisted for this attempt.
                    </div>
                  )}
                </div>
              </section>
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
