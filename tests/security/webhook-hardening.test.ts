import assert from "node:assert/strict";
import test from "node:test";
import {
  createWebhookSecret,
  isValidWebhookSecretShape,
  verifyWebhookApiKey,
} from "@/lib/server/triggers/security-core";

test("createWebhookSecret returns a prefixed secret and usable verification hash", () => {
  const secret = createWebhookSecret();

  assert.equal(isValidWebhookSecretShape(secret.plainText), true);
  assert.equal(secret.lastFour.length, 4);
  assert.notEqual(secret.hashed, secret.plainText);

  const verification = verifyWebhookApiKey({
    apiKeyHeader: secret.plainText,
    secretHash: secret.hashed,
  });

  assert.deepEqual(verification, { ok: true, reason: "verified" });
});

test("verifyWebhookApiKey rejects malformed and invalid keys without exposing the secret", () => {
  const secret = createWebhookSecret();

  assert.deepEqual(
    verifyWebhookApiKey({
      apiKeyHeader: "short",
      secretHash: secret.hashed,
    }),
    { ok: false, reason: "invalid_api_key_shape" },
  );

  assert.deepEqual(
    verifyWebhookApiKey({
      apiKeyHeader: `${secret.plainText}_wrong`,
      secretHash: secret.hashed,
    }),
    { ok: false, reason: "invalid_api_key" },
  );
});
