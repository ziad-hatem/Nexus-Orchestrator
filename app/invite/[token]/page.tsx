import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { AcceptInviteActions } from "@/app/components/workspace/accept-invite-actions";
import { WorkspaceFooter } from "@/app/components/workspace/workspace-footer";
import { Button } from "@/app/components/ui/button";
import { MAIN_CONTENT_ID } from "@/lib/a11y";
import { previewInviteByToken } from "@/lib/server/invite-service";
import { ROLE_LABELS } from "@/lib/server/permissions";
import { normalizeEmail } from "@/lib/server/validation";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invite = await previewInviteByToken(token);
  if (!invite) {
    notFound();
  }

  const session = await auth();
  const authenticatedEmail = normalizeEmail(session?.user?.email);
  const inviteEmail = normalizeEmail(invite.email);
  const mismatchedEmail =
    Boolean(session?.user?.id) &&
    Boolean(authenticatedEmail) &&
    Boolean(inviteEmail) &&
    authenticatedEmail !== inviteEmail;
  const returnPath = encodeURIComponent(`/invite/${token}`);

  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="workspace-main flex min-h-screen flex-col px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="w-full flex-1 space-y-8">
        <section className="overflow-hidden rounded-[2.25rem] bg-[linear-gradient(135deg,rgba(0,95,158,0.98),rgba(0,120,199,0.88))] px-6 py-8 text-white shadow-[0_18px_48px_rgba(0,95,158,0.22)] sm:px-8">
          <div className="max-w-3xl">
            <p className="label-caps text-[rgba(255,255,255,0.72)]">Organization invitation</p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-white">
              Join {invite.organizationName}
            </h1>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.82)]">
              This invite grants {ROLE_LABELS[invite.role]} access and can only be accepted by {invite.email}.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--surface-container-high)] text-primary">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <p className="label-caps">Invite details</p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
                  {invite.organizationName}
                </h2>
                <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                  Invitee: {invite.displayName ?? invite.email}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
                  Role
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--on-surface)]">
                  {ROLE_LABELS[invite.role]}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
                  Expires
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--on-surface)]">
                  {formatDate(invite.expiresAt)}
                </p>
              </div>
            </div>

            {invite.acceptedAt ? (
              <div className="mt-8 rounded-2xl bg-emerald-500/12 px-5 py-4 text-sm text-emerald-800 dark:text-emerald-200">
                This invitation has already been accepted. You can open the workspace directly.
              </div>
            ) : null}

            {invite.revokedAt ? (
              <div className="mt-8 rounded-2xl bg-[var(--error-container)] px-5 py-4 text-sm text-[var(--error)]">
                This invitation was revoked and can no longer be used.
              </div>
            ) : null}

            {invite.isExpired ? (
              <div className="mt-8 rounded-2xl bg-[var(--error-container)] px-5 py-4 text-sm text-[var(--error)]">
                This invitation has expired. Ask an org admin to resend it.
              </div>
            ) : null}
          </div>

          <aside className="space-y-6">
            <section className="glass-panel rounded-[1.75rem] p-6">
              <p className="label-caps">Next step</p>
              <div className="mt-4">
                {!session?.user?.id ? (
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--on-surface-variant)]">
                      Sign in or create an account with {invite.email} to claim this invite.
                    </p>
                    <div className="flex flex-col gap-3">
                      <Button asChild className="premium-gradient rounded-xl">
                        <Link href={`/login?next=${returnPath}`}>
                          Sign in to accept
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="rounded-xl">
                        <Link href={`/register?next=${returnPath}`}>
                          Create account
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : invite.acceptedAt ? (
                  <Button asChild className="premium-gradient rounded-xl">
                    <Link href={`/org/${invite.organizationSlug}`}>
                      Open workspace
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : invite.revokedAt || invite.isExpired ? (
                  <p className="text-sm text-[var(--on-surface-variant)]">
                    This invite can no longer be accepted. Contact the org admin for a new invite.
                  </p>
                ) : (
                  <AcceptInviteActions token={token} mismatchedEmail={mismatchedEmail} />
                )}
              </div>
            </section>

            <section className="glass-panel rounded-[1.75rem] p-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <p className="text-sm font-semibold text-[var(--on-surface)]">
                  Tenant-scoped access
                </p>
              </div>
              <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
                Access only applies to {invite.organizationName}. It will not grant visibility into any other organization.
              </p>
              {mismatchedEmail ? (
                <p className="mt-4 rounded-2xl bg-[var(--error-container)] px-4 py-3 text-sm text-[var(--error)]">
                  You are signed in as {session?.user?.email}. Switch accounts to accept this invite with {invite.email}.
                </p>
              ) : null}
            </section>
          </aside>
        </section>
      </div>
      <WorkspaceFooter className="mt-6" />
    </main>
  );
}
