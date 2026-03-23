import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMonitoringContext,
  captureServerMessage,
  errorTrackingDeps,
} from "@/lib/observability/error-tracking";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalErrorTrackingDeps = { ...errorTrackingDeps };

test.afterEach(() => {
  restoreMutableExports(errorTrackingDeps, originalErrorTrackingDeps);
});

type FakeScope = {
  user: Record<string, unknown> | null;
  tags: Record<string, string>;
  contexts: Record<string, Record<string, unknown>>;
  extras: Record<string, unknown>;
  level: string | null;
  fingerprint: string[];
};

type CapturedMessage = {
  message: string;
  level: string;
  scope: FakeScope;
};

function createFakeSentry() {
  const root = {
    user: null as Record<string, unknown> | null,
    tags: {} as Record<string, string>,
    contexts: {} as Record<string, Record<string, unknown>>,
  };
  let activeScope: FakeScope | null = null;
  let captured: CapturedMessage | null = null;

  const sentry = {
    setUser(user: Record<string, unknown> | null) {
      root.user = user;
    },
    setTag(key: string, value: string) {
      root.tags[key] = value;
    },
    setContext(name: string, context: Record<string, unknown>) {
      root.contexts[name] = context;
    },
    withScope<T>(callback: (scope: {
      setUser: (user: { id?: string; email?: string } | null) => void;
      setTag: (key: string, value: string) => void;
      setContext: (name: string, context: Record<string, unknown>) => void;
      setExtra: (key: string, extra: unknown) => void;
      setLevel: (level: "info" | "warning" | "error") => void;
      setFingerprint: (fingerprint: string[]) => void;
    }) => T): T {
      activeScope = {
        user: null,
        tags: {},
        contexts: {},
        extras: {},
        level: null,
        fingerprint: [],
      };
      return callback({
        setUser(user) {
          if (activeScope) {
            activeScope.user = user as Record<string, unknown> | null;
          }
        },
        setTag(key, value) {
          if (activeScope) {
            activeScope.tags[key] = value;
          }
        },
        setContext(name, context) {
          if (activeScope) {
            activeScope.contexts[name] = context;
          }
        },
        setExtra(key, extra) {
          if (activeScope) {
            activeScope.extras[key] = extra;
          }
        },
        setLevel(level) {
          if (activeScope) {
            activeScope.level = level;
          }
        },
        setFingerprint(fingerprint) {
          if (activeScope) {
            activeScope.fingerprint = fingerprint;
          }
        },
      });
    },
    captureMessage(message: string, level: string) {
      captured = {
        message,
        level,
        scope: activeScope!,
      };
      return "event_1";
    },
    captureException() {
      return "event_2";
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
  };

  return {
    sentry,
    root,
    getCaptured: (): CapturedMessage | null => captured,
  };
}

test("captureServerMessage redacts sensitive extras before sending to Sentry", () => {
  const fake = createFakeSentry();
  errorTrackingDeps.sentry = fake.sentry as never;

  const eventId = captureServerMessage("phase-eight warning", {
    context: {
      requestId: "req_1",
      route: "api.orgs.operations.get",
      method: "GET",
      path: "/api/orgs/acme/operations",
      organizationId: "org_1",
      organizationSlug: "acme",
      workflowId: "WFL-1",
      runId: "RUN-1",
      correlationId: "corr_1",
      securityEvent: "webhook_hardening",
    },
    extras: {
      requestBodyPreview: "{\"authorization\":\"secret\"}",
      nested: {
        token: "abc123",
        safe: "visible",
      },
    },
    level: "warning",
    fingerprint: ["phase-eight", "security"],
  });

  const captured = fake.getCaptured();

  assert.equal(eventId, "event_1");
  assert.equal(captured?.message, "phase-eight warning");
  assert.equal(captured?.level, "warning");
  assert.equal(captured?.scope.tags.route, "api.orgs.operations.get");
  assert.equal(captured?.scope.tags.security_event, "webhook_hardening");
  assert.equal(
    captured?.scope.contexts.request?.path,
    "/api/orgs/acme/operations",
  );
  assert.equal(captured?.scope.extras.requestBodyPreview, "[REDACTED]");
  assert.deepEqual(captured?.scope.extras.nested, {
    token: "[REDACTED]",
    safe: "visible",
  });
});

test("applyMonitoringContext sets user, tags, and redacted contexts", () => {
  const fake = createFakeSentry();
  errorTrackingDeps.sentry = fake.sentry as never;

  applyMonitoringContext({
    userId: "user_1",
    organizationId: "org_1",
    organizationSlug: "acme",
    membershipId: "membership_1",
    role: "org_admin",
    workflowId: "WFL-1",
    runId: "RUN-1",
    correlationId: "corr_1",
    alertKey: "queue_backlog",
  });

  assert.deepEqual(fake.root.user, { id: "user_1" });
  assert.equal(fake.root.tags.organization_slug, "acme");
  assert.equal(fake.root.tags.alert_key, "queue_backlog");
  assert.equal(fake.root.contexts.organization?.slug, "acme");
  assert.equal(fake.root.contexts.execution?.runId, "RUN-1");
});
