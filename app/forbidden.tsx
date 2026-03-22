import { LockKeyhole } from "lucide-react";
import { AccessErrorState } from "@/app/components/states/access-error-state";

export default function ForbiddenPage() {
  return (
    <AccessErrorState
      title="Access Denied"
      description="Your role does not allow access to this organization resource. Switch organizations or contact an org admin if you believe this is incorrect."
      icon={<LockKeyhole className="h-10 w-10" />}
      primaryHref="/org/select"
      primaryLabel="Switch Organization"
      secondaryHref="/"
      secondaryLabel="Back to Home"
    />
  );
}
