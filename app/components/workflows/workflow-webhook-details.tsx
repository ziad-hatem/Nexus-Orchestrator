"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, KeyRound, RefreshCw, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { WorkflowTriggerAttempts } from "@/app/components/workflows/workflow-trigger-attempts";
import type { WorkflowTriggerDetails } from "@/lib/server/workflows/types";

type WorkflowWebhookDetailsProps = {
  orgSlug: string;
  workflowId: string;
  triggerDetails: WorkflowTriggerDetails;
  canRotateSecret: boolean;
};

type WebhookSecretResponse = {
  error?: string;
  secret?: {
    plainTextSecret: string;
    endpointPath: string;
    endpointUrl: string | null;
    lastFour: string | null;
  };
};

export function WorkflowWebhookDetails({
  orgSlug,
  workflowId,
  triggerDetails,
  canRotateSecret,
}: WorkflowWebhookDetailsProps) {
  const [latestSecret, setLatestSecret] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  const webhook = triggerDetails.trigger.webhook;
  const curlExample = useMemo(() => {
    if (!webhook?.endpointUrl || !latestSecret) {
      return null;
    }
    const body = JSON.stringify(
      {
        event: "payment.failed",
        data: {
          paymentId: "pay_123",
          amount: 1299,
        },
      },
      null,
      2,
    );

    return `curl -X POST ${webhook.endpointUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-Nexus-Api-Key: ${latestSecret}" \\
  -H "X-Nexus-Delivery-Id: payment-failed-demo-001" \\
  -d '${body}'`;
  }, [latestSecret, webhook?.endpointUrl]);

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}.`);
    }
  };

  const handleRotateSecret = async () => {
    setRotating(true);

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/workflows/${workflowId}/trigger/webhook-secret`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const payload = (await response.json()) as WebhookSecretResponse;
      if (!response.ok || !payload.secret?.plainTextSecret) {
        throw new Error(payload.error ?? "Failed to regenerate webhook API key");
      }

      setLatestSecret(payload.secret.plainTextSecret);
      toast.success("Webhook API key regenerated. Copy it now; it will not be shown again.");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to regenerate webhook API key",
      );
    } finally {
      setRotating(false);
    }
  };

  if (!webhook) {
    return (
      <section className="glass-panel rounded-[1.75rem] p-6">
        <p className="label-caps">Webhook details</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
          This workflow is not published with a webhook trigger
        </h1>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(11,28,48,0.98),rgba(0,95,158,0.88))] px-6 py-7 text-white shadow-[0_18px_48px_rgba(11,28,48,0.2)] sm:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="label-caps text-[rgba(255,255,255,0.72)]">
              Webhook details
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white">
              API key protected endpoint for {triggerDetails.workflowName}
            </h1>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.82)]">
              Send POST requests with the workflow API key to the endpoint below. Deliveries land in the ingestion stream before a pending run is created.
            </p>
          </div>

          <Button asChild variant="outline" className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/16">
            <Link href={`/org/${orgSlug}/workflows/${workflowId}/trigger`}>
              Back to trigger config
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)]">
        <div className="space-y-6">
          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Webhook className="h-5 w-5" />
              </div>
              <div>
                <p className="label-caps">Endpoint</p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                  Public webhook route
                </h2>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
              <p className="label-caps">Endpoint URL</p>
              <div className="mt-3 flex flex-col gap-3 lg:flex-row">
                <code className="flex-1 overflow-x-auto rounded-[1.1rem] bg-[var(--surface-container-lowest)] px-4 py-3 text-sm text-[var(--on-surface)]">
                  {webhook.endpointUrl ?? webhook.endpointPath}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() =>
                    handleCopy(
                      webhook.endpointUrl ?? webhook.endpointPath ?? "",
                      "Webhook URL",
                    )
                  }
                >
                  <Copy className="h-4 w-4" />
                  Copy URL
                </Button>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
              <p className="label-caps">API key rules</p>
              <ol className="mt-3 space-y-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                <li>1. Send `POST` requests only.</li>
                <li>2. Include `X-Nexus-Api-Key` with the current webhook API key.</li>
                <li>3. Optionally include `X-Nexus-Delivery-Id` so retries stay idempotent.</li>
              </ol>
            </div>

            {curlExample ? (
              <div className="mt-5 rounded-[1.5rem] bg-[#0b1c30] p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="label-caps text-blue-100">API key cURL example</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => handleCopy(curlExample, "Webhook cURL")}
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-blue-100">
                  {curlExample}
                </pre>
              </div>
            ) : null}
          </section>

          <WorkflowTriggerAttempts attempts={triggerDetails.recentAttempts} />
        </div>

        <aside className="space-y-6">
          <section className="glass-panel rounded-[1.75rem] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="label-caps">Webhook API key</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                  Stored as a hash
                </h2>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
              <p className="label-caps">Current state</p>
              <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                {webhook.hasSecret
                  ? `Active API key ending in ${webhook.lastFour ?? "----"}`
                  : "No API key generated yet"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
                Regenerate the API key to reveal a fresh value once. Only the hash and final four characters remain stored afterward.
              </p>
            </div>

            {latestSecret ? (
              <div className="mt-5 rounded-[1.5rem] bg-[var(--surface-container-low)] p-5">
                <p className="label-caps">Newest API key</p>
                <code className="mt-3 block overflow-x-auto rounded-[1.1rem] bg-[var(--surface-container-lowest)] px-4 py-3 text-sm text-[var(--on-surface)]">
                  {latestSecret}
                </code>
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => handleCopy(latestSecret, "Webhook API key")}
                  >
                    <Copy className="h-4 w-4" />
                    Copy API key
                  </Button>
                </div>
              </div>
            ) : null}

            {canRotateSecret ? (
              <div className="mt-5">
                <Button
                  type="button"
                  className="premium-gradient rounded-xl"
                  disabled={rotating}
                  onClick={handleRotateSecret}
                >
                  <RefreshCw className={`h-4 w-4 ${rotating ? "animate-spin" : ""}`} />
                  Regenerate API key
                </Button>
              </div>
            ) : null}
          </section>
        </aside>
      </section>
    </div>
  );
}
