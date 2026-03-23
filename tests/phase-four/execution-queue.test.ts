import assert from "node:assert/strict";
import test from "node:test";
import {
  drainDueExecutionJobs,
  enqueueExecutionJob,
  executionQueueDeps,
  getExecutionRetryDelaysSeconds,
  getExecutionWorkerPollIntervalMs,
  getExecutionWorkerHeartbeatIntervalMs,
  getExecutionWebhookTimeoutMs,
  getExecutionQueueBacklog,
  popExecutionJob,
  scheduleExecutionJob,
} from "@/lib/server/executions/queue";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalExecutionQueueDeps = { ...executionQueueDeps };

type DelayedJob = {
  score: number;
  raw: string;
};

test.afterEach(() => {
  restoreMutableExports(executionQueueDeps, originalExecutionQueueDeps);
});

function createPipelineFetchState() {
  const ready: string[] = [];
  const delayed: DelayedJob[] = [];

  const fetchImpl: typeof executionQueueDeps.fetch = async (_url, options) => {
    const commands = JSON.parse(String(options?.body)) as unknown[][];
    const result = commands.map((command) => {
      const [op, ...args] = command;

      switch (op) {
        case "LPUSH": {
          ready.unshift(String(args[1]));
          return { result: ready.length };
        }
        case "RPOP": {
          return { result: ready.pop() ?? null };
        }
        case "ZADD": {
          const score = Number(args[1]);
          const raw = String(args[2]);
          delayed.push({ score, raw });
          return { result: 1 };
        }
        case "ZRANGEBYSCORE": {
          const maxScore = Number(args[2]);
          const limit = Number(args[5]);
          const due = delayed
            .filter((item) => item.score <= maxScore)
            .sort((left, right) => left.score - right.score)
            .slice(0, limit)
            .map((item) => item.raw);
          return { result: due };
        }
        case "ZREM": {
          const raw = String(args[1]);
          const index = delayed.findIndex((item) => item.raw === raw);
          if (index === -1) {
            return { result: 0 };
          }

          delayed.splice(index, 1);
          return { result: 1 };
        }
        case "LLEN": {
          return { result: ready.length };
        }
        case "ZCARD": {
          return { result: delayed.length };
        }
        default:
          return { error: `Unsupported op ${String(op)}` };
      }
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  return { ready, delayed, fetchImpl };
}

function installQueueEnv(fetchImpl: typeof executionQueueDeps.fetch) {
  executionQueueDeps.fetch = fetchImpl;
  executionQueueDeps.getRequiredEnv = (name: string) => {
    if (name === "UPSTASH_REDIS_REST_URL") {
      return "https://example-upstash.test";
    }
    if (name === "UPSTASH_REDIS_REST_TOKEN") {
      return "token";
    }

    throw new Error(`Unexpected required env ${name}`);
  };
}

test("execution queue env helpers honor configured values and fall back safely", () => {
  executionQueueDeps.getOptionalEnv = (name: string) => {
    switch (name) {
      case "EXECUTION_WORKER_POLL_INTERVAL_MS":
        return "2500";
      case "EXECUTION_WORKER_HEARTBEAT_INTERVAL_MS":
        return "7000";
      case "EXECUTION_RETRY_DELAYS_SECONDS":
        return "5, 30, invalid, 0, 120";
      case "EXECUTION_WEBHOOK_TIMEOUT_MS":
        return "15000";
      default:
        return null;
    }
  };

  assert.equal(getExecutionWorkerPollIntervalMs(), 2500);
  assert.equal(getExecutionWorkerHeartbeatIntervalMs(), 7000);
  assert.deepEqual(getExecutionRetryDelaysSeconds(), [5, 30, 120]);
  assert.equal(getExecutionWebhookTimeoutMs(), 15000);
});

test("enqueue, schedule, drain, pop, and backlog operations round-trip execution jobs", async () => {
  const { fetchImpl } = createPipelineFetchState();
  installQueueEnv(fetchImpl);

  await enqueueExecutionJob({
    runDbId: "run_db_1",
    organizationId: "org_1",
    runKey: "RUN-1001",
    correlationId: "corr_1",
    enqueuedAt: "2026-03-23T00:00:00.000Z",
    reason: "trigger",
  });
  await scheduleExecutionJob({
    job: {
      runDbId: "run_db_2",
      organizationId: "org_1",
      runKey: "RUN-1002",
      correlationId: "corr_2",
      enqueuedAt: "2026-03-23T00:00:00.000Z",
      reason: "retry",
    },
    availableAt: new Date(Date.now() - 1_000),
  });

  const beforeDrain = await getExecutionQueueBacklog();
  assert.deepEqual(beforeDrain, { ready: 1, delayed: 1 });

  const moved = await drainDueExecutionJobs();
  assert.equal(moved, 1);

  const afterDrain = await getExecutionQueueBacklog();
  assert.deepEqual(afterDrain, { ready: 2, delayed: 0 });

  const first = await popExecutionJob();
  const second = await popExecutionJob();

  assert.equal(first?.runDbId, "run_db_1");
  assert.equal(second?.runDbId, "run_db_2");
});

test("popExecutionJob ignores malformed serialized jobs instead of throwing", async () => {
  const { ready, fetchImpl } = createPipelineFetchState();
  ready.unshift("{bad json");
  installQueueEnv(fetchImpl);

  const popped = await popExecutionJob();

  assert.equal(popped, null);
});
