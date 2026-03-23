import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
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
  const errorCount = issues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  if (issues.length === 0) {
    return (
      <section className="glass-panel overflow-hidden rounded-[1.75rem]">
        <div className="bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(16,185,129,0.02))] p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <div className="absolute inset-0 animate-pulse rounded-2xl bg-emerald-500/12" />
              <CheckCircle2 className="relative z-10 h-6 w-6 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="label-caps">Validation</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">
                  <Sparkles className="h-3 w-3" />
                  Passing
                </span>
              </div>
              <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-[var(--on-surface)]">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
                {description ??
                  "No blocking issues were found in this workflow definition."}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="glass-panel overflow-hidden rounded-[1.75rem]">
      {/* Header with gradient accent */}
      <div className="border-b border-[color:color-mix(in_srgb,var(--outline-variant)_36%,transparent)] bg-[linear-gradient(135deg,rgba(220,38,38,0.06),rgba(245,158,11,0.04))] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label-caps">Validation</p>
            <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-[var(--on-surface)]">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
              {description ??
                "Review blocking errors before publishing immutable workflow versions."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {errorCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--error-container)] px-3 py-1 text-xs font-bold text-[var(--error)]">
                <AlertCircle className="h-3.5 w-3.5" />
                {errorCount} error{errorCount === 1 ? "" : "s"}
              </span>
            ) : null}
            {warningCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                {warningCount} warning{warningCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Issue cards */}
      <div className={`p-5 sm:p-6 ${compact ? "" : ""}`}>
        <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
          {issues.map((issue, index) => {
            const Icon = severityIcon(issue.severity);
            const isError = issue.severity === "error";

            return (
              <article
                key={`${issue.path}:${issue.code}:${issue.message}`}
                className={`group relative rounded-2xl border p-4 transition-all duration-200 hover:shadow-md ${
                  isError
                    ? "border-[color:color-mix(in_srgb,var(--error)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--error-container)_70%,transparent)] hover:border-[color:color-mix(in_srgb,var(--error)_36%,transparent)]"
                    : "border-amber-500/18 bg-amber-500/6 hover:border-amber-500/32"
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${
                      isError
                        ? "bg-[var(--error)]/12 text-[var(--error)]"
                        : "bg-amber-500/14 text-amber-800 dark:text-amber-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-[0.14em] ${
                          isError
                            ? "text-[var(--error)]"
                            : "text-amber-800 dark:text-amber-200"
                        }`}
                      >
                        {issue.code.replaceAll("_", " ")}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-container-high)] px-2 py-0.5 text-[10px] font-medium text-[var(--on-surface-variant)]">
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
      </div>
    </section>
  );
}
