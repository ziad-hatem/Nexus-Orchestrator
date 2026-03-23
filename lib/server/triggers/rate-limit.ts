import { createHash } from "node:crypto";
import { getRequiredEnv } from "@/lib/env";

type UpstashPipelineResponse = Array<{
  result?: unknown;
  error?: string;
}>;

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  current: number;
  limit: number;
  windowSeconds: number;
};

type IdempotencyReservation = {
  reserved: boolean;
  key: string | null;
};

type WindowCounterResult = {
  key: string;
  current: number;
  windowSeconds: number;
};

function getUpstashConfig() {
  return {
    baseUrl: getRequiredEnv("UPSTASH_REDIS_REST_URL").replace(/\/+$/, ""),
    token: getRequiredEnv("UPSTASH_REDIS_REST_TOKEN"),
  };
}

async function runPipeline(commands: unknown[][]): Promise<UpstashPipelineResponse> {
  const config = getUpstashConfig();
  const response = await fetch(`${config.baseUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash pipeline failed with status ${response.status}`);
  }

  const payload = (await response.json()) as UpstashPipelineResponse;
  const firstError = payload.find((entry) => entry.error);
  if (firstError?.error) {
    throw new Error(`Upstash pipeline failed: ${firstError.error}`);
  }

  return payload;
}

export async function enforceRateLimit(params: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const payload = await runPipeline([
    ["INCR", params.key],
    ["EXPIRE", params.key, params.windowSeconds],
  ]);
  const current = Number(payload[0]?.result ?? 0);
  const remaining = Math.max(0, params.limit - current);

  return {
    ok: current <= params.limit,
    remaining,
    current,
    limit: params.limit,
    windowSeconds: params.windowSeconds,
  };
}

export async function reserveIdempotencyKey(params: {
  key: string | null;
  ttlSeconds: number;
}): Promise<IdempotencyReservation> {
  if (!params.key) {
    return {
      reserved: true,
      key: null,
    };
  }

  const payload = await runPipeline([
    ["SET", params.key, "1", "EX", params.ttlSeconds, "NX"],
  ]);
  const reserved = payload[0]?.result === "OK";

  return {
    reserved,
    key: params.key,
  };
}

export async function incrementWindowCounter(params: {
  key: string;
  windowSeconds: number;
}): Promise<WindowCounterResult> {
  const payload = await runPipeline([
    ["INCR", params.key],
    ["EXPIRE", params.key, params.windowSeconds],
  ]);

  return {
    key: params.key,
    current: Number(payload[0]?.result ?? 0),
    windowSeconds: params.windowSeconds,
  };
}

export function buildManualRateLimitKey(params: {
  organizationId: string;
  workflowId: string;
  userId: string;
}): string {
  return `wf:manual:rl:${params.organizationId}:${params.workflowId}:${params.userId}`;
}

export function buildWebhookRateLimitKey(params: {
  bindingId: string;
  ipAddress: string;
}): string {
  return `wf:webhook:rl:${params.bindingId}:${params.ipAddress || "unknown"}`;
}

export function buildInternalEventRateLimitKey(eventKey: string): string {
  return `wf:internal:rl:${eventKey}`;
}

export function buildManualIdempotencyKey(params: {
  organizationId: string;
  workflowId: string;
  userId: string;
  idempotencyKey?: string | null;
}): string | null {
  return params.idempotencyKey
    ? `wf:manual:dedupe:${params.organizationId}:${params.workflowId}:${params.userId}:${params.idempotencyKey}`
    : null;
}

export function buildWebhookIdempotencyKey(params: {
  bindingId: string;
  deliveryId?: string | null;
  timestamp?: string | null;
  rawBody: string;
}): string {
  const rawSeed =
    params.deliveryId?.trim() ||
    createHash("sha256")
      .update(`${params.bindingId}:${params.timestamp ?? ""}:${params.rawBody}`)
      .digest("hex");

  return `wf:webhook:dedupe:${params.bindingId}:${rawSeed}`;
}

export function buildInternalEventIdempotencyKey(params: {
  eventId: string;
  eventKey: string;
}): string {
  return `wf:internal:dedupe:${params.eventKey}:${params.eventId}`;
}
