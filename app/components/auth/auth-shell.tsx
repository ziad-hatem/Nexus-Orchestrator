import type { ReactNode } from "react";
import { DatabaseZap, LockKeyhole, ShieldCheck } from "lucide-react";
import { cn } from "../ui/utils";

type AuthCanvasProps = {
  children: ReactNode;
  className?: string;
};

type AuthBrandProps = {
  title?: string;
  subtitle?: string;
  className?: string;
};

type AuthPanelProps = {
  children: ReactNode;
  className?: string;
};

type AuthFooterMetaProps = {
  className?: string;
  leftText?: string;
  centerItems?: string[];
  rightText?: string;
};

type AuthTrustBadgesProps = {
  className?: string;
};

export function AuthCanvas({ children, className }: AuthCanvasProps) {
  return (
    <div className="auth-canvas relative min-h-screen bg-[var(--surface)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_center,rgba(0,120,199,0.22),transparent_60%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className={cn("w-full", className)}>{children}</div>
      </div>
    </div>
  );
}

export function AuthBrand({
  title = "Orchestrator Enterprise",
  subtitle = "Securing the world's most complex workflows.",
  className,
}: AuthBrandProps) {
  return (
    <div className={cn("text-center", className)}>
      <h1 className="font-headline text-xl font-bold tracking-[-0.02em] text-primary sm:text-[1.4rem]">
        {title}
      </h1>
      <p className="mt-2 text-sm font-medium text-[var(--on-surface-variant)]">
        {subtitle}
      </p>
    </div>
  );
}

export function AuthPanel({ children, className }: AuthPanelProps) {
  return (
    <div
      className={cn(
        "auth-panel rounded-[1.5rem] px-6 py-7 sm:px-8 sm:py-9",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AuthTrustBadges({ className }: AuthTrustBadgesProps) {
  return (
    <div
      className={cn(
        "mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:rgba(11,28,48,0.58)]",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <LockKeyhole className="h-3.5 w-3.5" />
        <span>AES-256 Encrypted</span>
      </div>
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>SOC2 Compliant</span>
      </div>
      <div className="flex items-center gap-1.5">
        <DatabaseZap className="h-3.5 w-3.5" />
        <span>Enterprise Node</span>
      </div>
    </div>
  );
}

export function AuthFooterMeta({
  className,
  leftText = "© 2026 Orchestrator Systems. All rights reserved.",
  centerItems = ["Privacy Policy", "Terms of Service", "Security Compliance"],
  rightText = "Status",
}: AuthFooterMetaProps) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col gap-3 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-[color:rgba(95,107,124,0.76)] sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p>{leftText}</p>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {centerItems.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <p>{rightText}</p>
    </div>
  );
}

export function AuthDividerLabel({ label }: { label: string }) {
  return (
    <div className="relative flex items-center">
      <div className="flex-1 border-t border-[rgba(192,199,211,0.2)]" />
      <span className="px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]">
        {label}
      </span>
      <div className="flex-1 border-t border-[rgba(192,199,211,0.2)]" />
    </div>
  );
}
