"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { MAIN_CONTENT_ID } from "@/lib/a11y";
import {
  Activity,
  DatabaseZap,
  Globe,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { cn } from "../ui/utils";
import { Canvas } from "@react-three/fiber";
import { Particles } from "../marketing/medusae";

type AuthCanvasProps = {
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
};

type AuthBrandProps = {
  title?: string;
  subtitle?: string;
  className?: string;
};

type AuthPanelProps = {
  className?: string;
} & React.ComponentPropsWithoutRef<"div">;

type AuthFooterMetaProps = {
  className?: string;
  leftText?: string;
  centerItems?: string[];
  rightText?: string;
};

type AuthTrustBadgesProps = {
  className?: string;
};

type AuthInfoBoxProps = {
  children: ReactNode;
  className?: string;
};

export function AuthCanvas({ children, className, footer }: AuthCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={containerRef}
      className="auth-canvas relative min-h-dvh bg-[var(--surface)]"
    >
      <div className="absolute inset-0 z-0 pointer-events-auto">
        <Canvas
          eventSource={containerRef as any}
          camera={{ position: [0, 0, 5] }}
          gl={{ alpha: true }}
        >
          <Particles />
        </Canvas>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_top_center,rgba(0,120,199,0.22),transparent_60%)]" />
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="relative z-10 flex min-h-dvh w-full flex-col px-4 py-10 sm:px-6 lg:px-8 pointer-events-none"
      >
        <div
          className={cn(
            "flex w-full flex-1 flex-col justify-center pointer-events-auto z-10",
            className,
          )}
        >
          {children}
        </div>
        <div className="mt-auto w-full pointer-events-auto z-10">{footer}</div>
      </main>
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

export function AuthPanel({ children, className, ...props }: AuthPanelProps) {
  return (
    <div
      {...props}
      className={cn(
        "auth-panel rounded-[1.5rem] px-6 py-7 sm:px-8 sm:py-9",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AuthInfoBox({ children, className }: AuthInfoBoxProps) {
  return (
    <div className={cn("mt-6 flex justify-center", className)}>
      <div className="max-w-md rounded-2xl bg-(--surface-container-low) px-4 py-3 text-center text-sm text-[var(--on-surface-variant)]">
        {children}
      </div>
    </div>
  );
}

export function AuthTrustBadges({ className }: AuthTrustBadgesProps) {
  return (
    <div
      className={cn(
        "mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]",
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
  leftText = "(c) 2026 Orchestrator Systems. All rights reserved.",
  centerItems = ["Privacy Policy", "Terms of Service", "Security Compliance"],
  rightText = "Status",
}: AuthFooterMetaProps) {
  return (
    <div
      className={cn(
        "glass-panel-soft mt-auto w-full rounded-[1.4rem] px-4 py-4 sm:px-5",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-center gap-3 sm:justify-start">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-[0_10px_24px_rgba(0,95,158,0.18)] overflow-hidden bg-white/5 p-1.5 border border-outline-variant/20">
            <img
              src="/website_logo.png"
              alt="Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
              Nexus Auth Gateway
            </p>
            <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
              {leftText}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {centerItems.map((item) => (
            <span
              key={item}
              className="glass-pill rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]"
            >
              {item}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 sm:justify-end">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800 shadow-[0_6px_18px_rgba(22,163,74,0.08)] dark:text-emerald-200">
            <Activity className="h-3.5 w-3.5" />
            <span>{rightText}</span>
          </div>
          <div className="hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)] sm:flex">
            <Globe className="h-3.5 w-3.5" />
            <span>Global Edge</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthDividerLabel({ label }: { label: string }) {
  return (
    <div className="relative flex items-center">
      <div className="tonal-divider flex-1" />
      <span className="px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--outline)]">
        {label}
      </span>
      <div className="tonal-divider flex-1" />
    </div>
  );
}
