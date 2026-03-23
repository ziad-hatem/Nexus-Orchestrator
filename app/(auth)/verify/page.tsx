"use client";

import { Suspense, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthCanvas, AuthFooterMeta } from "@/app/components/auth/auth-shell";
import { MfaPanel } from "@/app/components/auth/auth-verification-panels";
import { isVerificationCodeValid } from "./verify-flow";

function VerifyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expectedCode = searchParams.get("code") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const handleVerify = () => {
    const isValid = isVerificationCodeValid(code, expectedCode);
    setVerified(isValid);

    if (isValid) {
      setError(null);
      toast.success("Code verified");
    } else {
      setError("The verification code does not match. Try again.");
      toast.error("Verification failed");
    }
  };

  return (
    <AuthCanvas
      footer={
        verified ? <AuthFooterMeta /> : <AuthFooterMeta className="pt-8" />
      }
    >
      <div className="mx-auto flex w-full max-w-md flex-col">
        {verified ? (
          <>
            <div className="auth-panel rounded-[1.5rem] px-8 py-10 text-center shadow-[0_12px_32px_rgba(11,28,48,0.06)] mb-8">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-container-low)] text-primary">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
                Verification complete
              </h1>
              <p className="mt-3 body-md text-[var(--on-surface-variant)]">
                Your code has been confirmed successfully.
              </p>
              <button
                type="button"
                className="premium-gradient mt-8 min-h-[3.25rem] w-full rounded-xl px-4 text-sm font-semibold text-[var(--on-primary)] shadow-[0_12px_28px_rgba(0,95,158,0.18)]"
                onClick={() => router.push("/login")}
              >
                Continue to Login
              </button>
            </div>
          </>
        ) : (
          <>
            <MfaPanel
              title="Verify your code"
              description="Enter the verification code from your email to continue."
              code={code}
              error={error}
              onCodeChange={setCode}
              onVerify={handleVerify}
              verifyLabel="Verify code"
            />
            <div className="mt-6 text-center text-sm text-[var(--on-surface-variant)]">
              Already verified?{" "}
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="font-semibold text-primary transition-colors hover:text-[var(--primary-container)]"
              >
                Go to login
              </button>
            </div>
          </>
        )}
      </div>
    </AuthCanvas>
  );
}

function VerifyPageFallback() {
  return (
    <AuthCanvas>
      <div className="mx-auto max-w-md">
        <div className="auth-panel rounded-[1.5rem] px-8 py-10 text-center shadow-[0_12px_32px_rgba(11,28,48,0.06)]">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--on-surface)]">
            Loading verification
          </h1>
          <p className="mt-3 body-md text-[var(--on-surface-variant)]">
            Preparing your verification screen.
          </p>
        </div>
      </div>
    </AuthCanvas>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<VerifyPageFallback />}>
      <VerifyPageContent />
    </Suspense>
  );
}
