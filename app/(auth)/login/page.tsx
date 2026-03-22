"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { useAuthenticatePasskey } from "next-passkey-webauthn/client";
import {
  AuthBrand,
  AuthCanvas,
  AuthDividerLabel,
  AuthFooterMeta,
  AuthPanel,
  AuthTrustBadges,
} from "@/app/components/auth/auth-shell";
import {
  MagicLinkPanel,
  MfaPanel,
  PasskeyStatusPanel,
  VerificationHelpText,
} from "@/app/components/auth/auth-verification-panels";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { hasVerifiedQuery, mapLoginError } from "./login-flow";
import { passkeyEndpoints } from "@/lib/passkey-endpoints";
import { safeRedirectPath } from "@/lib/redirect-path";
import { supabase } from "@/lib/supabase";

type SignInResultWithCode = {
  error?: string | null;
  code?: string | null;
  url?: string | null;
};

type PasskeyAuthenticateResult = {
  verified: boolean;
  assertionToken?: string | null;
};

type MfaSendResponse = {
  message?: string;
  email?: string | null;
  error?: string;
};

type MfaVerifyResponse = {
  verified?: boolean;
  mfaAssertion?: string;
  error?: string;
};

type PasskeyLookupResponse = {
  hasPasskey?: boolean;
  userId?: string | null;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isMultiStepAuthEnabled(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  return (metadata as Record<string, unknown>).multi_step_auth_enabled === true;
}

function buildAuthPageHref(pathname: string, redirectPath: string): string {
  if (redirectPath === "/") {
    return pathname;
  }

  const searchParams = new URLSearchParams({ next: redirectPath });
  return `${pathname}?${searchParams.toString()}`;
}

function mapPasswordSignInError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Failed to sign in";
  const normalized = raw.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return mapLoginError("CredentialsSignin");
  }

  if (normalized.includes("email not confirmed")) {
    return "Please verify your email address before signing in.";
  }

  return raw;
}

function readAuthErrorCode(
  result: SignInResultWithCode | undefined,
): string | null {
  if (result?.code) {
    return result.code;
  }

  if (!result?.url || typeof window === "undefined") {
    return null;
  }

  try {
    const parsedUrl = new URL(result.url, window.location.origin);
    return parsedUrl.searchParams.get("code");
  } catch {
    return null;
  }
}

function mapPasskeyRuntimeError(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : "Failed to sign in with passkey";
  const normalized = raw.toLowerCase();

  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Passkeys require HTTPS (or localhost). On phone, open your HTTPS domain, not a plain HTTP URL.";
  }

  if (normalized.includes("not supported")) {
    return "This browser/device cannot use passkeys for this site. Update browser and ensure HTTPS.";
  }

  if (normalized.includes("credential not found")) {
    return "No matching passkey was found for this email. Confirm the email or use password/magic link.";
  }

  return raw;
}

async function sendMfaCode(accessToken: string): Promise<MfaSendResponse> {
  const response = await fetch("/api/auth/mfa/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accessToken }),
  });

  const payload = (await response.json()) as MfaSendResponse;
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to send verification code");
  }

  return payload;
}

async function verifyMfaCode(params: {
  accessToken: string;
  code: string;
}): Promise<string> {
  const response = await fetch("/api/auth/mfa/email/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessToken: params.accessToken,
      code: params.code,
    }),
  });

  const payload = (await response.json()) as MfaVerifyResponse;
  if (!response.ok || !payload.verified || !payload.mfaAssertion) {
    throw new Error(payload.error ?? "Failed to verify code");
  }

  return payload.mfaAssertion;
}

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

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [isSigningInWithPasskey, setIsSigningInWithPasskey] = useState(false);
  const [isCheckingPasskey, setIsCheckingPasskey] = useState(false);
  const [hasRegisteredPasskey, setHasRegisteredPasskey] = useState(false);
  const [passkeyUserId, setPasskeyUserId] = useState<string | null>(null);
  const [passkeyLookupEmail, setPasskeyLookupEmail] = useState<string>("");
  const [isSendingMfaCode, setIsSendingMfaCode] = useState(false);
  const [isVerifyingMfaCode, setIsVerifyingMfaCode] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaTargetEmail, setMfaTargetEmail] = useState<string | null>(null);
  const [mfaInfo, setMfaInfo] = useState("");
  const [magicLinkTargetEmail, setMagicLinkTargetEmail] = useState<
    string | null
  >(null);
  const [magicLinkInfo, setMagicLinkInfo] = useState("");
  const [error, setError] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const { authenticate: authenticatePasskey } = useAuthenticatePasskey({
    endpoints: passkeyEndpoints,
  });
  const redirectPath = useMemo(
    () => safeRedirectPath(searchParams.get("next")) ?? "/",
    [searchParams],
  );
  const registerPath = useMemo(
    () => buildAuthPageHref("/register", redirectPath),
    [redirectPath],
  );
  const normalizedEmail = normalizeEmail(email);
  const hasValidEmail = isEmailFormat(normalizedEmail);

  const disableLoginActions =
    loading ||
    isSendingMagicLink ||
    isSigningInWithPasskey ||
    isSendingMfaCode ||
    isVerifyingMfaCode;
  const mfaBusy = isSendingMfaCode || isVerifyingMfaCode;

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      hasVerifiedQuery(window.location.search)
    ) {
      setIsVerified(true);
    }
  }, []);

  useEffect(() => {
    const prefilledEmail = searchParams.get("email");
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
  }, [searchParams]);

  useEffect(() => {
    const errorCode = searchParams.get("error");
    if (errorCode === "account_suspended") {
      setError(mapLoginError("CredentialsSignin", "account_suspended"));
    }
  }, [searchParams]);

  useEffect(() => {
    setHasRegisteredPasskey(false);
    setPasskeyUserId(null);
    setPasskeyLookupEmail("");

    if (!hasValidEmail) {
      setIsCheckingPasskey(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsCheckingPasskey(true);
      try {
        const response = await fetch("/api/auth/passkey/lookup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: normalizedEmail }),
          signal: controller.signal,
        });

        const payload = (await response.json()) as PasskeyLookupResponse;
        const discoveredUserId =
          typeof payload.userId === "string" ? payload.userId.trim() : "";
        const available =
          response.ok &&
          payload.hasPasskey === true &&
          discoveredUserId.length > 0;

        setHasRegisteredPasskey(available);
        setPasskeyUserId(available ? discoveredUserId : null);
        setPasskeyLookupEmail(normalizedEmail);
      } catch (lookupError: unknown) {
        if (lookupError instanceof Error && lookupError.name === "AbortError") {
          return;
        }
        setHasRegisteredPasskey(false);
        setPasskeyUserId(null);
        setPasskeyLookupEmail("");
      } finally {
        setIsCheckingPasskey(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
      setIsCheckingPasskey(false);
    };
  }, [hasValidEmail, normalizedEmail]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isVerified && countdown > 0) {
      timer = setTimeout(() => setCountdown((current) => current - 1), 1000);
    } else if (isVerified && countdown === 0) {
      setIsVerified(false);
      router.replace("/login");
    }
    return () => clearTimeout(timer);
  }, [isVerified, countdown, router]);

  const runPasskeyChallenge = async (userId: string): Promise<string> => {
    if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
      throw new Error("Passkeys are not supported in this browser");
    }
    if (!window.isSecureContext) {
      throw new Error(
        "Passkeys require HTTPS (or localhost). On phone, use your HTTPS domain.",
      );
    }

    const result = (await authenticatePasskey(
      userId,
    )) as PasskeyAuthenticateResult;
    if (!result.verified || !result.assertionToken) {
      throw new Error("Passkey authentication was not verified.");
    }

    return result.assertionToken;
  };

  const getSessionTokens = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const refreshToken = sessionData.session?.refresh_token;
    if (!accessToken || !refreshToken) {
      throw new Error(
        "Authentication session is missing. Please sign in again.",
      );
    }

    return { accessToken, refreshToken };
  };

  const finalizeSessionSignIn = async (params?: { mfaAssertion?: string }) => {
    const { accessToken, refreshToken } = await getSessionTokens();
    const nextAuthResult = (await signIn("supabase-token", {
      redirect: false,
      accessToken,
      refreshToken,
      mfaAssertion: params?.mfaAssertion,
    })) as SignInResultWithCode | undefined;

    if (nextAuthResult?.error) {
      const errorCode = readAuthErrorCode(nextAuthResult);
      if (errorCode === "account_suspended") {
        await supabase.auth.signOut();
      }
      throw new Error(mapLoginError(nextAuthResult.error, errorCode));
    }
  };

  const startMfaStep = async (fallbackEmail: string) => {
    setIsSendingMfaCode(true);
    try {
      const { accessToken } = await getSessionTokens();
      const response = await sendMfaCode(accessToken);
      setRequiresMfa(true);
      setMfaCode("");
      setMfaTargetEmail(response.email ?? fallbackEmail);
      setMfaInfo(response.message ?? "Verification code sent to your email.");
      toast.success("Verification code sent to your email.");
    } finally {
      setIsSendingMfaCode(false);
    }
  };

  const handlePasswordSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const nextEmail = normalizeEmail(email);
      const { data, error: supabaseError } =
        await supabase.auth.signInWithPassword({
          email: nextEmail,
          password,
        });

      if (supabaseError || !data.user) {
        throw new Error(mapPasswordSignInError(supabaseError));
      }

      if (isMultiStepAuthEnabled(data.user.user_metadata)) {
        await startMfaStep(nextEmail);
        return;
      }

      await finalizeSessionSignIn();
      toast.success("Logged in successfully");
      router.push(redirectPath);
    } catch (submitError: unknown) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to sign in";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfaCode = async () => {
    const trimmedCode = mfaCode.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      setError("Enter the 6-digit verification code from your email.");
      return;
    }

    setError("");
    setIsVerifyingMfaCode(true);

    try {
      const { accessToken } = await getSessionTokens();
      const mfaAssertion = await verifyMfaCode({
        accessToken,
        code: trimmedCode,
      });

      await finalizeSessionSignIn({ mfaAssertion });
      toast.success("Signed in with multi-step authentication");
      router.push(redirectPath);
    } catch (verifyError: unknown) {
      const message =
        verifyError instanceof Error
          ? verifyError.message
          : "Failed to verify code";
      setError(message);
      toast.error(message);
    } finally {
      setIsVerifyingMfaCode(false);
    }
  };

  const handleResendMfaCode = async () => {
    setError("");
    setIsSendingMfaCode(true);

    try {
      const { accessToken } = await getSessionTokens();
      const response = await sendMfaCode(accessToken);
      setMfaTargetEmail((previous) => response.email ?? previous);
      setMfaInfo(response.message ?? "Verification code sent to your email.");
      toast.success("Verification code resent.");
    } catch (resendError: unknown) {
      const message =
        resendError instanceof Error
          ? resendError.message
          : "Failed to resend verification code";
      setError(message);
      toast.error(message);
    } finally {
      setIsSendingMfaCode(false);
    }
  };

  const handleCancelMfa = async () => {
    await supabase.auth.signOut();
    setRequiresMfa(false);
    setMfaCode("");
    setMfaInfo("");
    setMfaTargetEmail(null);
    setPassword("");
    setError("");
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const { error: supabaseError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildAuthPageHref(
            `${window.location.origin}/auth/callback`,
            redirectPath,
          ),
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

  const handleSendMagicLink = async () => {
    const nextEmail = normalizeEmail(email);
    if (!nextEmail) {
      setError("Enter your email to receive a magic link");
      return;
    }

    if (!isEmailFormat(nextEmail)) {
      setError("Enter a valid email address to receive a magic link");
      return;
    }

    setError("");
    setIsSendingMagicLink(true);

    try {
      const response = await fetch("/api/auth/passwordless/magic-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: nextEmail, next: redirectPath }),
      });

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to send magic link");
      }

      const successMessage =
        data.message ?? "Check your email for a sign-in link.";
      setMagicLinkTargetEmail(nextEmail);
      setMagicLinkInfo(successMessage);
      toast.success(successMessage);
    } catch (sendError: unknown) {
      const message =
        sendError instanceof Error
          ? sendError.message
          : "Failed to send magic link";
      setError(message);
      toast.error(message);
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setError("");

    if (!hasValidEmail) {
      setError("Enter a valid email to continue with passkey.");
      return;
    }

    if (isCheckingPasskey || passkeyLookupEmail !== normalizedEmail) {
      setError("Checking passkey availability. Try again in a moment.");
      return;
    }

    if (!hasRegisteredPasskey || !passkeyUserId) {
      setError("No registered passkey was found for this email.");
      return;
    }

    if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
      setError("Passkeys are not supported in this browser");
      return;
    }
    if (!window.isSecureContext) {
      setError(
        "Passkeys require HTTPS (or localhost). On phone, use your HTTPS domain.",
      );
      return;
    }

    setIsSigningInWithPasskey(true);

    try {
      const assertionToken = await runPasskeyChallenge(passkeyUserId);
      const result = (await signIn("passkey-assertion", {
        redirect: false,
        assertionToken,
      })) as SignInResultWithCode | undefined;

      if (result?.error) {
        throw new Error(mapLoginError(result.error, readAuthErrorCode(result)));
      }

      toast.success("Signed in with passkey");
      router.push(redirectPath);
    } catch (passkeyError: unknown) {
      const message = mapPasskeyRuntimeError(passkeyError);
      setError(message);
      toast.error(message);
    } finally {
      setIsSigningInWithPasskey(false);
    }
  };

  const handleOpenMailApp = () => {
    if (typeof window !== "undefined") {
      window.location.href = "mailto:";
    }
  };

  const passkeyDescription = !hasValidEmail
    ? "Use biometrics or a security key once we confirm a registered passkey for this account."
    : isCheckingPasskey || passkeyLookupEmail !== normalizedEmail
      ? "Checking for a registered passkey on this workspace."
      : hasRegisteredPasskey
        ? "A passkey is registered for this email. Use biometrics or your security key to continue."
        : "No passkey was found for this email yet. You can still continue with your magic link.";

  if (isVerified) {
    return (
      <AuthCanvas>
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col">
          <AuthBrand className="mb-10" />
          <AuthPanel className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-container-low)] text-primary">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
              Email verified
            </h2>
            <p className="mt-3 body-md text-[var(--on-surface-variant)]">
              Your email is confirmed. Redirecting to login in {countdown}s.
            </p>
            <Button
              variant="outline"
              className="mt-8 min-h-[3.25rem] w-full rounded-xl border-0 bg-[var(--surface-container-high)] text-sm font-semibold text-primary hover:bg-[var(--surface-container)]"
              onClick={() => {
                setIsVerified(false);
                router.replace("/login");
              }}
            >
              Continue to Login
            </Button>
          </AuthPanel>
          <AuthFooterMeta />
        </div>
      </AuthCanvas>
    );
  }

  if (requiresMfa) {
    return (
      <AuthCanvas>
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col">
          <MfaPanel
            description={`We've sent a 6-digit verification code to ${mfaTargetEmail ?? "your registered email"}. Enter the code below to continue.`}
            code={mfaCode}
            info={mfaInfo}
            error={error}
            onCodeChange={setMfaCode}
            onVerify={handleVerifyMfaCode}
            onResend={handleResendMfaCode}
            onAlternative={() => void handleCancelMfa()}
            verifyDisabled={mfaBusy}
            resendDisabled={mfaBusy}
            alternativeDisabled={mfaBusy}
            isVerifying={isVerifyingMfaCode}
            isResending={isSendingMfaCode}
          />
          <AuthFooterMeta className="pt-8" />
        </div>
      </AuthCanvas>
    );
  }

  if (magicLinkTargetEmail) {
    return (
      <AuthCanvas>
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col">
          <AuthBrand className="mb-10" />
          {error ? (
            <div className="mx-auto mb-6 max-w-2xl rounded-2xl bg-[var(--error-container)] px-4 py-3 text-sm font-medium text-[var(--error)]">
              {error}
            </div>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-2">
            <MagicLinkPanel
              description={
                magicLinkInfo ||
                "We've sent a secure sign-in link to your registered email."
              }
              email={magicLinkTargetEmail}
              onPrimaryAction={handleOpenMailApp}
              onSecondaryAction={() => void handleSendMagicLink()}
              primaryDisabled={isSendingMagicLink}
              secondaryDisabled={isSendingMagicLink}
              secondaryActionLabel={
                isSendingMagicLink ? "Sending..." : "Resend Link"
              }
            />
            <PasskeyStatusPanel
              description={passkeyDescription}
              status={
                isCheckingPasskey || passkeyLookupEmail !== normalizedEmail
                  ? "Checking registered credentials..."
                  : hasRegisteredPasskey
                    ? "Ready to verify on your device."
                    : "No passkey available yet."
              }
              primaryLabel="Try Biometric Login"
              onPrimaryAction={handlePasskeySignIn}
              disabled={
                disableLoginActions ||
                isCheckingPasskey ||
                passkeyLookupEmail !== normalizedEmail ||
                !hasRegisteredPasskey
              }
              isBusy={isSigningInWithPasskey}
            />
          </div>
          <div className="mt-6 text-center">
            <Button
              type="button"
              variant="ghost"
              className="rounded-full px-4 py-2 text-sm font-medium text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)]"
              onClick={() => {
                setMagicLinkTargetEmail(null);
                setMagicLinkInfo("");
              }}
              disabled={disableLoginActions}
            >
              Back to sign-in methods
            </Button>
          </div>
          <VerificationHelpText />
          <AuthFooterMeta className="pt-8" />
        </div>
      </AuthCanvas>
    );
  }

  return (
    <AuthCanvas>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[32rem] flex-col">
        <AuthBrand className="mb-10" />
        <AuthPanel>
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--on-surface)]">
              Welcome Back
            </h2>
            <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
              Please enter your details to access your workspace.
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

          <Button
            type="button"
            variant="outline"
            className="min-h-[3.25rem] w-full rounded-xl border-0 bg-[var(--surface-container-high)] text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container)]"
            onClick={handleGoogleSignIn}
            disabled={disableLoginActions}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting Google...
              </>
            ) : (
              <>
                <GoogleMark />
                Continue with Google
              </>
            )}
          </Button>

          <div className="my-6">
            <AuthDividerLabel label="Or use email" />
          </div>

          <form className="space-y-5" onSubmit={handlePasswordSignIn}>
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
                disabled={disableLoginActions}
                className="input-field border-0 px-4 py-3 shadow-none"
                required
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  className="label-caps ml-1 block"
                  htmlFor="password"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => router.push("/forgot-password")}
                  className="text-xs font-semibold text-primary transition-colors hover:text-[var(--primary-container)]"
                  disabled={disableLoginActions}
                >
                  Forgot?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                disabled={disableLoginActions}
                className="input-field border-0 px-4 py-3 shadow-none"
                required
              />
            </div>

            <Button
              type="submit"
              className="premium-gradient min-h-[3.25rem] w-full rounded-xl text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,95,158,0.18)] hover:opacity-95"
              disabled={disableLoginActions}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In to Orchestrator"
              )}
            </Button>
          </form>

          <div className="tonal-divider mt-8 flex flex-col gap-4 pt-6">
            <button
              type="button"
              className="group flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--surface-container-low)]"
              onClick={() => void handleSendMagicLink()}
              disabled={disableLoginActions}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-container-low)] text-primary">
                  {isSendingMagicLink ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--on-surface)]">
                    Email Magic Link
                  </p>
                  <p className="text-[11px] text-[var(--on-surface-variant)]">
                    Sign in securely without a password
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--outline)] transition-transform group-hover:translate-x-1" />
            </button>

            <button
              type="button"
              className="group flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--surface-container-low)]"
              onClick={() => void handlePasskeySignIn()}
              disabled={
                disableLoginActions ||
                !hasValidEmail ||
                isCheckingPasskey ||
                passkeyLookupEmail !== normalizedEmail ||
                !hasRegisteredPasskey
              }
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-container-low)] text-primary">
                  {isSigningInWithPasskey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Fingerprint className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--on-surface)]">
                    Sign in with Passkey
                  </p>
                  <p className="text-[11px] text-[var(--on-surface-variant)]">
                    {isCheckingPasskey
                      ? "Checking registered passkeys for this email"
                      : hasRegisteredPasskey
                        ? "Use biometrics or a security key"
                        : "Enter a valid work email to unlock passkeys"}
                  </p>
                </div>
              </div>
              <KeyRound className="h-4 w-4 text-[var(--outline)] transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </AuthPanel>

        <div className="mt-6 text-center text-sm text-[var(--on-surface-variant)]">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={() => router.push(registerPath)}
            className="font-semibold text-primary transition-colors hover:text-[var(--primary-container)]"
            disabled={disableLoginActions}
          >
            Sign up
          </button>
        </div>

        <AuthTrustBadges />
        <AuthFooterMeta />
      </div>
    </AuthCanvas>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageFallback() {
  return (
    <AuthCanvas>
      <div className="mx-auto max-w-md">
        <AuthBrand className="mb-10" />
        <AuthPanel className="text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-container-low)] text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
            Loading login
          </h2>
          <p className="mt-3 body-md text-[var(--on-surface-variant)]">
            Preparing the secure sign-in flow.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading, please wait.
          </div>
        </AuthPanel>
      </div>
    </AuthCanvas>
  );
}
