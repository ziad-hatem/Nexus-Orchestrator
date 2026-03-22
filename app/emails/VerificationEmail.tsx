import * as React from "react";
import { EmailLayout, Emphasis } from "./email-theme";

interface VerificationEmailProps {
  email: string;
  firstName?: string;
  verificationLink: string;
}

export default function VerificationEmail({
  email,
  firstName,
  verificationLink,
}: VerificationEmailProps) {
  return (
    <EmailLayout
      preview="Nexus Orchestrator - Verify your workspace access"
      eyebrow="Account Verification"
      title="Activate your workspace"
      description={
        <>
          Hi {firstName || "there"}, welcome to Nexus Orchestrator. Verify{" "}
          <Emphasis>{email}</Emphasis> to finish provisioning your secure
          enterprise workspace.
        </>
      }
      actionLabel="Verify Email Address"
      actionHref={verificationLink}
      note={
        <>
          If you didn&apos;t request this account, you can safely ignore this
          message. No changes will be made until the email is verified.
        </>
      }
    />
  );
}
