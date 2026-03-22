"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  AuthBrand,
  AuthCanvas,
  AuthFooterMeta,
  AuthPanel,
} from "@/app/components/auth/auth-shell";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  getResetPasswordMismatchError,
  parseRecoveryTokens,
} from "./reset-password-flow";

export default function Page() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [isLinkValid, setIsLinkValid] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const applyRecoverySession = async () => {
      const tokens = parseRecoveryTokens(
        window.location.search,
        window.location.hash,
      );

      if (!tokens) {
        setIsLinkValid(false);
        setCheckingLink(false);
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      setIsLinkValid(!sessionError);
      setCheckingLink(false);
    };

    void applyRecoverySession();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const mismatchError = getResetPasswordMismatchError(
      password,
      confirmPassword,
    );
    if (mismatchError) {
      setError(mismatchError);
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      toast.success("Password updated successfully");
      router.push("/login");
    } catch (submitError: unknown) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to reset password";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCanvas>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col">
        <AuthBrand className="mb-10" />
        <AuthPanel>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--on-surface)]">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
              Choose a new password for your account.
            </p>
          </div>

          {checkingLink ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--surface-container-low)] px-4 py-5 text-sm text-[var(--on-surface-variant)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying reset link...
            </div>
          ) : !isLinkValid ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[var(--error-container)] px-4 py-3 text-sm font-medium text-[var(--error)]">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>This reset link is invalid or expired.</span>
                </div>
              </div>
              <Button
                className="premium-gradient min-h-[3.25rem] w-full rounded-xl text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,95,158,0.18)] hover:opacity-95"
                onClick={() => router.push("/login")}
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error ? (
                <div className="rounded-2xl bg-[var(--error-container)] px-4 py-3 text-sm font-medium text-[var(--error)]">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="password">
                  New Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  disabled={loading}
                  className="input-field border-0 px-4 py-3 shadow-none"
                  required
                />
              </div>

              <div>
                <label
                  className="label-caps mb-2 ml-1 block"
                  htmlFor="confirmPassword"
                >
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your new password"
                  minLength={6}
                  disabled={loading}
                  className="input-field border-0 px-4 py-3 shadow-none"
                  required
                />
              </div>

              <Button
                type="submit"
                className="premium-gradient min-h-[3.25rem] w-full rounded-xl text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,95,158,0.18)] hover:opacity-95"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          )}
        </AuthPanel>

        <div className="mt-8 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--on-surface-variant)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Secure recovery session</span>
        </div>
        <AuthFooterMeta className="pt-8" />
      </div>
    </AuthCanvas>
  );
}
