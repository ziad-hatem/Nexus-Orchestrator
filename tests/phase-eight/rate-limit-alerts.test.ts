import assert from "node:assert/strict";
import test from "node:test";
import {
  alertsDeps,
  emitOperationalAlert,
  getOperationsQueueBacklogAlertThreshold,
} from "@/lib/observability/alerts";
import {
  enforceRateLimit,
  incrementWindowCounter,
  reserveIdempotencyKey,
} from "@/lib/server/triggers/rate-limit";

type PipelineEntry = { result?: unknown; error?: string };
type CapturedAlert = {
  message: string;
  context?: Record<string, unknown>;
  extras?: Record<string, unknown>;
};

function createPipelineFetch() {
  const counters = new Map<string, number>();
  const reservations = new Set<string>();

  const fetchImpl = async (_url: string, options?: RequestInit) => {
    const commands = JSON.parse(String(options?.body)) as unknown[][];
    const response: PipelineEntry[] = commands.map(([command, ...args]) => {
      switch (command) {
        case "INCR": {
          const key = String(args[0]);
          const current = (counters.get(key) ?? 0) + 1;
          counters.set(key, current);
          return { result: current };
        }
        case "EXPIRE":
          return { result: 1 };
        case "SET": {
          const key = String(args[0]);
          if (reservations.has(key)) {
            return { result: null };
          }
          reservations.add(key);
          return { result: "OK" };
        }
        default:
          return { error: `Unsupported command ${String(command)}` };
      }
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  return { fetchImpl };
}

test("rate-limit pipeline helpers enforce budgets and idempotency", async () => {
  const { fetchImpl } = createPipelineFetch();
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  globalThis.fetch = fetchImpl as typeof globalThis.fetch;
  process.env.UPSTASH_REDIS_REST_URL = "https://example-upstash.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";

  try {
    const first = await enforceRateLimit({
      key: "wf:test:limit",
      limit: 2,
      windowSeconds: 60,
    });
    const second = await enforceRateLimit({
      key: "wf:test:limit",
      limit: 2,
      windowSeconds: 60,
    });
    const third = await enforceRateLimit({
      key: "wf:test:limit",
      limit: 2,
      windowSeconds: 60,
    });
    const reservationA = await reserveIdempotencyKey({
      key: "wf:test:dedupe",
      ttlSeconds: 60,
    });
    const reservationB = await reserveIdempotencyKey({
      key: "wf:test:dedupe",
      ttlSeconds: 60,
    });
    const counter = await incrementWindowCounter({
      key: "wf:test:counter",
      windowSeconds: 60,
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(third.ok, false);
    assert.equal(third.current, 3);
    assert.equal(reservationA.reserved, true);
    assert.equal(reservationB.reserved, false);
    assert.equal(counter.current, 1);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
});

test("emitOperationalAlert only emits non-ok alerts and includes alert context", () => {
  const originalAlertsDeps = { ...alertsDeps };
  const state = {
    captured: null as CapturedAlert | null,
  };

  alertsDeps.captureServerMessage = (message, options) => {
    state.captured = {
      message,
      context: options?.context as Record<string, unknown> | undefined,
      extras: options?.extras,
    };
    return "alert_1";
  };

  try {
    const okResult = emitOperationalAlert({
      alert: {
        key: "queue_backlog",
        title: "Queue backlog",
        status: "ok",
        currentValue: 1,
        thresholdValue: 50,
        message: "ok",
      },
      context: { organizationId: "org_1" },
    });

    const warningResult = emitOperationalAlert({
      alert: {
        key: "retry_exhaustion",
        title: "Retry exhaustion",
        status: "warning",
        currentValue: 3,
        thresholdValue: 5,
        message: "retry warning",
      },
      context: { organizationId: "org_1" },
      extras: { organizationSlug: "acme" },
    });

    assert.equal(okResult, null);
    assert.equal(warningResult, "alert_1");
    assert.ok(state.captured);
    assert.equal(state.captured.message, "retry warning");
    assert.equal(state.captured.context?.alertKey, "retry_exhaustion");
    assert.equal(state.captured.extras?.organizationSlug, "acme");
    assert.equal(state.captured.extras?.currentValue, 3);
    assert.equal(state.captured.extras?.thresholdValue, 5);
  } finally {
    Object.assign(alertsDeps, originalAlertsDeps);
  }
});

test("queue backlog threshold honors env overrides through alert deps", () => {
  const originalAlertsDeps = { ...alertsDeps };
  alertsDeps.getOptionalEnv = (name: string) =>
    name === "OPERATIONS_QUEUE_BACKLOG_ALERT_THRESHOLD" ? "12" : null;

  try {
    assert.equal(getOperationsQueueBacklogAlertThreshold(), 12);
  } finally {
    Object.assign(alertsDeps, originalAlertsDeps);
  }
});
