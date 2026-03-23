import Link from "next/link";
import type { OperationsChecklistItem } from "@/lib/server/operations/types";

function badgeClassForStatus(status: OperationsChecklistItem["status"]) {
  switch (status) {
    case "complete":
      return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-200";
    case "attention":
      return "bg-[var(--error-container)] text-[var(--error)]";
    case "manual":
    default:
      return "bg-[var(--surface-container-high)] text-[var(--on-surface)]";
  }
}

export function ReadinessChecklist({
  checklist,
}: {
  checklist: OperationsChecklistItem[];
}) {
  return (
    <section className="glass-panel rounded-[1.75rem] p-6">
      <p className="label-caps">Pilot checklist</p>
      <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
        Production readiness
      </h2>

      <div className="mt-5 space-y-4">
        {checklist.map((item) => (
          <article
            key={item.key}
            className="rounded-[1.35rem] bg-[var(--surface-container-low)] p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--on-surface)]">
                  {item.title}
                </p>
                <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                  {item.detail}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClassForStatus(item.status)}`}
              >
                {item.status}
              </span>
            </div>

            {item.href ? (
              <Link
                href={item.href}
                className="mt-4 inline-flex text-sm font-semibold text-primary transition-colors hover:text-[var(--primary-container)]"
              >
                Open related view
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
