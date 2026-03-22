"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { FormStatusMessage } from "@/app/components/a11y/form-status-message";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import type { UserOrganizationMembership } from "@/lib/server/org-service";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const upsertMembership = useWorkspaceStore((state) => state.upsertMembership);
  const setCurrentOrganization = useWorkspaceStore(
    (state) => state.setCurrentOrganization,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/orgs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const payload = (await response.json()) as {
        error?: string;
        redirectPath?: string;
        organization?: UserOrganizationMembership;
      };

      if (!response.ok || !payload.redirectPath || !payload.organization) {
        throw new Error(payload.error ?? "Failed to create organization");
      }

      upsertMembership(payload.organization);
      setCurrentOrganization({
        organizationSlug: payload.organization.organizationSlug,
        organizationName: payload.organization.organizationName,
        role: payload.organization.role,
      });
      setFeedback({
        tone: "success",
        message: `Organization ${payload.organization.organizationName} created. Redirecting to the workspace.`,
      });
      toast.success("Organization created.");
      router.push(payload.redirectPath);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create organization";
      setFeedback({
        tone: "error",
        message,
      });
      toast.error(
        message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} aria-busy={loading}>
      <div>
        <label className="label-caps mb-2 ml-1 block" htmlFor="orgName">
          Organization Name
        </label>
        <Input
          id="orgName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Acme Operations"
          className="input-field border-0 px-4 py-3 shadow-none"
          disabled={loading}
          autoComplete="organization"
          aria-describedby="org-name-hint org-form-status"
          required
        />
        <p id="org-name-hint" className="mt-2 text-xs text-[var(--on-surface-variant)]">
          This name is used to create a new isolated organization and workspace slug.
        </p>
      </div>
      <FormStatusMessage
        id="org-form-status"
        message={feedback?.message}
        tone={feedback?.tone}
      />
      <Button
        type="submit"
        className="premium-gradient min-h-11 w-full rounded-xl text-sm font-semibold"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <PlusCircle className="h-4 w-4" />
            Create Organization
          </>
        )}
      </Button>
    </form>
  );
}
