"use client";

import { useState } from "react";
import { Loader2, Play, Send, X } from "lucide-react";
import { toast } from "sonner";
import { FormStatusMessage } from "@/app/components/a11y/form-status-message";
import { Button } from "@/app/components/ui/button";
import { GlobalModal } from "@/app/components/ui/global-modal";

type WorkflowManualTriggerDialogProps = {
  orgSlug: string;
  workflowId: string;
  workflowName: string;
  disabled?: boolean;
};

type ManualTriggerResponse = {
  error?: string;
  run?: {
    runId: string;
  };
};

export function WorkflowManualTriggerDialog({
  orgSlug,
  workflowId,
  workflowName,
  disabled = false,
}: WorkflowManualTriggerDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payload, setPayload] = useState('{\n  "source": "manual-run"\n}');
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setFeedback(null);

    try {
      const parsedPayload = payload.trim() ? JSON.parse(payload) : {};
      const response = await fetch(
        `/api/orgs/${orgSlug}/workflows/${workflowId}/trigger/manual`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payload: parsedPayload,
            idempotencyKey: idempotencyKey.trim() || undefined,
          }),
        },
      );

      const result = (await response.json()) as ManualTriggerResponse;
      if (!response.ok && response.status !== 202) {
        throw new Error(result.error ?? "Failed to execute manual trigger");
      }

      const message = result.run?.runId
        ? `Manual trigger accepted. Pending run ${result.run.runId} created.`
        : result.error ?? "Manual trigger request completed.";

      toast.success(message);
      setOpen(false);
      setFeedback(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to execute manual trigger";
      setFeedback(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
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
        <Play className="h-4 w-4" />
        Run now
      </Button>

      <GlobalModal open={open} onClose={() => setOpen(false)} titleId="manual-trigger-title">
        <div className="flex min-h-full flex-1 items-center justify-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
          <div className="glass-panel-strong w-full max-w-3xl rounded-[1.85rem] p-6 shadow-[0_20px_44px_rgba(4,17,29,0.3)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-caps">Manual trigger</p>
                <h2
                  id="manual-trigger-title"
                  className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]"
                >
                  Execute {workflowName}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                  Submit a JSON payload to create a pending run from the active
                  published manual trigger binding.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>

            <div className="mt-6 grid gap-4">
              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="manual-trigger-idempotency">
                  Optional idempotency key
                </label>
                <input
                  id="manual-trigger-idempotency"
                  value={idempotencyKey}
                  onChange={(event) => setIdempotencyKey(event.target.value)}
                  placeholder="trigger-20260322-001"
                  className="input-field h-12 w-full border-0 shadow-none"
                />
              </div>

              <div>
                <label className="label-caps mb-2 ml-1 block" htmlFor="manual-trigger-payload">
                  JSON payload
                </label>
                <textarea
                  id="manual-trigger-payload"
                  value={payload}
                  onChange={(event) => setPayload(event.target.value)}
                  className="min-h-72 w-full rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[#0b1c30] px-4 py-4 font-mono text-sm text-blue-100 outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>

            <FormStatusMessage
              id="manual-trigger-status"
              message={feedback}
              tone="error"
              className="mt-5"
            />

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={submitting}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="premium-gradient rounded-xl"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Execute workflow
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
