import assert from "node:assert/strict";
import test from "node:test";
import {
  getRedactionPlaceholder,
  redactSensitiveData,
} from "@/lib/observability/redaction";

const REDACTION_PLACEHOLDER = getRedactionPlaceholder();

test("redactSensitiveData redacts raw-body and preview fields in nested records", () => {
  const output = redactSensitiveData({
    rawBody: "{\"token\":\"super-secret\"}",
    requestBodyPreview: "Bearer very-secret",
    responsePreview: "{\"apiKey\":\"response-secret\"}",
    nested: {
      responseBody: "session=abc123",
      safe: "visible",
    },
  });

  assert.equal(output.rawBody, REDACTION_PLACEHOLDER);
  assert.equal(output.requestBodyPreview, REDACTION_PLACEHOLDER);
  assert.equal(output.responsePreview, REDACTION_PLACEHOLDER);
  assert.equal(output.nested.responseBody, REDACTION_PLACEHOLDER);
  assert.equal(output.nested.safe, "visible");
});

test("redactSensitiveData preserves array shape while redacting camelCase preview keys", () => {
  const output = redactSensitiveData({
    steps: [
      {
        data: {
          requestBodyPreview: "{\"password\":\"nope\"}",
          responseBodyPreview: "{\"token\":\"still-nope\"}",
          safe: "ok",
        },
      },
    ],
  });

  assert.equal(output.steps[0]?.data.requestBodyPreview, REDACTION_PLACEHOLDER);
  assert.equal(output.steps[0]?.data.responseBodyPreview, REDACTION_PLACEHOLDER);
  assert.equal(output.steps[0]?.data.safe, "ok");
});
