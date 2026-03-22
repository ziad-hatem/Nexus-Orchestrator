"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormStatusMessage } from "@/app/components/a11y/form-status-message";
import { Button } from "@/app/components/ui/button";

type AcceptInviteActionsProps = {
  token: string;
  mismatchedEmail?: boolean;
};

export function AcceptInviteActions({
  token,
  mismatchedEmail = false,
}: AcceptInviteActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleAccept = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        redirectPath?: string;
      };

      if (!response.ok || !payload.redirectPath) {
        throw new Error(payload.error ?? "Failed to accept invite");
      }

      setFeedback("Invitation accepted. Opening the workspace.");
      toast.success("Invitation accepted.");
      router.push(payload.redirectPath);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to accept invite";
      setFeedback(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    await signOut({ callbackUrl: `/login?next=/invite/${token}` });
  };

  if (mismatchedEmail) {
    return (
      <div className="space-y-3">
        <FormStatusMessage
          id="invite-account-status"
          tone="error"
          message="This invitation must be accepted with the invited email address."
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl border-0 bg-[var(--surface-container-high)] text-primary hover:bg-[var(--surface-container)]"
            onClick={handleSwitchAccount}
          >
            Switch Account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FormStatusMessage
        id="invite-accept-status"
        tone={feedback ? "error" : "info"}
        message={feedback}
        className={feedback ? "" : "sr-only"}
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          className="premium-gradient min-h-11 rounded-xl px-6"
          disabled={loading}
          onClick={handleAccept}
          aria-describedby="invite-accept-status"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Accepting...
            </>
          ) : (
            "Accept Invitation"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 rounded-xl border-0 bg-[var(--surface-container-high)] text-primary hover:bg-[var(--surface-container)]"
          onClick={handleSwitchAccount}
        >
          Use Another Account
        </Button>
      </div>
    </div>
  );
}
