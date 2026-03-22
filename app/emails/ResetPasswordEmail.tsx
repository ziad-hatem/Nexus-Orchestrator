import * as React from "react";
import { EmailLayout, Emphasis } from "./email-theme";

interface ResetPasswordEmailProps {
  email: string;
  resetLink: string;
}

export default function ResetPasswordEmail({
  email,
  resetLink,
}: ResetPasswordEmailProps) {
  return (
    <EmailLayout
      preview="Nexus Orchestrator - Reset your password"
      eyebrow="Credential Recovery"
      title="Reset your password"
      description={
        <>
          We received a request to reset the password for{" "}
          <Emphasis>{email}</Emphasis>. Use the secure recovery link below to
          choose a new password.
        </>
      }
      actionLabel="Reset Password"
      actionHref={resetLink}
      note={
        <>
          If you did not request this recovery flow, you can ignore this email
          and your credentials will remain unchanged.
        </>
      }
    />
  );
}
