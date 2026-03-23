"use client";

import { useState } from "react";
import { Loader2, RotateCcw, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormStatusMessage } from "@/app/components/a11y/form-status-message";
import { Button } from "@/app/components/ui/button";
import { GlobalModal } from "@/app/components/ui/global-modal";

type RetryRunDialogProps = {
  orgSlug: string;
  runId: string;
  disabled?: boolean;
};

export function RetryRunDialog({
  orgSlug,
  runId,
  disabled = false,
}: RetryRunDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRetryRun = async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/executions/${runId}/retry`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason,
          }),
        },
      );

      const payload = (await response.json()) as {
        error?: string;
        attemptNumber?: number;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to retry run");
      }

      toast.success(
        payload.attemptNumber
          ? `Retry attempt ${payload.attemptNumber} queued.`
          : "Retry queued.",
      );
      setOpen(false);
      router.refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to retry run";
      setFeedback(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="rounded-xl"
        disabled={disabled}
        onClick={() => {
          setFeedback(null);
          setOpen(true);
        }}
      >
        <RotateCcw className="h-4 w-4" />
        Retry run
      </Button>

      <GlobalModal open={open} onClose={() => setOpen(false)} titleId="retry-run-title">
        <div className="flex min-h-full flex-1 items-center justify-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
          <div className="glass-panel-strong w-full max-w-2xl rounded-[1.85rem] p-6 shadow-[0_20px_44px_rgba(4,17,29,0.3)] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-primary/12 text-primary">
                <Wrench className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="label-caps text-primary">Run recovery</p>
                <h2
                  id="retry-run-title"
                  className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]"
                >
                  Retry {runId}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                  This reuses the same run id, payload, workflow version, and
                  correlation lineage while appending a new attempt to the history.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
              <label htmlFor="execution-retry-reason" className="label-caps mb-2 ml-1 block">
                Retry note
              </label>
              <textarea
                id="execution-retry-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Optional context for why this run is being retried"
                className="min-h-28 w-full rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
              />
            </div>

            <FormStatusMessage
              id="execution-retry-status"
              message={feedback}
              tone="error"
              className="mt-5"
            />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={loading}
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                className="premium-gradient rounded-xl"
                disabled={loading}
                onClick={handleRetryRun}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Queueing...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Confirm retry
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </GlobalModal>
    </>
  );
}
