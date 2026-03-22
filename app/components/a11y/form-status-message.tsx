import { AlertCircle, CheckCircle2, Info } from "lucide-react";

type FormStatusMessageProps = {
  id: string;
  message?: string | null;
  tone?: "error" | "success" | "info";
  className?: string;
};

export function FormStatusMessage({
  id,
  message,
  tone = "info",
  className = "",
}: FormStatusMessageProps) {
  if (!message) {
    return null;
  }

  const config =
    tone === "error"
      ? {
          role: "alert" as const,
          icon: <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />,
          classes: "bg-[var(--error-container)] text-[var(--error)]",
        }
      : tone === "success"
        ? {
            role: "status" as const,
            icon: <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />,
            classes: "bg-emerald-50 text-emerald-700",
          }
        : {
            role: "status" as const,
            icon: <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />,
            classes: "bg-[var(--surface-container-low)] text-[var(--on-surface-variant)]",
          };

  return (
    <div
      id={id}
      role={config.role}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-2xl px-4 py-3 text-sm font-medium ${config.classes} ${className}`}
    >
      <div className="flex items-start gap-3">
        {config.icon}
        <span>{message}</span>
      </div>
    </div>
  );
}
