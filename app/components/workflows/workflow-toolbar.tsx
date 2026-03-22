import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";

type WorkflowToolbarProps = {
  title: string;
  description: string;
  backHref: string;
  backLabel?: string;
  actions?: ReactNode;
};

export function WorkflowToolbar({
  title,
  description,
  backHref,
  backLabel = "Back",
  actions,
}: WorkflowToolbarProps) {
  return (
    <section className="glass-panel sticky top-4 z-20 rounded-[1.75rem] px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <Button asChild variant="ghost" className="rounded-xl px-0 text-primary">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--on-surface-variant)]">
              {description}
            </p>
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}
