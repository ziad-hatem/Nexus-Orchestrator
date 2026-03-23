"use client";

import { type ComponentProps, useState } from "react";
import { AlertTriangle, Archive, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormStatusMessage } from "@/app/components/a11y/form-status-message";
import { Button } from "@/app/components/ui/button";
import { GlobalModal } from "@/app/components/ui/global-modal";

type WorkflowArchiveDialogProps = {
  orgSlug: string;
  workflowId: string;
  workflowName: string;
  redirectHref?: string;
  triggerLabel?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerClassName?: string;
  disabled?: boolean;
};

export function WorkflowArchiveDialog({
  orgSlug,
  workflowId,
  workflowName,
  redirectHref,
  triggerLabel = "Archive workflow",
  triggerVariant = "outline",
  triggerClassName,
  disabled = false,
}: WorkflowArchiveDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleArchive = async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/workflows/${workflowId}/archive`,
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

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to archive workflow");
      }

      toast.success("Workflow archived.");
      setOpen(false);
      if (redirectHref) {
        router.push(redirectHref);
      } else {
        router.refresh();
      }
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to archive workflow";
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
        variant={triggerVariant}
        className={triggerClassName}
        disabled={disabled}
        onClick={() => {
          setFeedback(null);
          setOpen(true);
        }}
      >
        <Archive className="h-4 w-4" />
        {triggerLabel}
      </Button>

      <GlobalModal open={open} onClose={() => setOpen(false)} titleId="archive-workflow-title">
        <div className="flex min-h-full flex-1 items-center justify-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
          <div className="glass-panel-strong w-full max-w-2xl rounded-[1.85rem] p-6 shadow-[0_20px_44px_rgba(4,17,29,0.3)] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-[var(--error-container)] text-[var(--error)]">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="label-caps text-[var(--error)]">Archive workflow</p>
                <h2
                  id="archive-workflow-title"
                  className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]"
                >
                  Freeze future changes for {workflowName}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                  Archived workflows remain visible with version history intact, but
                  they can no longer receive new drafts or published versions in this
                  phase.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
              <label
                htmlFor="workflow-archive-reason"
                className="label-caps mb-2 ml-1 block"
              >
                Archive reason
              </label>
              <textarea
                id="workflow-archive-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Optional handoff note for the audit log"
                className="min-h-28 w-full rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
              />
            </div>

            <FormStatusMessage
              id="workflow-archive-status"
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
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="rounded-xl"
                disabled={loading}
                onClick={handleArchive}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Archiving...
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" />
                    Confirm archive
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
