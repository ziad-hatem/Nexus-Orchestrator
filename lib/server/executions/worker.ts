import {
  drainDueExecutionJobs,
  getExecutionQueueBacklog,
  getExecutionWorkerPollIntervalMs,
  popExecutionJob,
  sleep,
} from "@/lib/server/executions/queue";
import { processExecutionQueueJob } from "@/lib/server/executions/service";
import { appLogger } from "@/lib/observability/logger";
import {
  emitOperationalAlert,
  evaluateOperationalAlerts,
} from "@/lib/observability/alerts";

export async function startExecutionWorker(options?: { once?: boolean }) {
  const once = options?.once ?? false;
  const pollInterval = getExecutionWorkerPollIntervalMs();

  do {
    await drainDueExecutionJobs();
    const backlog = await getExecutionQueueBacklog();
    const [backlogAlert] = evaluateOperationalAlerts({
      queueBacklog: backlog.ready + backlog.delayed,
      staleRunningCount: 0,
      recentWebhookRejections: 0,
      retryExhaustionCount: 0,
    }).filter((candidate) => candidate.key === "queue_backlog");
    if (backlogAlert && backlogAlert.status !== "ok") {
      emitOperationalAlert({
        alert: backlogAlert,
        extras: {
          readyBacklog: backlog.ready,
          delayedBacklog: backlog.delayed,
        },
      });
    }

    const job = await popExecutionJob();
    if (!job) {
      if (once) {
        return;
      }

      await sleep(pollInterval);
      continue;
    }

    appLogger.info(
      {
        runId: job.runKey,
        correlationId: job.correlationId,
        organizationId: job.organizationId,
      },
      "Processing queued workflow run",
    );

    try {
      await processExecutionQueueJob(job);
    } catch (error: unknown) {
      appLogger.error(
        {
          err: error instanceof Error ? error.message : String(error),
          runId: job.runKey,
          correlationId: job.correlationId,
          organizationId: job.organizationId,
          securityEvent: "worker_failure",
        },
        "Execution worker loop failed while processing a queued job",
      );

      if (once) {
        throw error;
      }
    }
  } while (!once);
}
