import type { ReactNode } from "react";
import {
  Fingerprint,
  Info,
  Loader2,
  Mail,
  MailOpen,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { FormStatusMessage } from "@/app/components/a11y/form-status-message";
import { Button } from "../ui/button";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "../ui/input-otp";
import { AuthPanel } from "./auth-shell";
import { cn } from "../ui/utils";

type MagicLinkPanelProps = {
  title?: string;
  description: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  primaryDisabled?: boolean;
  secondaryDisabled?: boolean;
  email?: string | null;
  className?: string;
};

type MfaPanelProps = {
  title?: string;
  description: string;
  code: string;
  info?: string | null;
  error?: string | null;
  onCodeChange: (value: string) => void;
  onVerify: () => void;
  onResend?: () => void;
  onAlternative?: () => void;
  verifyDisabled?: boolean;
  resendDisabled?: boolean;
  alternativeDisabled?: boolean;
  isVerifying?: boolean;
  isResending?: boolean;
  verifyLabel?: string;
  resendLabel?: string;
  alternativeLabel?: string;
  className?: string;
};

type AsyncStatePanelProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
};

export function MagicLinkPanel({
  title = "Check your email",
  description,
  primaryActionLabel = "Open Mail App",
  secondaryActionLabel = "Resend Link",
  onPrimaryAction,
  onSecondaryAction,
  primaryDisabled,
  secondaryDisabled,
  email,
  className,
}: MagicLinkPanelProps) {
  return (
    <AuthPanel className={cn("rounded-[2rem] p-0", className)}>
      <div className="relative overflow-hidden rounded-[2rem] p-8 sm:p-10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(239,244,255,0.5),transparent)]" />
        <div className="relative z-10 flex flex-col">
          <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary-fixed)] text-primary">
            <MailOpen className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
            {title}
          </h2>
          <p className="mt-3 body-md text-[var(--on-surface-variant)]">
            {description}
          </p>
          {email ? (
            <p className="mt-4 text-sm font-semibold text-[var(--on-surface)]" role="status" aria-live="polite">
              Sent to {email}
            </p>
          ) : null}
          <div className="mt-8 space-y-4">
            <Button
              type="button"
              className="premium-gradient min-h-[3.25rem] w-full rounded-xl text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,95,158,0.18)] hover:opacity-95"
              onClick={onPrimaryAction}
              disabled={primaryDisabled}
            >
              <Mail className="h-4 w-4" />
              {primaryActionLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full rounded-xl text-sm font-semibold text-primary hover:bg-[var(--surface-container-low)]"
              onClick={onSecondaryAction}
              disabled={secondaryDisabled}
            >
              {secondaryActionLabel}
            </Button>
          </div>
        </div>
      </div>
    </AuthPanel>
  );
}

export function MfaPanel({
  title = "Verify your identity",
  description,
  code,
  info,
  error,
  onCodeChange,
  onVerify,
  onResend,
  onAlternative,
  verifyDisabled,
  resendDisabled,
  alternativeDisabled,
  isVerifying,
  isResending,
  verifyLabel = "Verify Identity",
  resendLabel = "Resend Code",
  alternativeLabel = "Try another method",
  className,
}: MfaPanelProps) {
  return (
    <AuthPanel className={cn("max-w-md px-8 py-10 text-center sm:px-10", className)}>
      <div className="mx-auto mb-8 flex w-fit items-center gap-3 rounded-2xl bg-[var(--surface-container-low)] px-4 py-3">
        <div className="premium-gradient flex h-10 w-10 items-center justify-center rounded-xl text-[var(--on-primary)]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-[-0.02em] text-[var(--on-surface)]">
          Orchestrator
        </span>
      </div>

      <h2 className="text-2xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
        {title}
      </h2>
      <p className="mt-3 body-md text-[var(--on-surface-variant)]">
        {description}
      </p>

      <FormStatusMessage
        id="mfa-info"
        message={info}
        tone="info"
        className="mt-5"
      />
      <FormStatusMessage
        id="mfa-error"
        message={error}
        tone="error"
        className="mt-4"
      />

      <div className="mt-8 flex justify-center">
        <label htmlFor="mfa-code-input" className="sr-only">
          Enter the six digit email verification code
        </label>
        <InputOTP
          id="mfa-code-input"
          maxLength={6}
          value={code}
          onChange={(value) => onCodeChange(value.replace(/\D/g, "").slice(0, 6))}
          containerClassName="items-center gap-2"
          disabled={verifyDisabled || resendDisabled}
          aria-describedby="mfa-info mfa-error mfa-help-text"
        >
          <InputOTPGroup className="gap-2">
            <InputOTPSlot
              index={0}
              className="h-14 w-12 rounded-xl border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--surface-container-low)] text-xl font-semibold first:rounded-xl first:border last:rounded-xl"
            />
            <InputOTPSlot
              index={1}
              className="h-14 w-12 rounded-xl border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--surface-container-low)] text-xl font-semibold first:rounded-xl first:border last:rounded-xl"
            />
            <InputOTPSlot
              index={2}
              className="h-14 w-12 rounded-xl border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--surface-container-low)] text-xl font-semibold first:rounded-xl first:border last:rounded-xl"
            />
          </InputOTPGroup>
          <InputOTPSeparator className="mx-1 text-[var(--outline-variant)] [&_svg]:h-4 [&_svg]:w-4" />
          <InputOTPGroup className="gap-2">
            <InputOTPSlot
              index={3}
              className="h-14 w-12 rounded-xl border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--surface-container-low)] text-xl font-semibold first:rounded-xl first:border last:rounded-xl"
            />
            <InputOTPSlot
              index={4}
              className="h-14 w-12 rounded-xl border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--surface-container-low)] text-xl font-semibold first:rounded-xl first:border last:rounded-xl"
            />
            <InputOTPSlot
              index={5}
              className="h-14 w-12 rounded-xl border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--surface-container-low)] text-xl font-semibold first:rounded-xl first:border last:rounded-xl"
            />
          </InputOTPGroup>
        </InputOTP>
      </div>
      <p id="mfa-help-text" className="mt-3 text-xs text-[var(--on-surface-variant)]">
        Enter the code exactly as shown in your email. It expires shortly after delivery.
      </p>

      <Button
        type="button"
        className="premium-gradient mt-8 min-h-[3.25rem] w-full rounded-xl text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,95,158,0.18)] hover:opacity-95"
        onClick={onVerify}
        disabled={verifyDisabled}
      >
        {isVerifying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying...
          </>
        ) : (
          verifyLabel
        )}
      </Button>

      <div className="mt-6 flex flex-col items-center gap-4">
        {onResend ? (
          <Button
            type="button"
            variant="ghost"
            className="h-auto rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-primary hover:bg-[var(--surface-container-low)]"
            onClick={onResend}
            disabled={resendDisabled}
          >
            {isResending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                {resendLabel}
              </>
            )}
          </Button>
        ) : null}
        {onAlternative ? (
          <>
            <div className="h-px w-12 bg-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)]" />
            <Button
              type="button"
              variant="ghost"
              className="h-auto rounded-full px-3 py-2 text-sm text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)]"
              onClick={onAlternative}
              disabled={alternativeDisabled}
            >
              {alternativeLabel}
            </Button>
          </>
        ) : null}
      </div>

      <div className="mt-10 flex items-center justify-center gap-2 border-t border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] pt-8 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--on-surface-variant)]">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>End-to-End Encrypted Session</span>
      </div>
    </AuthPanel>
  );
}

export function PasskeyStatusPanel({
  title = "Verifying Passkey",
  description,
  status = "Waiting for device...",
  primaryLabel = "Try Biometric Login",
  onPrimaryAction,
  disabled,
  isBusy,
}: {
  title?: string;
  description: string;
  status?: string;
  primaryLabel?: string;
  onPrimaryAction?: () => void;
  disabled?: boolean;
  isBusy?: boolean;
}) {
  return (
    <AuthPanel className="rounded-[2rem] p-0">
      <div className="relative overflow-hidden rounded-[2rem] p-8 sm:p-10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(220,233,255,0.35),transparent)]" />
        <div className="relative z-10 flex h-full flex-col">
          <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--secondary-container)] text-[var(--on-secondary-container)]">
            <Fingerprint className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
            {title}
          </h2>
          <p className="mt-3 body-md text-[var(--on-surface-variant)]" role="status" aria-live="polite">
            {description}
          </p>
          <div className="mt-8 rounded-2xl border border-[color:color-mix(in_srgb,var(--outline-variant)_40%,transparent)] bg-[var(--surface-container-low)] p-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Fingerprint className="relative z-10 h-5 w-5 text-primary" />
                <div className="absolute -inset-1 rounded-full bg-primary/10 blur-sm" />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                  System Status
                </span>
                <p className="mt-1 text-sm font-medium text-[var(--on-surface)]" role="status" aria-live="polite">
                  {status}
                </p>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-6 min-h-[3.25rem] w-full rounded-xl border-0 bg-[var(--surface-container-high)] text-sm font-semibold text-primary hover:bg-[var(--surface-container)]"
            onClick={onPrimaryAction}
            disabled={disabled}
          >
            {isBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking passkey...
              </>
            ) : (
              <>
                <Fingerprint className="h-4 w-4" />
                {primaryLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </AuthPanel>
  );
}

export function AsyncStatePanel({
  title,
  description,
  icon,
  className,
}: AsyncStatePanelProps) {
  return (
    <AuthPanel className={cn("mx-auto max-w-md text-center", className)} role="status" aria-live="polite">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-container-low)] text-primary">
        {icon ?? <Info className="h-6 w-6" />}
      </div>
      <h2 className="text-2xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
        {title}
      </h2>
      <p className="mt-3 body-md text-[var(--on-surface-variant)]">
        {description}
      </p>
    </AuthPanel>
  );
}

export function VerificationHelpText() {
  return (
    <div className="mt-10 text-center text-sm text-[var(--on-surface-variant)]">
      <p className="inline-flex flex-wrap items-center justify-center gap-2">
        <Info className="h-4 w-4" />
        Verification usually takes less than 30 seconds.
        <span className="font-semibold text-primary">Facing issues?</span>
      </p>
    </div>
  );
}
