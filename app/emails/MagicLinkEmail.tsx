import * as React from "react";
import { EmailLayout, Emphasis } from "./email-theme";

interface MagicLinkEmailProps {
  email: string;
  magicLink: string;
}

export default function MagicLinkEmail({
  email,
  magicLink,
}: MagicLinkEmailProps) {
  return (
    <EmailLayout
      preview="Nexus Orchestrator - Your magic sign-in link"
      eyebrow="Passwordless Access"
      title="Sign in to Nexus Orchestrator"
      description={
        <>
          Use this secure link to access the workspace associated with{" "}
          <Emphasis>{email}</Emphasis>.
        </>
      }
      actionLabel="Open Secure Session"
      actionHref={magicLink}
      note={
        <>
          This link expires soon for security reasons. If you didn&apos;t
          request it, you can safely ignore this email.
        </>
      }
    />
  );
}
