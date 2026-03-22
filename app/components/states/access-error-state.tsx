import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { MAIN_CONTENT_ID } from "@/lib/a11y";

type AccessErrorStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function AccessErrorState({
  title,
  description,
  icon,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: AccessErrorStateProps) {
  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="workspace-main flex min-h-screen items-center justify-center px-4 py-16"
    >
      <section className="auth-panel micro-fade-in mx-auto flex w-full max-w-2xl flex-col items-center rounded-[2rem] px-8 py-12 text-center">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-[var(--surface-container-high)] text-primary shadow-[0_12px_32px_rgba(11,28,48,0.06)]">
          {icon ?? <AlertCircle className="h-10 w-10" />}
        </div>
        <h1 className="text-4xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-[var(--on-surface-variant)]">
          {description}
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          {primaryHref && primaryLabel ? (
            <Button asChild className="premium-gradient min-h-11 rounded-xl px-6">
              <Link href={primaryHref}>{primaryLabel}</Link>
            </Button>
          ) : null}
          {secondaryHref && secondaryLabel ? (
            <Button
              asChild
              variant="outline"
              className="min-h-11 rounded-xl border-0 bg-[var(--surface-container-high)] px-6 text-primary hover:bg-[var(--surface-container)]"
            >
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
