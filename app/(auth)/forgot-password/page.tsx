"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AuthCanvas,
  AuthFooterMeta,
  AuthPanel,
} from "@/app/components/auth/auth-shell";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  normalizeEmail,
} from "./forgot-password-flow";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(email) }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reset email");
      }

      setSubmitted(true);
      toast.success(FORGOT_PASSWORD_SUCCESS_MESSAGE);
    } catch (submitError: unknown) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "An unexpected error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCanvas>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col">
        <AuthPanel className="px-8 py-8 sm:px-10">
          {submitted ? (
            <div className="flex flex-col text-center">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-container-low)] text-primary">
                <Mail className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
                Check your inbox
              </h1>
              <p className="mt-3 body-md text-[var(--on-surface-variant)]">
                {FORGOT_PASSWORD_SUCCESS_MESSAGE}
              </p>
              <Button
                className="premium-gradient mt-8 min-h-[3.25rem] w-full rounded-xl text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,95,158,0.18)] hover:opacity-95"
                onClick={() => router.push("/login")}
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-container-low)] text-primary">
                  <LockKeyhole className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
                  Forgot Password?
                </h1>
                <p className="mt-3 body-md text-[var(--on-surface-variant)]">
                  Enter the email address associated with your Orchestrator
                  account. We&apos;ll send you a secure link to reset your
                  credentials.
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                {error ? (
                  <div className="rounded-2xl bg-[var(--error-container)] px-4 py-3 text-sm font-medium text-[var(--error)]">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <label className="label-caps ml-1" htmlFor="email">
                    Email Address
                  </label>
                  <div className="relative">
                    <Input
                      id="email"
                      className="input-field border-0 px-4 py-3 pr-11 shadow-none"
                      placeholder="name@company.com"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={loading}
                      required
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[var(--outline)]">
                      <Mail className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="premium-gradient min-h-[3.25rem] w-full rounded-xl text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,95,158,0.18)] hover:opacity-95"
                  disabled={loading}
                >
                  {loading ? (
                    <>Sending reset link...</>
                  ) : (
                    <>
                      Reset Password
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="tonal-divider mt-8 pt-8 text-center">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-[var(--primary-container)]"
                  onClick={() => router.push("/login")}
                  disabled={loading}
                >
                  Back to Login
                </button>
              </div>
            </>
          )}
        </AuthPanel>

        <div className="mt-8 flex items-center justify-center gap-6 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:rgba(11,28,48,0.5)]">
          <div className="flex items-center gap-1.5">
            <LockKeyhole className="h-3.5 w-3.5" />
            <span>Secure Auth</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            <span>Enterprise Node</span>
          </div>
        </div>

        <AuthFooterMeta className="pt-8" />
      </div>
    </AuthCanvas>
  );
}
