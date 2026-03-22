import {
  drainDueExecutionJobs,
  getExecutionWorkerPollIntervalMs,
  popExecutionJob,
  sleep,
} from "@/lib/server/executions/queue";
import { processExecutionQueueJob } from "@/lib/server/executions/service";
import { appLogger } from "@/lib/observability/logger";

export async function startExecutionWorker(options?: { once?: boolean }) {
  const once = options?.once ?? false;
  const pollInterval = getExecutionWorkerPollIntervalMs();

  do {
    await drainDueExecutionJobs();
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

    await processExecutionQueueJob(job);
  } while (!once);
}
