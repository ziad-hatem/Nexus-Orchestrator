import { SearchX } from "lucide-react";
import { AccessErrorState } from "@/app/components/states/access-error-state";

export default function NotFoundPage() {
  return (
    <AccessErrorState
      title="Workspace Not Found"
      description="The page or organization you requested could not be found. It may have been removed or the link may be out of date."
      icon={<SearchX className="h-10 w-10" />}
      primaryHref="/org/select"
      primaryLabel="Choose Organization"
      secondaryHref="/"
      secondaryLabel="Go to Home"
    />
  );
}
