import assert from "node:assert/strict";
import test from "node:test";
import {
  GET as getExecutionWorkerDrain,
  executionWorkerDrainRouteDeps,
} from "@/app/api/internal/worker/drain/route";
import { restoreMutableExports, readJson } from "@/tests/helpers/test-utils";

const originalExecutionWorkerDrainRouteDeps = {
  ...executionWorkerDrainRouteDeps,
};

test.afterEach(() => {
  restoreMutableExports(
    executionWorkerDrainRouteDeps,
    originalExecutionWorkerDrainRouteDeps,
  );
});

function createLogger() {
  return {
    info() {},
    warn() {},
    error() {},
  };
}

function createRouteErrorResponse(error: unknown, status = 500) {
  return Response.json(
    { error: error instanceof Error ? error.message : "route error" },
    { status },
  );
}

test("execution worker drain route rejects unauthorized requests", async () => {
  executionWorkerDrainRouteDeps.createRequestLogger = () => createLogger() as never;
  executionWorkerDrainRouteDeps.getFirstAvailableEnv = () => "secret" as never;
  executionWorkerDrainRouteDeps.writeLog = () => undefined;

  const response = await getExecutionWorkerDrain(
    new Request("https://example.com/api/internal/worker/drain"),
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 401);
  assert.equal(payload.error, "Unauthorized");
});

test("execution worker drain route processes a secured batch request", async () => {
  executionWorkerDrainRouteDeps.createRequestLogger = () => createLogger() as never;
  executionWorkerDrainRouteDeps.getFirstAvailableEnv = () => "secret" as never;
  executionWorkerDrainRouteDeps.getOptionalEnv = () => "12";
  executionWorkerDrainRouteDeps.runExecutionWorkerCycle = async (options) => {
    assert.equal(options?.maxJobs, 12);
    assert.equal(options?.rethrowOnError, false);
    return {
      movedDelayedJobs: 3,
      processedJobs: 7,
      backlogBefore: { ready: 9, delayed: 2 },
      backlogAfter: { ready: 2, delayed: 0 },
    };
  };
  executionWorkerDrainRouteDeps.writeLog = () => undefined;

  const response = await getExecutionWorkerDrain(
    new Request("https://example.com/api/internal/worker/drain", {
      headers: {
        authorization: "Bearer secret",
      },
    }),
  );
  const payload = await readJson<{
    ok: boolean;
    maxJobs: number;
    movedDelayedJobs: number;
    processedJobs: number;
    backlogBefore: { ready: number; delayed: number };
    backlogAfter: { ready: number; delayed: number };
  }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.maxJobs, 12);
  assert.equal(payload.processedJobs, 7);
  assert.deepEqual(payload.backlogAfter, { ready: 2, delayed: 0 });
});

test("execution worker drain route caps requested batch sizes", async () => {
  executionWorkerDrainRouteDeps.createRequestLogger = () => createLogger() as never;
  executionWorkerDrainRouteDeps.getFirstAvailableEnv = () => "secret" as never;
  executionWorkerDrainRouteDeps.getOptionalEnv = () => null;
  executionWorkerDrainRouteDeps.runExecutionWorkerCycle = async (options) => {
    assert.equal(options?.maxJobs, 25);
    return {
      movedDelayedJobs: 0,
      processedJobs: 0,
      backlogBefore: { ready: 0, delayed: 0 },
      backlogAfter: { ready: 0, delayed: 0 },
    };
  };
  executionWorkerDrainRouteDeps.writeLog = () => undefined;

  const response = await getExecutionWorkerDrain(
    new Request("https://example.com/api/internal/worker/drain?limit=99", {
      headers: {
        authorization: "Bearer secret",
      },
    }),
  );

  assert.equal(response.status, 200);
});

test("execution worker drain route maps runtime failures through route error handling", async () => {
  executionWorkerDrainRouteDeps.createRequestLogger = () => createLogger() as never;
  executionWorkerDrainRouteDeps.getFirstAvailableEnv = () => "secret" as never;
  executionWorkerDrainRouteDeps.getOptionalEnv = () => null;
  executionWorkerDrainRouteDeps.runExecutionWorkerCycle = async () => {
    throw new Error("boom");
  };
  executionWorkerDrainRouteDeps.writeLog = () => undefined;
  executionWorkerDrainRouteDeps.handleRouteError = (error) =>
    createRouteErrorResponse(error, 500) as never;

  const response = await getExecutionWorkerDrain(
    new Request("https://example.com/api/internal/worker/drain", {
      headers: {
        authorization: "Bearer secret",
      },
    }),
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 500);
  assert.equal(payload.error, "boom");
});
