import type { WorkflowIngestionEventSummary } from "@/lib/server/workflows/types";

type WorkflowTriggerAttemptsProps = {
  attempts: WorkflowIngestionEventSummary[];
  title?: string;
  description?: string;
  emptyMessage?: string;
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClasses(status: WorkflowIngestionEventSummary["status"]): string {
  switch (status) {
    case "accepted":
      return "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200";
    case "duplicate":
      return "bg-amber-500/12 text-amber-800 dark:text-amber-200";
    case "rate_limited":
      return "bg-orange-500/12 text-orange-800 dark:text-orange-200";
    case "rejected":
    default:
      return "bg-[var(--error-container)] text-[var(--error)]";
  }
}

export function WorkflowTriggerAttempts({
  attempts,
  title = "Recent trigger attempts",
  description = "Inspect accepted, duplicate, rejected, and rate-limited deliveries for this workflow.",
  emptyMessage = "No trigger deliveries have been captured for this workflow yet.",
}: WorkflowTriggerAttemptsProps) {
  return (
    <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
      <p className="label-caps">Trigger attempts</p>
      <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
        {description}
      </p>

      <div className="mt-6 space-y-4">
        {attempts.length === 0 ? (
          <div className="rounded-[1.5rem] bg-[var(--surface-container-low)] p-5 text-sm text-[var(--on-surface-variant)]">
            {emptyMessage}
          </div>
        ) : (
          attempts.map((attempt) => (
            <details
              key={attempt.eventId}
              className="rounded-[1.5rem] bg-[var(--surface-container-low)] p-5"
            >
              <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(attempt.status)}`}
                    >
                      {attempt.status.replaceAll("_", " ")}
                    </span>
                    <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-xs font-semibold text-[var(--on-surface-variant)]">
                      {attempt.sourceType}
                    </span>
                    {attempt.eventKey ? (
                      <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-xs font-semibold text-[var(--on-surface-variant)]">
                        {attempt.eventKey}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[var(--on-surface)]">
                    {attempt.matchKey}
                  </p>
                  <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                    {formatDateTime(attempt.createdAt)}
                    {attempt.runId ? ` • run ${attempt.runId}` : ""}
                  </p>
                </div>

                <div className="text-sm text-[var(--on-surface-variant)]">
                  {attempt.errorMessage ?? "Accepted for pending execution."}
                </div>
              </summary>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.25rem] bg-[var(--surface-container-lowest)] p-4">
                  <p className="label-caps">Source context</p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-[var(--on-surface-variant)]">
                    {JSON.stringify(attempt.sourceContext, null, 2)}
                  </pre>
                </div>
                <div className="rounded-[1.25rem] bg-[var(--surface-container-lowest)] p-4">
                  <p className="label-caps">Payload snapshot</p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-[var(--on-surface-variant)]">
                    {JSON.stringify(attempt.payload, null, 2)}
                  </pre>
                </div>
              </div>
            </details>
          ))
        )}
      </div>
    </section>
  );
}
