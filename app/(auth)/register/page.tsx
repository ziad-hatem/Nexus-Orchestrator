"use client";

import { Suspense, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Loader2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AuthBrand,
  AuthCanvas,
  AuthFooterMeta,
  AuthInfoBox,
  AuthPanel,
} from "@/app/components/auth/auth-shell";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { getPasswordMismatchError } from "./register-flow";
import { safeRedirectPath } from "@/lib/redirect-path";

const registerSteps = [
  {
    key: "workspace",
    title: "Workspace setup",
    subtitle: "Name the organization your team will collaborate in.",
    icon: Building2,
  },
  {
    key: "profile",
    title: "Your profile",
    subtitle: "Tell us who is setting up the first admin account.",
    icon: UserRound,
  },
  {
    key: "security",
    title: "Secure access",
    subtitle: "Create the credentials you will use to sign in.",
    icon: ShieldCheck,
  },
] as const;

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stepIndex, setStepIndex] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const redirectPath = safeRedirectPath(searchParams.get("next")) ?? "/";
  const isInvite = redirectPath.startsWith("/invite/");
  const activeSteps = isInvite ? registerSteps.slice(1) : registerSteps;

  const loginUrl = new URLSearchParams(
    redirectPath === "/" ? {} : { next: redirectPath },
  );

  if (email.trim()) {
    loginUrl.set("email", email.trim());
  }

  const loginQuery = loginUrl.toString();
  const loginPath = `/login${loginQuery ? `?${loginQuery}` : ""}`;
  const currentStep = activeSteps[stepIndex];
  const isLastStep = stepIndex === activeSteps.length - 1;

  const getStepError = (index: number): string | null => {
    const currentStepKey = activeSteps[index].key;

    if (currentStepKey === "workspace") {
      if (!company.trim()) {
        return "Enter your organization name to continue.";
      }
      return null;
    }

    if (currentStepKey === "profile") {
      if (!firstName.trim() || !lastName.trim()) {
        return "Enter your full name to continue.";
      }
      return null;
    }

    if (!isEmailValid(email)) {
      return "Enter a valid work email to continue.";
    }

    if (password.trim().length < 6) {
      return "Password must be at least 6 characters.";
    }

    return getPasswordMismatchError(password, confirmPassword);
  };

  const handleNextStep = () => {
    const stepError = getStepError(stepIndex);
    if (stepError) {
      setError(stepError);
      return;
    }

    setError("");
    setStepIndex((current) => Math.min(current + 1, activeSteps.length - 1));
  };

  const handlePreviousStep = () => {
    setError("");
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const stepError = getStepError(stepIndex);
    if (stepError) {
      setError(stepError);
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
    <AuthCanvas footer={<AuthFooterMeta className="pt-8" />}>
      <div className="mx-auto flex w-full max-w-[32rem] flex-col">
        <AuthBrand
          className="mb-10"
          subtitle="Design your operational future."
        />
        <AuthPanel>
          <div className="mb-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              {activeSteps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index === stepIndex;
                const isComplete = index < stepIndex;
                const lastIcon = activeSteps.length - 1;
                return (
                  <div
                    key={step.key}
                    className={`flex min-w-0 ${index === lastIcon ? "" : "flex-1"} items-center gap-3`}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm transition-colors ${
                        isActive
                          ? "border-primary bg-primary text-[var(--on-primary)] shadow-[0_12px_30px_rgba(0,95,158,0.18)]"
                          : isComplete
                            ? "border-emerald-500/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
                            : "border-[var(--outline-variant)] bg-[var(--surface-container-low)] text-[var(--on-surface-variant)]"
                      }`}
                    >
                      <StepIcon className="h-4 w-4" />
                    </div>
                    {index < activeSteps.length - 1 ? (
                      <div
                        className={`h-px flex-1 ${index < stepIndex ? "bg-primary/50" : "bg-[var(--outline-variant)]"}`}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--on-surface)]">
              {currentStep.title}
            </h2>
            <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
              {currentStep.subtitle}
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
            {activeSteps[stepIndex].key === "workspace" ? (
              <>
                <div>
                  <label
                    className="label-caps mb-2 ml-1 block"
                    htmlFor="company"
                  >
                    Organization Name
                  </label>
                  <Input
                    id="company"
                    placeholder="Acme Corp"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    disabled={loading}
                    className="input-field border-0 px-4 py-3 shadow-none"
                    required
                  />
                </div>
                <AuthInfoBox className="mt-1">
                  This becomes your team workspace and the home for your first
                  workflows, runs, and audit history.
                </AuthInfoBox>
              </>
            ) : null}

            {activeSteps[stepIndex].key === "profile" ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    className="label-caps mb-2 ml-1 block"
                    htmlFor="firstName"
                  >
                    First Name
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
                <div>
                  <label
                    className="label-caps mb-2 ml-1 block"
                    htmlFor="lastName"
                  >
                    Last Name
                  </label>
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
            ) : null}

            {activeSteps[stepIndex].key === "security" ? (
              <>
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
                  <label
                    className="label-caps mb-2 ml-1 block"
                    htmlFor="password"
                  >
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

                <AuthInfoBox className="mt-1">
                  We will send a verification email to activate your workspace
                  securely after account creation.
                </AuthInfoBox>
              </>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="min-h-[3.25rem] rounded-xl border-0 bg-[var(--surface-container-high)] text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container)] sm:min-w-[10rem]"
                onClick={handlePreviousStep}
                disabled={loading || stepIndex === 0}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              {!isLastStep ? (
                <Button
                  type="button"
                  className="premium-gradient min-h-[3.25rem] rounded-xl px-6 text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,95,158,0.18)] hover:opacity-95 sm:min-w-[11rem]"
                  onClick={handleNextStep}
                  disabled={loading}
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="premium-gradient min-h-[3.25rem] rounded-xl px-6 text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,95,158,0.18)] hover:opacity-95 sm:min-w-[13rem]"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : isInvite ? (
                    "Create Account"
                  ) : (
                    "Create Enterprise Account"
                  )}
                </Button>
              )}
            </div>
          </form>
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
      </div>
    </AuthCanvas>
  );
}

function RegisterPageFallback() {
  return (
    <AuthCanvas footer={<AuthFooterMeta className="pt-8" />}>
      <div className="mx-auto flex w-full max-w-[32rem] flex-col">
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
