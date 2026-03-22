"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormStatusMessage } from "@/app/components/a11y/form-status-message";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

const CATEGORY_OPTIONS = [
  "Operations",
  "Security",
  "Finance",
  "Support",
  "Infrastructure",
] as const;

const TRIGGER_OPTIONS = [
  {
    value: "schedule",
    label: "Schedule",
    description: "Run the workflow on a recurring cron window.",
  },
  {
    value: "webhook",
    label: "Webhook",
    description: "Start from an inbound HTTP request.",
  },
  {
    value: "manual",
    label: "Manual",
    description: "Launch explicitly from UI or API.",
  },
] as const;

type WorkflowCreateFormProps = {
  orgSlug: string;
  organizationName: string;
};

type CreateWorkflowResponse = {
  redirectPath?: string;
  error?: string;
};

export function WorkflowCreateForm({
  orgSlug,
  organizationName,
}: WorkflowCreateFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Operations");
  const [triggerType, setTriggerType] = useState<"schedule" | "webhook" | "manual">(
    "schedule",
  );
  const [tagsInput, setTagsInput] = useState("");

  const tags = useMemo(
    () =>
      Array.from(
        new Set(
          tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ),
    [tagsInput],
  );

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      router.push(`/org/${orgSlug}/workflows`);
      return;
    }

    setStep((current) => Math.max(1, current - 1));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/orgs/${orgSlug}/workflows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          category,
          tags,
          triggerType,
        }),
      });

      const payload = (await response.json()) as CreateWorkflowResponse;
      if (!response.ok || !payload.redirectPath) {
        throw new Error(payload.error ?? "Failed to create workflow");
      }

      toast.success("Workflow draft created.");
      router.push(payload.redirectPath);
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create workflow";
      setFeedback({
        tone: "error",
        message,
      });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const currentTrigger = TRIGGER_OPTIONS.find(
    (option) => option.value === triggerType,
  );

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(11,28,48,0.98),rgba(0,95,158,0.88))] px-6 py-7 text-white shadow-[0_18px_48px_rgba(11,28,48,0.2)] sm:px-8">
        <p className="label-caps text-[rgba(255,255,255,0.72)]">
          Workflow lifecycle
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white">
          Create a safe draft for {organizationName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[rgba(255,255,255,0.82)]">
          Start with workflow metadata, choose the initial trigger shape, then continue into the draft editor for conditions and actions.
        </p>
      </section>

      <section className="glass-panel rounded-[2rem] p-6 sm:p-8">
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((candidateStep) => {
            const active = step === candidateStep;
            const complete = step > candidateStep;

            return (
              <div
                key={candidateStep}
                className={`rounded-[1.5rem] border px-4 py-4 transition ${
                  active
                    ? "border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                    : complete
                      ? "border-emerald-500/18 bg-emerald-500/10"
                      : "border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] bg-[var(--surface-container-low)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                      active
                        ? "bg-primary text-white"
                        : complete
                          ? "bg-emerald-600 text-white"
                          : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
                    }`}
                  >
                    {complete ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-semibold">{candidateStep}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--on-surface)]">
                      {candidateStep === 1
                        ? "Basic info"
                        : candidateStep === 2
                          ? "Trigger setup"
                          : "Review"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                      {candidateStep === 1
                        ? "Name, category, and purpose"
                        : candidateStep === 2
                          ? "Choose the first activation path"
                          : "Confirm before opening the draft"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {step === 1 ? (
          <div className="grid gap-6">
            <div>
              <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-name">
                Workflow name
              </label>
              <Input
                id="workflow-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Customer invoice reconciliation"
                className="input-field border-0 shadow-none"
                autoFocus
              />
            </div>

            <div>
              <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-description">
                Description
              </label>
              <textarea
                id="workflow-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the operational outcome this workflow should produce."
                className="min-h-32 w-full rounded-[1.1rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 py-3 text-sm text-[var(--on-surface)] outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
              />
            </div>

            <div>
              <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-category">
                Category
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="workflow-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-6">
            <div>
              <p className="label-caps mb-3 ml-1 block">Initial trigger</p>
              <div className="grid gap-4 lg:grid-cols-3">
                {TRIGGER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTriggerType(option.value)}
                    className={`rounded-[1.5rem] border p-5 text-left transition ${
                      triggerType === option.value
                        ? "border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                        : "border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)]"
                    }`}
                  >
                    <p className="text-base font-semibold text-[var(--on-surface)]">
                      {option.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label-caps mb-2 ml-1 block" htmlFor="workflow-tags">
                Tags
              </label>
              <Input
                id="workflow-tags"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="billing, finance, approvals"
                className="input-field border-0 shadow-none"
              />
              <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
                Separate tags with commas to help people find this workflow later.
              </p>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-6">
            <div className="rounded-[1.75rem] bg-[var(--surface-container-low)] p-6">
              <div className="flex items-start gap-3">
                <div className="premium-gradient flex h-11 w-11 items-center justify-center rounded-2xl text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                    {name || "Untitled workflow"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
                    {description || "No description added yet."}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-[var(--surface-container-lowest)] p-4">
                  <p className="label-caps">Category</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {category}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-lowest)] p-4">
                  <p className="label-caps">Trigger</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {currentTrigger?.label}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-lowest)] p-4">
                  <p className="label-caps">Tags</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                    {tags.length > 0 ? tags.join(", ") : "No tags"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-[var(--surface-container-low)] px-5 py-4 text-sm text-[var(--on-surface-variant)]">
              The editor opens with one active draft. Publishing later will snapshot that draft into an immutable version without mutating older production definitions.
            </div>
          </div>
        ) : null}

        <FormStatusMessage
          id="create-workflow-status"
          message={feedback?.message}
          tone={feedback?.tone}
          className="mt-6"
        />

        <div className="mt-8 flex flex-col gap-3 border-t border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" className="rounded-xl" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild type="button" variant="outline" className="rounded-xl">
              <Link href={`/org/${orgSlug}/workflows`}>Return to workflows</Link>
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                className="premium-gradient rounded-xl"
                disabled={!name.trim()}
                onClick={handleNext}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="premium-gradient rounded-xl"
                disabled={loading || !name.trim()}
                onClick={handleSubmit}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating draft...
                  </>
                ) : (
                  <>
                    Create workflow
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
