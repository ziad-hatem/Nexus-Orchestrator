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

export const executionWorkerDeps = {
  drainDueExecutionJobs,
  getExecutionQueueBacklog,
  getExecutionWorkerPollIntervalMs,
  popExecutionJob,
  sleep,
  processExecutionQueueJob,
  appLogger,
  emitOperationalAlert,
  evaluateOperationalAlerts,
};

export async function startExecutionWorker(options?: { once?: boolean }) {
  const once = options?.once ?? false;
  const pollInterval = executionWorkerDeps.getExecutionWorkerPollIntervalMs();

  do {
    await executionWorkerDeps.drainDueExecutionJobs();
    const backlog = await executionWorkerDeps.getExecutionQueueBacklog();
    const [backlogAlert] = executionWorkerDeps.evaluateOperationalAlerts({
      queueBacklog: backlog.ready + backlog.delayed,
      staleRunningCount: 0,
      recentWebhookRejections: 0,
      retryExhaustionCount: 0,
    }).filter((candidate) => candidate.key === "queue_backlog");
    if (backlogAlert && backlogAlert.status !== "ok") {
      executionWorkerDeps.emitOperationalAlert({
        alert: backlogAlert,
        extras: {
          readyBacklog: backlog.ready,
          delayedBacklog: backlog.delayed,
        },
      });
    }

    const job = await executionWorkerDeps.popExecutionJob();
    if (!job) {
      if (once) {
        return;
      }

      await executionWorkerDeps.sleep(pollInterval);
      continue;
    }

    executionWorkerDeps.appLogger.info(
      {
        runId: job.runKey,
        correlationId: job.correlationId,
        organizationId: job.organizationId,
      },
      "Processing queued workflow run",
    );

    try {
      await executionWorkerDeps.processExecutionQueueJob(job);
    } catch (error: unknown) {
      executionWorkerDeps.appLogger.error(
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
