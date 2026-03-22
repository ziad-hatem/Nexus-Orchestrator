import { ShieldAlert } from "lucide-react";
import { AccessErrorState } from "@/app/components/states/access-error-state";

export default function UnauthorizedPage() {
  return (
    <AccessErrorState
      title="Sign In Required"
      description="Access to this workspace requires an active authenticated session. Sign in to continue."
      icon={<ShieldAlert className="h-10 w-10" />}
      primaryHref="/login"
      primaryLabel="Go to Login"
      secondaryHref="/register"
      secondaryLabel="Create Account"
    />
  );
}
