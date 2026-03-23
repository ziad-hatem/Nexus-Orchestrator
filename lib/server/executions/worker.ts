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

function emitQueueBacklogAlert(backlog: { ready: number; delayed: number }) {
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
}

async function processQueuedJob(params?: { rethrowOnError?: boolean }) {
  const job = await executionWorkerDeps.popExecutionJob();
  if (!job) {
    return false;
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

    if (params?.rethrowOnError ?? true) {
      throw error;
    }
  }

  return true;
}

export async function runExecutionWorkerCycle(options?: {
  maxJobs?: number;
  rethrowOnError?: boolean;
}) {
  const movedDelayedJobs = await executionWorkerDeps.drainDueExecutionJobs();
  const backlogBefore = await executionWorkerDeps.getExecutionQueueBacklog();
  emitQueueBacklogAlert(backlogBefore);

  const maxJobs = Math.max(1, options?.maxJobs ?? 1);
  let processedJobs = 0;

  for (let index = 0; index < maxJobs; index += 1) {
    const didProcess = await processQueuedJob({
      rethrowOnError: options?.rethrowOnError,
    });
    if (!didProcess) {
      break;
    }

    processedJobs += 1;
  }

  const backlogAfter = await executionWorkerDeps.getExecutionQueueBacklog();

  return {
    movedDelayedJobs,
    processedJobs,
    backlogBefore,
    backlogAfter,
  };
}

export async function startExecutionWorker(options?: { once?: boolean }) {
  const once = options?.once ?? false;
  const pollInterval = executionWorkerDeps.getExecutionWorkerPollIntervalMs();

  do {
    const cycle = await runExecutionWorkerCycle({
      maxJobs: 1,
      rethrowOnError: once,
    });

    if (cycle.processedJobs === 0) {
      if (once) {
        return;
      }

      await executionWorkerDeps.sleep(pollInterval);
      continue;
    }
  } while (!once);
}
