import type { OperationalAlertState } from "@/lib/observability/alerts";

function badgeClassForStatus(status: OperationalAlertState["status"]) {
  switch (status) {
    case "critical":
      return "bg-[var(--error-container)] text-[var(--error)]";
    case "warning":
      return "bg-amber-500/12 text-amber-700 dark:text-amber-200";
    case "ok":
    default:
      return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-200";
  }
}

export function AlertRulesPanel({
  alerts,
}: {
  alerts: OperationalAlertState[];
}) {
  return (
    <section className="glass-panel rounded-[1.75rem] p-6">
      <p className="label-caps">Alert rules</p>
      <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
        Current thresholds
      </h2>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {alerts.map((alert) => (
          <article
            key={alert.key}
            className="rounded-[1.35rem] bg-[var(--surface-container-low)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--on-surface)]">
                  {alert.title}
                </p>
                <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                  {alert.message}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClassForStatus(alert.status)}`}
              >
                {alert.status}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--on-surface-variant)]">
              <span>Current {alert.currentValue}</span>
              <span>Threshold {alert.thresholdValue}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
