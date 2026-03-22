"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mail, Send, Shield } from "lucide-react";
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
import {
  ORGANIZATION_ROLES,
  ROLE_LABELS,
  type OrganizationRole,
} from "@/lib/server/permissions";

type InviteMemberFormProps = {
  orgSlug: string;
  organizationName: string;
};

type InviteResponse = {
  invite?: {
    email: string;
    displayName: string | null;
    role: OrganizationRole;
  };
  error?: string;
};

export function InviteMemberForm({
  orgSlug,
  organizationName,
}: InviteMemberFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<OrganizationRole>("workflow_editor");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<InviteResponse["invite"] | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/orgs/${orgSlug}/invites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          name,
          role,
        }),
      });

      const payload = (await response.json()) as InviteResponse;
      if (!response.ok || !payload.invite) {
        throw new Error(payload.error ?? "Failed to send invite");
      }

      setSuccess(payload.invite);
      setFeedback({
        tone: "success",
        message: `Invitation sent to ${payload.invite.displayName ?? payload.invite.email}.`,
      });
      toast.success("Invitation sent.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to send invite";
      setFeedback({
        tone: "error",
        message,
      });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <section className="glass-panel rounded-[2rem] p-6 sm:p-8">
        <p className="label-caps">Invitation delivered</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
          Invite sent to {success.displayName ?? success.email}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          The invite for {organizationName} is now active with the {ROLE_LABELS[success.role]} role.
        </p>
        <FormStatusMessage
          id="invite-member-status"
          message={feedback?.message}
          tone={feedback?.tone}
          className="mt-6"
        />
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="premium-gradient rounded-xl">
            <Link href={`/org/${orgSlug}/team`}>Back to team</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setSuccess(null);
              setEmail("");
              setName("");
              setRole("workflow_editor");
            }}
          >
            Send another invite
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" className="rounded-xl px-0 text-primary">
        <Link href={`/org/${orgSlug}/team`}>
          <ArrowLeft className="h-4 w-4" />
          Back to team
        </Link>
      </Button>

      <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(0,95,158,0.98),rgba(0,120,199,0.88))] px-6 py-7 text-white shadow-[0_18px_48px_rgba(0,95,158,0.22)] sm:px-8">
        <p className="label-caps text-[rgba(255,255,255,0.72)]">Member onboarding</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white">
          Invite a new teammate to {organizationName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[rgba(255,255,255,0.82)]">
          Invitations stay valid for seven days and are only claimable by the invited email address.
        </p>
      </section>

      <form
        className="glass-panel rounded-[2rem] p-6 sm:p-8"
        onSubmit={handleSubmit}
        aria-busy={loading}
      >
        <div className="grid gap-6">
          <div>
            <label className="label-caps mb-2 ml-1 block" htmlFor="invite-email">
              Email address
            </label>
            <div className="glass-pill flex min-h-12 items-center gap-3 rounded-[1.15rem] px-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-container-high)] text-primary">
                <Mail className="h-4 w-4" />
              </span>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@company.com"
                className="h-12 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                disabled={loading}
                autoComplete="email"
                aria-describedby="invite-email-hint invite-member-status"
                required
              />
            </div>
            <p id="invite-email-hint" className="mt-2 text-xs text-[var(--on-surface-variant)]">
              Only this email address can claim the invitation.
            </p>
          </div>

          <div>
            <label className="label-caps mb-2 ml-1 block" htmlFor="invite-name">
              Name
            </label>
            <Input
              id="invite-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Optional display name"
              className="input-field border-0 shadow-none"
              disabled={loading}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="label-caps mb-2 ml-1 block" htmlFor="invite-role">
              Initial role
            </label>
            <div className="glass-pill flex min-h-12 items-center gap-3 rounded-[1.15rem] px-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-container-high)] text-primary">
                <Shield className="h-4 w-4" />
              </span>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as OrganizationRole)}
                disabled={loading}
              >
                <SelectTrigger
                  id="invite-role"
                  className="h-12 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  aria-describedby="invite-role-hint invite-member-status"
                >
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                {ORGANIZATION_ROLES.map((candidateRole) => (
                  <SelectItem key={candidateRole} value={candidateRole}>
                    {ROLE_LABELS[candidateRole]}
                  </SelectItem>
                ))}
                </SelectContent>
              </Select>
            </div>
            <p id="invite-role-hint" className="mt-2 text-xs text-[var(--on-surface-variant)]">
              Choose the minimum access this teammate needs. You can update it later.
            </p>
          </div>
        </div>

        <FormStatusMessage
          id="invite-member-status"
          message={feedback?.message}
          tone={feedback?.tone}
          className="mt-6"
        />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button type="submit" className="premium-gradient min-h-11 rounded-xl px-6" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending invite...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send invitation
              </>
            )}
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => router.push(`/org/${orgSlug}/team`)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
