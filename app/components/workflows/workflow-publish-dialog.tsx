"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Rocket, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormStatusMessage } from "@/app/components/a11y/form-status-message";
import { Button } from "@/app/components/ui/button";
import { GlobalModal } from "@/app/components/ui/global-modal";
import { WorkflowValidationPanel } from "@/app/components/workflows/workflow-validation-panel";
import type { ValidationIssue } from "@/lib/server/workflows/types";

type WorkflowPublishDialogProps = {
  orgSlug: string;
  workflowId: string;
  workflowName: string;
  latestVersionNumber: number | null;
  issues: ValidationIssue[];
  redirectHref?: string;
  disabled?: boolean;
};

type PublishResponse = {
  error?: string;
  issues?: ValidationIssue[];
};

export function WorkflowPublishDialog({
  orgSlug,
  workflowId,
  workflowName,
  latestVersionNumber,
  issues,
  redirectHref,
  disabled = false,
}: WorkflowPublishDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<{
    tone: "error" | "info";
    message: string;
  } | null>(null);
  const [latestIssues, setLatestIssues] = useState<ValidationIssue[]>(issues);

  useEffect(() => {
    setLatestIssues(issues);
  }, [issues]);

  const nextVersionLabel = useMemo(() => {
    const versionNumber = (latestVersionNumber ?? 0) + 1;
    return `v${versionNumber}`;
  }, [latestVersionNumber]);

  const handlePublish = async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/workflows/${workflowId}/publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notes,
          }),
        },
      );

      const payload = (await response.json()) as PublishResponse;
      if (!response.ok) {
        if (Array.isArray(payload.issues)) {
          setLatestIssues(payload.issues);
        }
        throw new Error(payload.error ?? "Failed to publish workflow");
      }

      toast.success(`${workflowName} published as ${nextVersionLabel}.`);
      setOpen(false);
      router.push(redirectHref ?? `/org/${orgSlug}/workflows/${workflowId}`);
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to publish workflow";
      setFeedback({
        tone: "error",
        message,
      });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        className="premium-gradient rounded-xl"
        disabled={disabled}
        onClick={() => {
          setFeedback(null);
          setOpen(true);
        }}
      >
        <Send className="h-4 w-4" />
        Publish version
      </Button>

      <GlobalModal open={open} onClose={() => setOpen(false)} titleId="publish-workflow-title">
        <div className="flex items-start gap-4 border-b border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] bg-[color:color-mix(in_srgb,var(--surface-container-lowest)_82%,transparent)] px-6 py-6 sm:px-8 sm:py-7">
          <div className="premium-gradient flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] text-white">
            <Rocket className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="label-caps">Publish immutable version</p>
            <h2
              id="publish-workflow-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]"
            >
              Ship {workflowName} as {nextVersionLabel}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
              Publishing snapshots the current draft into an immutable version.
              Existing production definitions remain untouched.
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-6 sm:px-8 sm:py-7">
          <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1.1fr)]">
            <div className="flex min-h-0 flex-col rounded-[1.5rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_42%,transparent)] bg-[var(--surface-container-low)] p-5">
              <label
                htmlFor="workflow-publish-notes"
                className="label-caps mb-2 ml-1 block"
              >
                Release notes
              </label>
              <textarea
                id="workflow-publish-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Summarize what changed in this release"
                className="min-h-[16rem] w-full flex-1 rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 xl:min-h-0"
              />
            </div>

            <div className="min-h-0 overflow-y-auto rounded-[1.5rem]">
              <WorkflowValidationPanel
                issues={latestIssues}
                title="Pre-publish validation"
                description="Blocking errors must be resolved before the snapshot can be promoted into version history."
                compact
              />
            </div>
          </div>

          <FormStatusMessage
            id="workflow-publish-status"
            message={feedback?.message}
            tone={feedback?.tone}
            className="mt-5"
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] bg-[color:color-mix(in_srgb,var(--surface-container-lowest)_82%,transparent)] px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
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
            className="premium-gradient rounded-xl"
            disabled={loading}
            onClick={handlePublish}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Confirm publish
              </>
            )}
          </Button>
        </div>
      </GlobalModal>
    </>
  );
}
