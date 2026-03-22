"use client";

import { Suspense, useEffect, useState } from "react";
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

  return null;
}

export default function Page() {
  return null;
}
