import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import type { ValidationIssue } from "@/lib/server/workflows/types";

type WorkflowValidationPanelProps = {
  issues: ValidationIssue[];
  title?: string;
  description?: string;
  compact?: boolean;
};

function severityIcon(severity: ValidationIssue["severity"]) {
  return severity === "warning" ? AlertTriangle : AlertCircle;
}

export function WorkflowValidationPanel({
  issues,
  title = "Validation status",
  description,
  compact = false,
}: WorkflowValidationPanelProps) {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  if (issues.length === 0) {
    return (
      <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="label-caps">Validation</p>
            <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-[var(--on-surface)]">
              {title}
            </h2>
            <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
              {description ??
                "No blocking issues were found in this workflow definition."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-caps">Validation</p>
          <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-[var(--on-surface)]">
            {title}
          </h2>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            {description ??
              "Review blocking errors before publishing immutable workflow versions."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded-full bg-[var(--error-container)] px-3 py-1 text-xs font-semibold text-[var(--error)]">
            {errorCount} error{errorCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex rounded-full bg-amber-500/12 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
            {warningCount} warning{warningCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className={`mt-5 grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
        {issues.map((issue) => {
          const Icon = severityIcon(issue.severity);

          return (
            <article
              key={`${issue.path}:${issue.code}:${issue.message}`}
              className={`rounded-2xl border px-4 py-4 ${
                issue.severity === "warning"
                  ? "border-amber-500/18 bg-amber-500/8"
                  : "border-[color:color-mix(in_srgb,var(--error)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--error-container)_82%,transparent)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    issue.severity === "warning"
                      ? "bg-amber-500/14 text-amber-800 dark:text-amber-200"
                      : "bg-[var(--error)]/10 text-[var(--error)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
                      {issue.code.replaceAll("_", " ")}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-container-high)] px-2 py-1 text-[11px] font-medium text-[var(--on-surface-variant)]">
                      <ShieldCheck className="h-3 w-3" />
                      {issue.path}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-6 text-[var(--on-surface)]">
                    {issue.message}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
