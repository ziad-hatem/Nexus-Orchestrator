"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { FormStatusMessage } from "@/app/components/a11y/form-status-message";
import { Button } from "@/app/components/ui/button";
import type { OrganizationMember } from "@/lib/server/membership-service";
import {
  ORGANIZATION_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type MembershipStatus,
  type OrganizationRole,
} from "@/lib/server/permissions";

type EditRoleFormProps = {
  orgSlug: string;
  member: OrganizationMember;
};

function roleIcon(role: OrganizationRole) {
  switch (role) {
    case "org_admin":
      return ShieldAlert;
    case "workflow_editor":
      return ShieldCheck;
    case "operator":
      return UserCog;
    case "viewer":
    default:
      return Shield;
  }
}

function roleCardClasses(active: boolean): string {
  return active
    ? "border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] shadow-[0_12px_24px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
    : "border-[color:color-mix(in_srgb,var(--outline-variant)_48%,transparent)] bg-[var(--surface-container-lowest)] hover:bg-[var(--surface-container-low)]";
}

export function EditRoleForm({ orgSlug, member }: EditRoleFormProps) {
  const router = useRouter();
  const [role, setRole] = useState<OrganizationRole>(member.role);
  const [status, setStatus] = useState<MembershipStatus>(member.status);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/orgs/${orgSlug}/members/${member.membershipId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role, status }),
        },
      );

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update member");
      }

      setFeedback({
        tone: "success",
        message: "Member access updated. Returning to the team directory.",
      });
      toast.success("Member access updated.");
      router.push(`/org/${orgSlug}/team`);
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update member";
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
    <div className="space-y-8">
      <Button asChild variant="ghost" className="rounded-xl px-0 text-primary">
        <Link href={`/org/${orgSlug}/team`}>
          <ArrowLeft className="h-4 w-4" />
          Back to team
        </Link>
      </Button>

      <section className="glass-panel rounded-[2rem] p-6 sm:p-8">
        <p className="label-caps">Member access</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
          Edit role and member status
        </h1>
        <div className="mt-6 flex items-center gap-4 rounded-2xl bg-[var(--surface-container-low)] p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-container-high)] text-sm font-bold text-primary">
            {(member.name ?? member.email)
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? "")
              .join("")
              .slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--on-surface)]">
              {member.name ?? member.email}
            </p>
            <p className="text-xs text-[var(--on-surface-variant)]">{member.email}</p>
          </div>
        </div>
      </section>

      <form
        className="glass-panel space-y-8 rounded-[2rem] p-6 sm:p-8"
        onSubmit={handleSubmit}
        aria-busy={loading}
      >
        <fieldset>
          <legend className="label-caps">Role assignment</legend>
          <div className="mt-4 grid gap-4">
            {ORGANIZATION_ROLES.map((candidateRole) => {
              const Icon = roleIcon(candidateRole);
              const active = role === candidateRole;
              const inputId = `role-${candidateRole}`;

              return (
                <label
                  key={candidateRole}
                  htmlFor={inputId}
                  className={`block w-full rounded-2xl border p-5 text-left transition ${roleCardClasses(active)}`}
                >
                  <input
                    id={inputId}
                    type="radio"
                    name="member-role"
                    value={candidateRole}
                    checked={active}
                    onChange={() => setRole(candidateRole)}
                    disabled={loading}
                    className="sr-only"
                  />
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-container-high)] text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--on-surface)]">
                          {ROLE_LABELS[candidateRole]}
                        </p>
                        {active ? (
                          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                            Selected
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                        {ROLE_DESCRIPTIONS[candidateRole]}
                      </p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label className="label-caps mb-2 ml-1 block" htmlFor="member-status">
            Member status
          </label>
          <select
            id="member-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as MembershipStatus)}
            className="min-h-12 w-full rounded-xl border border-[color:color-mix(in_srgb,var(--outline-variant)_56%,transparent)] bg-[var(--input-background)] px-4 text-sm text-[var(--on-surface)] shadow-sm outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            disabled={loading}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
            Suspended members cannot access this organization until reactivated.
          </p>
        </div>

        <FormStatusMessage
          id="edit-role-status"
          message={feedback?.message}
          tone={feedback?.tone}
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" className="premium-gradient min-h-11 rounded-xl px-6" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving changes...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={`/org/${orgSlug}/team`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
