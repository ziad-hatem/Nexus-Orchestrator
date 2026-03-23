import { getOptionalEnv, getRequiredEnv } from "@/lib/env";
import type { ExecutionQueueJob } from "@/lib/server/executions/types";

const READY_QUEUE_KEY = "wf:exec:ready";
const DELAYED_QUEUE_KEY = "wf:exec:delayed";
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAYS_SECONDS = [30, 120, 300];
const DEFAULT_WEBHOOK_TIMEOUT_MS = 10000;

type UpstashPipelineResponse = Array<{
  result?: unknown;
  error?: string;
}>;

export const executionQueueDeps = {
  getOptionalEnv,
  getRequiredEnv,
  fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
};

function getUpstashConfig() {
  return {
    baseUrl: executionQueueDeps
      .getRequiredEnv("UPSTASH_REDIS_REST_URL")
      .replace(/\/+$/, ""),
    token: executionQueueDeps.getRequiredEnv("UPSTASH_REDIS_REST_TOKEN"),
  };
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

async function runPipeline(commands: unknown[][]): Promise<UpstashPipelineResponse> {
  const config = getUpstashConfig();
  const response = await executionQueueDeps.fetch(`${config.baseUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash execution queue failed with status ${response.status}`);
  }

  const payload = (await response.json()) as UpstashPipelineResponse;
  const firstError = payload.find((entry) => entry.error);
  if (firstError?.error) {
    throw new Error(`Upstash execution queue failed: ${firstError.error}`);
  }

  return payload;
}

function serializeJob(job: ExecutionQueueJob): string {
  return JSON.stringify(job);
}

function parseJob(raw: unknown): ExecutionQueueJob | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ExecutionQueueJob;
    if (
      typeof parsed?.runDbId !== "string" ||
      typeof parsed?.organizationId !== "string" ||
      typeof parsed?.runKey !== "string" ||
      typeof parsed?.correlationId !== "string" ||
      typeof parsed?.enqueuedAt !== "string" ||
      !["trigger", "retry", "manual_retry"].includes(parsed?.reason)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getExecutionWorkerPollIntervalMs(): number {
  return parsePositiveInteger(
    executionQueueDeps.getOptionalEnv("EXECUTION_WORKER_POLL_INTERVAL_MS"),
    DEFAULT_POLL_INTERVAL_MS,
  );
}

export function getExecutionWorkerHeartbeatIntervalMs(): number {
  return parsePositiveInteger(
    executionQueueDeps.getOptionalEnv("EXECUTION_WORKER_HEARTBEAT_INTERVAL_MS"),
    DEFAULT_HEARTBEAT_INTERVAL_MS,
  );
}

export function getExecutionMaxRetries(): number {
  return parsePositiveInteger(
    executionQueueDeps.getOptionalEnv("EXECUTION_MAX_RETRIES"),
    DEFAULT_MAX_RETRIES,
  );
}

export function getExecutionRetryDelaysSeconds(): number[] {
  const configured = executionQueueDeps.getOptionalEnv(
    "EXECUTION_RETRY_DELAYS_SECONDS",
  );
  if (!configured) {
    return [...DEFAULT_RETRY_DELAYS_SECONDS];
  }

  const parsed = configured
    .split(",")
    .map((value) => parsePositiveInteger(value.trim(), 0))
    .filter((value) => value > 0);

  return parsed.length > 0 ? parsed : [...DEFAULT_RETRY_DELAYS_SECONDS];
}

export function getExecutionWebhookTimeoutMs(): number {
  return parsePositiveInteger(
    executionQueueDeps.getOptionalEnv("EXECUTION_WEBHOOK_TIMEOUT_MS"),
    DEFAULT_WEBHOOK_TIMEOUT_MS,
  );
}

export async function enqueueExecutionJob(job: ExecutionQueueJob): Promise<void> {
  await runPipeline([["LPUSH", READY_QUEUE_KEY, serializeJob(job)]]);
}

export async function popExecutionJob(): Promise<ExecutionQueueJob | null> {
  const payload = await runPipeline([["RPOP", READY_QUEUE_KEY]]);
  return parseJob(payload[0]?.result);
}

export async function scheduleExecutionJob(params: {
  job: ExecutionQueueJob;
  availableAt: Date;
}): Promise<void> {
  await runPipeline([
    [
      "ZADD",
      DELAYED_QUEUE_KEY,
      Math.floor(params.availableAt.getTime() / 1000),
      serializeJob(params.job),
    ],
  ]);
}

async function listDueDelayedJobs(limit: number): Promise<string[]> {
  const payload = await runPipeline([
    ["ZRANGEBYSCORE", DELAYED_QUEUE_KEY, "-inf", Math.floor(Date.now() / 1000), "LIMIT", 0, limit],
  ]);

  const results = payload[0]?.result;
  return Array.isArray(results)
    ? results.filter((item): item is string => typeof item === "string")
    : [];
}

async function removeDelayedJob(raw: string): Promise<boolean> {
  const payload = await runPipeline([["ZREM", DELAYED_QUEUE_KEY, raw]]);
  return Number(payload[0]?.result ?? 0) > 0;
}

export async function drainDueExecutionJobs(limit = 20): Promise<number> {
  const dueJobs = await listDueDelayedJobs(limit);
  let moved = 0;

  for (const rawJob of dueJobs) {
    const removed = await removeDelayedJob(rawJob);
    if (!removed) {
      continue;
    }

    await runPipeline([["LPUSH", READY_QUEUE_KEY, rawJob]]);
    moved += 1;
  }

  return moved;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getExecutionQueueBacklog(): Promise<{
  ready: number;
  delayed: number;
}> {
  const payload = await runPipeline([
    ["LLEN", READY_QUEUE_KEY],
    ["ZCARD", DELAYED_QUEUE_KEY],
  ]);

  return {
    ready: Number(payload[0]?.result ?? 0),
    delayed: Number(payload[1]?.result ?? 0),
  };
}
