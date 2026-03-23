import assert from "node:assert/strict";
import test from "node:test";
import {
  executionWorkerDeps,
  runExecutionWorkerCycle,
  startExecutionWorker,
} from "@/lib/server/executions/worker";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalExecutionWorkerDeps = { ...executionWorkerDeps };

test.afterEach(() => {
  restoreMutableExports(executionWorkerDeps, originalExecutionWorkerDeps);
});

function createLogger() {
  return {
    info() {},
    warn() {},
    error() {},
  };
}

test("worker once mode exits cleanly when no job is available", async () => {
  const operations: string[] = [];

  executionWorkerDeps.drainDueExecutionJobs = async () => {
    operations.push("drain");
    return 0;
  };
  executionWorkerDeps.getExecutionQueueBacklog = async () => ({
    ready: 0,
    delayed: 0,
  });
  executionWorkerDeps.getExecutionWorkerPollIntervalMs = () => 1;
  executionWorkerDeps.popExecutionJob = async () => {
    operations.push("pop");
    return null;
  };
  executionWorkerDeps.sleep = async () => {
    operations.push("sleep");
  };
  executionWorkerDeps.processExecutionQueueJob = async () => {
    operations.push("process");
  };
  executionWorkerDeps.appLogger = createLogger() as never;
  executionWorkerDeps.evaluateOperationalAlerts = () => [];
  executionWorkerDeps.emitOperationalAlert = () => null;

  await startExecutionWorker({ once: true });

  assert.deepEqual(operations, ["drain", "pop"]);
});

test("worker once mode processes one queued job and emits backlog alerts", async () => {
  const processedJobs: string[] = [];
  let emittedAlertKey = "";

  executionWorkerDeps.drainDueExecutionJobs = async () => 1;
  executionWorkerDeps.getExecutionQueueBacklog = async () => ({
    ready: 4,
    delayed: 3,
  });
  executionWorkerDeps.getExecutionWorkerPollIntervalMs = () => 1;
  executionWorkerDeps.popExecutionJob = async () => ({
    runDbId: "run_db_1",
    organizationId: "org_1",
    runKey: "RUN-1001",
    correlationId: "corr_1",
    enqueuedAt: "2026-03-23T00:00:00.000Z",
    reason: "trigger",
  });
  executionWorkerDeps.sleep = async () => undefined;
  executionWorkerDeps.processExecutionQueueJob = async (job) => {
    processedJobs.push(job.runDbId);
  };
  executionWorkerDeps.appLogger = createLogger() as never;
  executionWorkerDeps.evaluateOperationalAlerts = () => [
    {
      key: "queue_backlog",
      label: "Queue backlog",
      status: "critical",
      message: "backlog",
      currentValue: 7,
      thresholdValue: 5,
    },
  ] as never;
  executionWorkerDeps.emitOperationalAlert = ({ alert }) => {
    emittedAlertKey = alert.key;
    return "event_1";
  };

  await startExecutionWorker({ once: true });

  assert.deepEqual(processedJobs, ["run_db_1"]);
  assert.equal(emittedAlertKey, "queue_backlog");
});

test("worker once mode rethrows processing failures after logging them", async () => {
  executionWorkerDeps.drainDueExecutionJobs = async () => 0;
  executionWorkerDeps.getExecutionQueueBacklog = async () => ({
    ready: 1,
    delayed: 0,
  });
  executionWorkerDeps.getExecutionWorkerPollIntervalMs = () => 1;
  executionWorkerDeps.popExecutionJob = async () => ({
    runDbId: "run_db_1",
    organizationId: "org_1",
    runKey: "RUN-1001",
    correlationId: "corr_1",
    enqueuedAt: "2026-03-23T00:00:00.000Z",
    reason: "trigger",
  });
  executionWorkerDeps.sleep = async () => undefined;
  executionWorkerDeps.processExecutionQueueJob = async () => {
    throw new Error("worker failure");
  };
  executionWorkerDeps.appLogger = createLogger() as never;
  executionWorkerDeps.evaluateOperationalAlerts = () => [];
  executionWorkerDeps.emitOperationalAlert = () => null;

  await assert.rejects(
    () => startExecutionWorker({ once: true }),
    /worker failure/,
  );
});

test("worker cycle can process multiple jobs in one batch without throwing on per-job failures", async () => {
  const processedJobs: string[] = [];
  const jobs = [
    {
      runDbId: "run_db_1",
      organizationId: "org_1",
      runKey: "RUN-1001",
      correlationId: "corr_1",
      enqueuedAt: "2026-03-23T00:00:00.000Z",
      reason: "trigger" as const,
    },
    {
      runDbId: "run_db_2",
      organizationId: "org_1",
      runKey: "RUN-1002",
      correlationId: "corr_2",
      enqueuedAt: "2026-03-23T00:00:00.000Z",
      reason: "retry" as const,
    },
    null,
  ];

  executionWorkerDeps.drainDueExecutionJobs = async () => 2;
  executionWorkerDeps.getExecutionQueueBacklog = async () => ({
    ready: 2,
    delayed: 1,
  });
  executionWorkerDeps.popExecutionJob = async () => jobs.shift() ?? null;
  executionWorkerDeps.processExecutionQueueJob = async (job) => {
    processedJobs.push(job.runDbId);
    if (job.runDbId === "run_db_1") {
      throw new Error("first failure");
    }
  };
  executionWorkerDeps.appLogger = createLogger() as never;
  executionWorkerDeps.evaluateOperationalAlerts = () => [];
  executionWorkerDeps.emitOperationalAlert = () => null;

  const result = await runExecutionWorkerCycle({
    maxJobs: 3,
    rethrowOnError: false,
  });

  assert.equal(result.movedDelayedJobs, 2);
  assert.equal(result.processedJobs, 2);
  assert.deepEqual(processedJobs, ["run_db_1", "run_db_2"]);
});
