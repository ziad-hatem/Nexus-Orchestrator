"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Info, Loader2, TriangleAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  AuthBrand,
  AuthCanvas,
  AuthFooterMeta,
} from "@/app/components/auth/auth-shell";
import {
  AsyncStatePanel,
  MagicLinkPanel,
  MfaPanel,
  VerificationHelpText,
} from "@/app/components/auth/auth-verification-panels";
import { safeRedirectPath } from "@/lib/redirect-path";
import { supabase } from "@/lib/supabase";

type CompletionState = {
  isLoading: boolean;
  error: string | null;
  requiresMfa: boolean;
  info: string | null;
  email: string | null;
};

type SignInResultWithCode = {
  error?: string | null;
  code?: string | null;
  url?: string | null;
};

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

function mapAuthError(errorMessage: string, code?: string | null): string {
  if (code === "account_suspended") {
    return "Your account is suspended. Contact your organization admin.";
  }
  if (code === "mfa_required") {
    return "Multi-step authentication is enabled. Enter your email verification code to continue.";
  }
  if (errorMessage === "CredentialsSignin") {
    return "Could not complete sign-in for this account.";
  }
  return errorMessage;
}

function readAuthErrorCode(result: {
  code?: string | null;
  url?: string | null;
}): string | null {
  if (result.code) {
    return result.code;
  }

  if (!result.url || typeof window === "undefined") {
    return null;
  }

  try {
    const parsedUrl = new URL(result.url, window.location.origin);
    return parsedUrl.searchParams.get("code");
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

async function sendMfaCode(accessToken: string): Promise<{
  message?: string;
  email?: string | null;
}> {
  const response = await fetch("/api/auth/mfa/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accessToken }),
  });

  const payload = (await response.json()) as {
    message?: string;
    email?: string | null;
    error?: string;
  };

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

  const payload = (await response.json()) as {
    verified?: boolean;
    mfaAssertion?: string;
    error?: string;
  };

  if (!response.ok || !payload.verified || !payload.mfaAssertion) {
    throw new Error(payload.error ?? "Failed to verify code");
  }

  return payload.mfaAssertion;
}

function MagicLinkCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CompletionState>({
    isLoading: true,
    error: null,
    requiresMfa: false,
    info: null,
    email: null,
  });
  const [pendingTokens, setPendingTokens] = useState<TokenPair | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [isResendingMfa, setIsResendingMfa] = useState(false);

  const queryString = useMemo(() => searchParams.toString(), [searchParams]);
  const redirectPath = useMemo(
    () => safeRedirectPath(searchParams.get("next")) ?? "/",
    [searchParams],
  );
  const loginPath = useMemo(() => {
    if (redirectPath === "/") {
      return "/login";
    }

    return `/login?${new URLSearchParams({ next: redirectPath }).toString()}`;
  }, [redirectPath]);

  useEffect(() => {
    let isMounted = true;

    async function completeLogin() {
      try {
        const params = new URLSearchParams(queryString);
        const code = params.get("code");

        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        if (code) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code);
          if (
            error ||
            !data.session?.access_token ||
            !data.session.refresh_token
          ) {
            throw new Error(
              error?.message ?? "Magic link code exchange failed",
            );
          }
          accessToken = data.session.access_token;
          refreshToken = data.session.refresh_token;
        } else {
          const hash =
            typeof window !== "undefined" &&
            window.location.hash.startsWith("#")
              ? window.location.hash.slice(1)
              : "";
          const hashParams = new URLSearchParams(hash);
          const accessFromHash = hashParams.get("access_token");
          const refreshFromHash = hashParams.get("refresh_token");

          if (accessFromHash && refreshFromHash) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessFromHash,
              refresh_token: refreshFromHash,
            });
            if (
              error ||
              !data.session?.access_token ||
              !data.session.refresh_token
            ) {
              throw new Error(
                error?.message ?? "Failed to initialize auth session",
              );
            }
            accessToken = data.session.access_token;
            refreshToken = data.session.refresh_token;
          } else {
            throw new Error("Missing authentication code in callback URL");
          }
        }

        const signInResult = (await signIn("supabase-token", {
          redirect: false,
          accessToken,
          refreshToken,
        })) as SignInResultWithCode | undefined;

        if (signInResult?.error) {
          const signInErrorCode = readAuthErrorCode(signInResult);
          if (signInErrorCode === "mfa_required") {
            const mfaResponse = await sendMfaCode(accessToken);

            if (!isMounted) {
              return;
            }

            setPendingTokens({
              accessToken,
              refreshToken,
            });
            setState({
              isLoading: false,
              error: null,
              requiresMfa: true,
              info:
                mfaResponse.message ?? "Verification code sent to your email.",
              email: mfaResponse.email ?? null,
            });
            return;
          }

          if (signInErrorCode === "account_suspended") {
            await supabase.auth.signOut();
          }

          throw new Error(mapAuthError(signInResult.error, signInErrorCode));
        }

        router.replace(redirectPath);
      } catch (error: unknown) {
        if (!isMounted) {
          return;
        }
        setState({
          isLoading: false,
          error: getErrorMessage(
            error,
            "Could not complete magic link sign-in",
          ),
          requiresMfa: false,
          info: null,
          email: null,
        });
      }
    }

    void completeLogin();

    return () => {
      isMounted = false;
    };
  }, [queryString, redirectPath, router]);

  const handleVerifyMfa = async () => {
    if (!pendingTokens) {
      setState((previous) => ({
        ...previous,
        error: "Authentication session is missing. Restart sign-in.",
      }));
      return;
    }

    const trimmedCode = mfaCode.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      setState((previous) => ({
        ...previous,
        error: "Enter the 6-digit verification code from your email.",
      }));
      return;
    }

    setIsVerifyingMfa(true);
    setState((previous) => ({ ...previous, error: null }));

    try {
      const mfaAssertion = await verifyMfaCode({
        accessToken: pendingTokens.accessToken,
        code: trimmedCode,
      });

      const retryResult = (await signIn("supabase-token", {
        redirect: false,
        accessToken: pendingTokens.accessToken,
        refreshToken: pendingTokens.refreshToken,
        mfaAssertion,
      })) as SignInResultWithCode | undefined;

      if (retryResult?.error) {
        const retryCode = readAuthErrorCode(retryResult);
        if (retryCode === "account_suspended") {
          await supabase.auth.signOut();
        }
        throw new Error(mapAuthError(retryResult.error, retryCode));
      }

      router.replace(redirectPath);
    } catch (error: unknown) {
      setState((previous) => ({
        ...previous,
        error: getErrorMessage(error, "Failed to verify MFA code"),
      }));
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  const handleResendMfa = async () => {
    if (!pendingTokens) {
      setState((previous) => ({
        ...previous,
        error: "Authentication session is missing. Restart sign-in.",
      }));
      return;
    }

    setIsResendingMfa(true);
    setState((previous) => ({ ...previous, error: null }));

    try {
      const response = await sendMfaCode(pendingTokens.accessToken);
      setState((previous) => ({
        ...previous,
        info: response.message ?? "Verification code sent to your email.",
        email: response.email ?? previous.email,
      }));
    } catch (error: unknown) {
      setState((previous) => ({
        ...previous,
        error: getErrorMessage(error, "Failed to resend verification code"),
      }));
    } finally {
      setIsResendingMfa(false);
    }
  };

  const handleBackToLogin = async () => {
    await supabase.auth.signOut();
    router.replace(loginPath);
  };

  const handleOpenMailApp = () => {
    if (typeof window !== "undefined") {
      window.location.href = "mailto:";
    }
  };

  if (state.isLoading) {
    return (
      <AuthCanvas footer={<AuthFooterMeta />}>
        <div className="mx-auto flex w-full max-w-md flex-col">
          <AsyncStatePanel
            title="Signing you in"
            description="Validating your magic link and completing sign-in..."
            icon={<Loader2 className="h-6 w-6 animate-spin" />}
          />
        </div>
      </AuthCanvas>
    );
  }

  if (state.requiresMfa) {
    return (
      <AuthCanvas footer={<AuthFooterMeta />}>
        <div className="mx-auto flex w-full max-w-md flex-col">
          <MfaPanel
            description={`We've sent a 6-digit verification code to ${state.email ?? "your registered email"}. Enter the code below to continue.`}
            code={mfaCode}
            info={state.info}
            error={state.error}
            onCodeChange={setMfaCode}
            onVerify={handleVerifyMfa}
            onResend={handleResendMfa}
            onAlternative={() => void handleBackToLogin()}
            verifyDisabled={isVerifyingMfa || isResendingMfa}
            resendDisabled={isVerifyingMfa || isResendingMfa}
            alternativeDisabled={isVerifyingMfa || isResendingMfa}
            isVerifying={isVerifyingMfa}
            isResending={isResendingMfa}
            alternativeLabel="Back to login"
          />
        </div>
      </AuthCanvas>
    );
  }

  if (!state.error) {
    return (
      <AuthCanvas footer={<AuthFooterMeta />}>
        <div className="mx-auto flex w-full max-w-3xl flex-col">
          <AuthBrand className="mb-10" />
          <MagicLinkPanel
            className="mx-auto max-w-2xl"
            description="We've sent a magic link to your registered email address. Use it to sign in securely without a password."
            email={state.email}
            onPrimaryAction={handleOpenMailApp}
            onSecondaryAction={() => router.replace(loginPath)}
            secondaryActionLabel="Back to Login"
          />
          <VerificationHelpText />
        </div>
      </AuthCanvas>
    );
  }

  return (
    <AuthCanvas footer={<AuthFooterMeta />}>
      <div className="mx-auto flex w-full max-w-md flex-col">
        <AsyncStatePanel
          title="Magic link failed"
          description={state.error}
          icon={<TriangleAlert className="h-6 w-6 text-[var(--error)]" />}
        />
        <div className="mt-6 text-center">
          <button
            type="button"
            className="rounded-full bg-[var(--surface-container-low)] px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-[var(--surface-container)]"
            onClick={() => router.replace(loginPath)}
          >
            Back to Login
          </button>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[var(--on-surface-variant)]">
          <Info className="h-4 w-4" />
          Re-request a fresh sign-in link if this one expired.
        </div>
      </div>
    </AuthCanvas>
  );
}

function MagicLinkCallbackFallback() {
  return (
    <AuthCanvas footer={<AuthFooterMeta />}>
      <div className="mx-auto max-w-md">
        <AsyncStatePanel
          title="Loading magic link"
          description="Preparing your secure sign-in callback."
          icon={<Loader2 className="h-6 w-6 animate-spin" />}
        />
      </div>
    </AuthCanvas>
  );
}

export default function MagicLinkCallbackPage() {
  return (
    <Suspense fallback={<MagicLinkCallbackFallback />}>
      <MagicLinkCallbackContent />
    </Suspense>
  );
}
