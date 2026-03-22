"use client";

import * as Popover from "@radix-ui/react-popover";
import { useId } from "react";
import { Globe, Server, ShieldCheck, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";

type AuditLogDetailsDialogProps = {
  action: string;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function MetadataBlock({
  metadata,
}: {
  metadata: Record<string, unknown>;
}) {
  if (Object.keys(metadata ?? {}).length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--surface-container-low)] px-4 py-4 text-sm text-[var(--on-surface-variant)]">
        No metadata was recorded for this event.
      </div>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-2xl bg-[var(--surface-container-lowest)] p-4 text-xs text-[var(--on-surface-variant)]">
      {JSON.stringify(metadata, null, 2)}
    </pre>
  );
}

export function AuditLogDetailsDialog({
  action,
  createdAt,
  actorName,
  actorEmail,
  entityType,
  entityId,
  ipAddress,
  userAgent,
  metadata,
}: AuditLogDetailsDialogProps) {
  const titleId = useId();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="mt-3 h-auto rounded-lg px-0 py-0 text-xs font-semibold text-primary hover:bg-transparent hover:text-[var(--primary-container)]"
        >
          View details
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          aria-labelledby={titleId}
          className="glass-panel-strong z-[120] flex max-h-[min(80vh,44rem)] w-[min(92vw,56rem)] flex-col overflow-hidden rounded-[1.75rem] shadow-[0_18px_42px_rgba(4,17,29,0.24)]"
          collisionPadding={16}
          side="right"
          sideOffset={14}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] px-5 py-5 sm:px-6">
            <div>
              <p className="label-caps">Audit event details</p>
              <h2
                id={titleId}
                className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]"
              >
                {action}
              </h2>
              <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                Recorded {formatDateTime(createdAt)}
              </p>
            </div>

            <Popover.Close asChild>
              <Button type="button" variant="outline" className="rounded-xl">
                <X className="h-4 w-4" />
                Close
              </Button>
            </Popover.Close>
          </div>

          <div className="space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
                  Actor
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {actorName ?? actorEmail ?? "System"}
                </p>
                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                  {actorEmail ?? "Internal action"}
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
                  Entity
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {entityType ?? "system"}
                </p>
                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                  {entityId ?? "No entity id"}
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
                  Recorded
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {formatDateTime(createdAt)}
                </p>
              </div>
            </div>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-[var(--on-surface)]">
                  Metadata
                </h3>
              </div>
              <MetadataBlock metadata={metadata} />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-[var(--on-surface)]">
                    IP address
                  </p>
                </div>
                <p className="mt-3 break-all text-sm text-[var(--on-surface-variant)]">
                  {ipAddress ?? "No IP address recorded"}
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-[var(--on-surface)]">
                    User agent
                  </p>
                </div>
                <p className="mt-3 break-words text-sm text-[var(--on-surface-variant)]">
                  {userAgent ?? "No user agent recorded"}
                </p>
              </div>
            </section>
          </div>

          <Popover.Arrow className="fill-[var(--glass-panel-strong)]" height={14} width={20} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
