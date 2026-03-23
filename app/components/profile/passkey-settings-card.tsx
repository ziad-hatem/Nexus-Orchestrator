"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Fingerprint,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  getPasskeyIcon,
  useManagePasskeys,
  useRegisterPasskey,
} from "next-passkey-webauthn/client";
import type { StoredCredential } from "next-passkey-webauthn/types";
import { toast } from "sonner";
import { FormStatusMessage } from "@/app/components/a11y/form-status-message";
import { Button } from "@/app/components/ui/button";
import { passkeyEndpoints } from "@/lib/passkey-endpoints";

type PasskeySettingsCardProps = {
  userId: string | null;
  userName: string;
  userEmail: string;
};

function formatDateTime(value?: string): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function getCredentialLabel(credential: StoredCredential): string {
  const nickname = credential.deviceInfo?.nickname?.trim();
  if (nickname) {
    return nickname;
  }

  const parts = [
    credential.deviceInfo?.deviceType,
    credential.deviceInfo?.browser,
  ].filter((value): value is string => Boolean(value?.trim()));

  if (parts.length > 0) {
    return parts.join(" - ");
  }

  if (credential.authenticatorAttachment === "platform") {
    return "This device";
  }

  if (credential.authenticatorAttachment === "cross-platform") {
    return "External security key";
  }

  return "Registered passkey";
}

export function PasskeySettingsCard({
  userId,
  userName,
  userEmail,
}: PasskeySettingsCardProps) {
  const {
    register,
    loading: registering,
    error: registrationError,
  } = useRegisterPasskey({
    endpoints: passkeyEndpoints,
  });
  const {
    list,
    remove,
    loading: managingPasskeys,
    error: managementError,
  } = useManagePasskeys({
    endpoints: passkeyEndpoints,
  });
  const [passkeys, setPasskeys] = useState<StoredCredential[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [deletingCredentialId, setDeletingCredentialId] = useState<
    string | null
  >(null);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success" | "info";
    message: string;
  } | null>(null);
  const [supportState, setSupportState] = useState<{
    supported: boolean;
    message: string | null;
  }>({
    supported: false,
    message: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!window.isSecureContext) {
      setSupportState({
        supported: false,
        message: "Passkeys need HTTPS or localhost before this browser can register one.",
      });
      return;
    }

    if (!("PublicKeyCredential" in window)) {
      setSupportState({
        supported: false,
        message: "This browser or device does not support passkeys.",
      });
      return;
    }

    setSupportState({
      supported: true,
      message: "Use biometrics or a security key to add a passkey for this account.",
    });
  }, []);

  const loadPasskeys = async () => {
    if (!userId) {
      setLoadingPasskeys(false);
      return;
    }

    setLoadingPasskeys(true);

    try {
      const credentials = (await list(userId)) as StoredCredential[];
      setPasskeys(credentials);
      setFeedback((current) =>
        current?.tone === "error"
          ? current
          : {
              tone: "info",
              message:
                credentials.length > 0
                  ? "Passkeys loaded. You can add another one or remove an older credential."
                  : "No passkeys registered yet. Add one to speed up secure sign-in.",
            },
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load passkeys";
      setFeedback({
        tone: "error",
        message,
      });
    } finally {
      setLoadingPasskeys(false);
    }
  };

  useEffect(() => {
    void loadPasskeys();
  }, [userId]);

  const passkeyStatusMessage = useMemo(() => {
    if (feedback) {
      return feedback;
    }

    if (registrationError) {
      return { tone: "error" as const, message: registrationError };
    }

    if (managementError) {
      return { tone: "error" as const, message: managementError };
    }

    if (supportState.message) {
      return {
        tone: supportState.supported ? ("info" as const) : ("error" as const),
        message: supportState.message,
      };
    }

    return null;
  }, [feedback, managementError, registrationError, supportState]);

  const handleRegisterPasskey = async () => {
    if (!userId) {
      setFeedback({
        tone: "error",
        message: "Profile is still loading. Try again in a moment.",
      });
      return;
    }

    setFeedback(null);

    try {
      const result = await register(userId, {
        userName: userEmail,
        userDisplayName: userName || userEmail,
        timeout: 60_000,
      });

      if (!result.verified) {
        throw new Error("Passkey registration was not verified.");
      }

      await loadPasskeys();
      setFeedback({
        tone: "success",
        message: "Passkey registered successfully. You can now use it to sign in.",
      });
      toast.success("Passkey registered.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to register passkey";
      setFeedback({
        tone: "error",
        message,
      });
      toast.error(message);
    }
  };

  const handleDeletePasskey = async (credentialId: string) => {
    if (!userId) {
      return;
    }

    setDeletingCredentialId(credentialId);
    setFeedback(null);

    try {
      await remove(userId, credentialId);
      setPasskeys((current) =>
        current.filter((credential) => credential.credentialId !== credentialId),
      );
      setFeedback({
        tone: "success",
        message: "Passkey removed.",
      });
      toast.success("Passkey removed.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to remove passkey";
      setFeedback({
        tone: "error",
        message,
      });
      toast.error(message);
    } finally {
      setDeletingCredentialId(null);
    }
  };

  return (
    <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="label-caps">Passkeys</p>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
            Register a passkey
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
            Add biometrics or a security key so you can sign in faster without
            relying only on passwords and email verification.
          </p>
        </div>

        <Button
          type="button"
          className="premium-gradient rounded-xl"
          disabled={!supportState.supported || !userId || registering}
          onClick={handleRegisterPasskey}
        >
          {registering ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Registering...
            </>
          ) : (
            <>
              <Fingerprint className="h-4 w-4" />
              Add passkey
            </>
          )}
        </Button>
      </div>

      <FormStatusMessage
        id="profile-passkey-status"
        message={passkeyStatusMessage?.message}
        tone={passkeyStatusMessage?.tone}
        className="mt-5"
      />

      <div className="mt-6 grid gap-4">
        <div className="rounded-2xl bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Current passkeys are tied to this account only. New registrations
              reuse the existing secure WebAuthn routes already configured for the
              app.
            </span>
          </div>
        </div>

        {loadingPasskeys ? (
          <div
            className="rounded-2xl bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading registered passkeys...
            </div>
          </div>
        ) : passkeys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:color-mix(in_srgb,var(--outline-variant)_54%,transparent)] bg-[var(--surface-container-low)] p-5 text-sm text-[var(--on-surface-variant)]">
            No passkeys registered yet for this account.
          </div>
        ) : (
          passkeys.map((credential) => {
            const createdAt = formatDateTime(credential.createdAt);
            const lastUsedAt = formatDateTime(credential.lastUsedAt);

            return (
              <div
                key={credential.credentialId}
                className="rounded-[1.5rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] bg-[var(--surface-container-low)] p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <span className="text-lg" aria-hidden="true">
                          {getPasskeyIcon(credential)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--on-surface)]">
                          {getCredentialLabel(credential)}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--on-surface-variant)]">
                          {credential.credentialId}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--on-surface-variant)]">
                        {credential.authenticatorAttachment === "platform"
                          ? "Built into device"
                          : credential.authenticatorAttachment === "cross-platform"
                            ? "External key"
                            : "Authenticator"}
                      </span>
                      {credential.deviceInfo?.os ? (
                        <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--on-surface-variant)]">
                          {credential.deviceInfo.os}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-2 text-xs text-[var(--on-surface-variant)] sm:grid-cols-2">
                      <p>
                        <span className="font-semibold text-[var(--on-surface)]">
                          Created:
                        </span>{" "}
                        {createdAt ?? "Unknown"}
                      </p>
                      <p>
                        <span className="font-semibold text-[var(--on-surface)]">
                          Last used:
                        </span>{" "}
                        {lastUsedAt ?? "Not used yet"}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl text-[var(--error)] hover:text-[var(--error)]"
                    disabled={
                      managingPasskeys && deletingCredentialId === credential.credentialId
                    }
                    onClick={() => handleDeletePasskey(credential.credentialId)}
                  >
                    {deletingCredentialId === credential.credentialId ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Removing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-5 rounded-2xl bg-[var(--surface-container-low)] p-4 text-xs text-[var(--on-surface-variant)]">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            If you rotate devices, add the new passkey here before deleting the
            old one so you do not lock yourself out of biometric sign-in.
          </span>
        </div>
      </div>
    </section>
  );
}
