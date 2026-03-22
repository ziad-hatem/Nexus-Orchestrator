import * as React from "react";
import { EmailLayout, Emphasis } from "./email-theme";
import { ROLE_LABELS, type OrganizationRole } from "@/lib/server/permissions";

interface OrganizationInviteEmailProps {
  organizationName: string;
  inviteLink: string;
  inviteeEmail: string;
  inviteeName?: string | null;
  role: OrganizationRole;
}

export default function OrganizationInviteEmail({
  organizationName,
  inviteLink,
  inviteeEmail,
  inviteeName,
  role,
}: OrganizationInviteEmailProps) {
  return (
    <EmailLayout
      preview={`You're invited to ${organizationName}`}
      eyebrow="Organization Access"
      title={`Join ${organizationName}`}
      description={
        <>
          {inviteeName ? <Emphasis>{inviteeName}</Emphasis> : <Emphasis>{inviteeEmail}</Emphasis>}{" "}
          has been invited to join <Emphasis>{organizationName}</Emphasis> as{" "}
          <Emphasis>{ROLE_LABELS[role]}</Emphasis>.
        </>
      }
      actionLabel="Review Invitation"
      actionHref={inviteLink}
      note={
        <>
          This invitation expires in 7 days. Sign in with <Emphasis>{inviteeEmail}</Emphasis> to
          accept access.
        </>
      }
    />
  );
}
