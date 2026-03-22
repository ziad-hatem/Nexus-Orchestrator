"use client";

import { Suspense, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AuthBrand,
  AuthCanvas,
  AuthDividerLabel,
  AuthFooterMeta,
  AuthPanel,
} from "@/app/components/auth/auth-shell";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { getPasswordMismatchError } from "./register-flow";
import { safeRedirectPath } from "@/lib/redirect-path";
import { supabase } from "@/lib/supabase";

function GoogleMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const redirectPath = safeRedirectPath(searchParams.get("next")) ?? "/";
  const loginUrl = new URLSearchParams(
    redirectPath === "/" ? {} : { next: redirectPath },
  );

  if (email.trim()) {
    loginUrl.set("email", email.trim());
  }

  const loginQuery = loginUrl.toString();
  const loginPath = `/login${loginQuery ? `?${loginQuery}` : ""}`;

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("intent", "register");
      if (redirectPath !== "/") {
        callbackUrl.searchParams.set("next", redirectPath);
      }

      const { error: supabaseError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }
    } catch (oauthError: unknown) {
      const message =
        oauthError instanceof Error
          ? oauthError.message
          : "Failed to sign in with Google";
      setError(message);
      toast.error(message);
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const mismatchError = getPasswordMismatchError(password, confirmPassword);
    if (mismatchError) {
      setError(mismatchError);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          company,
          next: redirectPath,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      toast.success("Account created! Check your email to verify.");
      router.push(loginPath);
    } catch (submitError: unknown) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "An unexpected error occurred";
      setError(message);
      toast.error(message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCanvas>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[32rem] flex-col">
        <AuthBrand
          className="mb-10"
          subtitle="Design your operational future."
        />
        <AuthPanel>
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--on-surface)]">
              Create your workspace
            </h2>
            <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
              Start your 14-day premium trial.
            </p>
          </div>

          {error ? (
            <div className="mb-6 rounded-2xl bg-[var(--error-container)] px-4 py-3 text-sm font-medium text-[var(--error)]">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="label-caps mb-2 ml-1 block" htmlFor="company">
                Organization Name
              </label>
              <Input
                id="company"
                placeholder="Acme Corp"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                disabled={loading}
                className="input-field border-0 px-4 py-3 shadow-none"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="firstName">
                  Full Name
                </label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  disabled={loading}
                  className="input-field border-0 px-4 py-3 shadow-none"
                  required
                />
              </div>
              <div className="sm:pt-[1.65rem]">
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  disabled={loading}
                  className="input-field border-0 px-4 py-3 shadow-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label-caps mb-2 ml-1 block" htmlFor="email">
                Work Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                className="input-field border-0 px-4 py-3 shadow-none"
                required
              />
            </div>

            <div>
              <label className="label-caps mb-2 ml-1 block" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                className="input-field border-0 px-4 py-3 shadow-none"
                minLength={6}
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
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={loading}
                className="input-field border-0 px-4 py-3 shadow-none"
                minLength={6}
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
                  Creating account...
                </>
              ) : (
                "Create Enterprise Account"
              )}
            </Button>
          </form>

          <div className="my-6">
            <AuthDividerLabel label="or" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="min-h-[3.25rem] w-full rounded-xl border-0 bg-[var(--surface-container-high)] text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container)]"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <GoogleMark />
            Sign up with Google
          </Button>
        </AuthPanel>

        <div className="mt-6 text-center text-sm text-[var(--on-surface-variant)]">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => router.push(loginPath)}
            className="font-semibold text-primary transition-colors hover:text-[var(--primary-container)]"
            disabled={loading}
          >
            Login
          </button>
        </div>

        <AuthFooterMeta className="pt-8" />
      </div>
    </AuthCanvas>
  );
}

function RegisterPageFallback() {
  return (
    <AuthCanvas>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[32rem] flex-col">
        <AuthBrand
          className="mb-10"
          subtitle="Design your operational future."
        />
        <AuthPanel className="text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-container-low)] text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--on-surface)]">
            Loading registration
          </h2>
          <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
            Preparing your secure sign-up flow.
          </p>
        </AuthPanel>
        <AuthFooterMeta className="pt-8" />
      </div>
    </AuthCanvas>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterPageContent />
    </Suspense>
  );
}
