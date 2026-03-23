import assert from "node:assert/strict";
import test from "node:test";
import {
  getRedactionPlaceholder,
  redactSensitiveData,
  redactSentryEventLike,
} from "@/lib/observability/redaction";

const REDACTION_PLACEHOLDER = getRedactionPlaceholder();

test("redactSensitiveData redacts nested secret-bearing keys while preserving shape", () => {
  const input = {
    authorization: "Bearer top-secret",
    nested: {
      api_key: "nexus-secret",
      safe: "visible",
    },
    headers: [
      {
        cookie: "session=abc",
      },
    ],
  };

  const output = redactSensitiveData(input);

  assert.equal(output.authorization, REDACTION_PLACEHOLDER);
  assert.equal(output.nested.api_key, REDACTION_PLACEHOLDER);
  assert.equal(output.nested.safe, "visible");
  assert.equal(output.headers[0]?.cookie, REDACTION_PLACEHOLDER);
});

test("redactSentryEventLike redacts request, extra, and context payloads", () => {
  const output = redactSentryEventLike({
    request: {
      headers: {
        "x-nexus-api-key": "secret",
      },
    },
    extra: {
      token: "top-secret",
      safe: "ok",
    },
    contexts: {
      auth: {
        password: "nope",
      },
    },
  });

  assert.equal(
    output.request.headers["x-nexus-api-key"],
    REDACTION_PLACEHOLDER,
  );
  assert.equal(output.extra.token, REDACTION_PLACEHOLDER);
  assert.equal(output.extra.safe, "ok");
  assert.equal(output.contexts.auth.password, REDACTION_PLACEHOLDER);
});
