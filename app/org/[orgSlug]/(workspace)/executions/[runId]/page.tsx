import { notFound } from "next/navigation";
import { ExecutionDetail } from "@/app/components/executions/execution-detail";
import { ExecutionStoreHydrator } from "@/app/components/executions/execution-store-hydrator";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import {
  canCancelRuns,
  canViewExecutions,
} from "@/lib/server/permissions";
import {
  getWorkflowRunDetail,
  WorkflowExecutionNotFoundError,
} from "@/lib/server/executions/service";

type ExecutionDetailPageProps = {
  params: Promise<{ orgSlug: string; runId: string }>;
};

export default async function ExecutionDetailPage({
  params,
}: ExecutionDetailPageProps) {
  const { orgSlug, runId } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canViewExecutions(candidate.membership.role),
  );

  let detail;
  try {
    detail = await getWorkflowRunDetail({
      organizationId: context.organization.id,
      runId,
    });
  } catch (error: unknown) {
    if (error instanceof WorkflowExecutionNotFoundError) {
      notFound();
    }

    throw error;
  }

  return (
    <>
      <ExecutionStoreHydrator detail={detail} />
      <ExecutionDetail
        orgSlug={orgSlug}
        detail={detail}
        canCancelRuns={canCancelRuns(context.membership.role)}
      />
    </>
  );
}
