import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { WorkflowStoreHydrator } from "@/app/components/workflows/workflow-store-hydrator";
import { WorkflowCanvasEditor } from "@/app/components/workflows/workflow-canvas-editor";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import { canEditWorkflows } from "@/lib/server/permissions";
import {
  getOrCreateWorkflowDraft,
  getWorkflowDetail,
  WorkflowConflictError,
  WorkflowNotFoundError,
} from "@/lib/server/workflows/service";

type WorkflowDraftPageProps = {
  params: Promise<{ orgSlug: string; workflowId: string }>;
};

export default async function WorkflowDraftPage({
  params,
}: WorkflowDraftPageProps) {
  const { orgSlug, workflowId } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canEditWorkflows(candidate.membership.role),
  );
  let detail: Awaited<ReturnType<typeof getWorkflowDetail>> | null = null;
  let draft: Awaited<ReturnType<typeof getOrCreateWorkflowDraft>> | null = null;
  let conflictMessage: string | null = null;

  try {
    [detail, draft] = await Promise.all([
      getWorkflowDetail({
        organizationId: context.organization.id,
        workflowId,
      }),
      getOrCreateWorkflowDraft({
        organizationId: context.organization.id,
        workflowId,
        userId: context.userId,
      }),
    ]);
  } catch (error: unknown) {
    if (error instanceof WorkflowNotFoundError) {
      notFound();
    }

    if (error instanceof WorkflowConflictError) {
      conflictMessage = error.message;
    } else {
      throw error;
    }
  }

  if (conflictMessage) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(0,95,158,0.14),transparent_32%),linear-gradient(180deg,color-mix(in_srgb,var(--surface)_94%,transparent),var(--surface-container-low))] px-4 py-6 sm:px-6 lg:px-8">
        <section className="glass-panel mx-auto max-w-3xl rounded-[2rem] px-8 py-12 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-[var(--surface-container-high)] text-primary">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-[-0.03em] text-[var(--on-surface)]">
            This workflow can no longer accept drafts
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--on-surface-variant)]">
            {conflictMessage}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="premium-gradient rounded-xl">
              <Link href={`/org/${orgSlug}/workflows/${workflowId}`}>
                Return to workflow
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/org/${orgSlug}/workflows`}>Back to workflows</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  if (!detail || !draft) {
    throw new Error("Workflow draft state could not be loaded.");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(0,95,158,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,color-mix(in_srgb,var(--surface)_96%,transparent),var(--surface-container-low))]">
      <WorkflowStoreHydrator detail={detail} draft={draft} />
      <WorkflowCanvasEditor
        orgSlug={orgSlug}
        detail={detail}
        initialDraft={draft}
      />
    </div>
  );
}
