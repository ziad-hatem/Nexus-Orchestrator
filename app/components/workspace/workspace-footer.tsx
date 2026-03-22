import { Globe, ShieldCheck } from "lucide-react";
import { cn } from "@/app/components/ui/utils";

type WorkspaceFooterProps = {
  className?: string;
};

export function WorkspaceFooter({ className }: WorkspaceFooterProps) {
  return (
    <footer
      className={cn(
        "glass-panel-soft mt-auto rounded-[1.4rem] px-4 py-4 sm:px-5",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="premium-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[var(--on-primary)] shadow-[0_10px_24px_rgba(0,95,158,0.18)]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
              Nexus Workspace Shell
            </p>
            <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
              Tenant-aware surfaces stay pinned to the active organization.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="glass-pill rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
            Secure Access
          </span>
          <span className="glass-pill rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
            RBAC Enforced
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
          <Globe className="h-3.5 w-3.5" />
          <span>Global Edge</span>
        </div>
      </div>
    </footer>
  );
}
