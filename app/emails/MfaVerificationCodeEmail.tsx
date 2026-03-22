import * as React from "react";
import { CodeBlock, EmailLayout, Emphasis } from "./email-theme";

interface MfaVerificationCodeEmailProps {
  email: string;
  code: string;
  expiresInMinutes: number;
}

export default function MfaVerificationCodeEmail({
  email,
  code,
  expiresInMinutes,
}: MfaVerificationCodeEmailProps) {
  return (
    <EmailLayout
      preview={`Nexus Orchestrator security code: ${code}`}
      eyebrow="Multi-Step Authentication"
      title="Verify your sign-in"
      description={
        <>
          Enter this verification code to continue signing in to{" "}
          <Emphasis>{email}</Emphasis>.
        </>
      }
      details={<CodeBlock code={code} />}
      note={
        <>
          This code expires in {expiresInMinutes} minutes. If you didn&apos;t
          initiate this sign-in, you can ignore this message.
        </>
      }
    />
  );
}
