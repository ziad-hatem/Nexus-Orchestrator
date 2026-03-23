import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type {
  WebhookApiKeyVerificationResult,
  WebhookSecretMaterial,
} from "@/lib/server/triggers/types";

export const WEBHOOK_SECRET_PREFIX = "nwhsec_";

export function hashWebhookSecret(secret: string): string {
  return createHmac("sha256", "nexus-workflow-webhooks")
    .update(secret)
    .digest("hex");
}

export function createWebhookSecret(): WebhookSecretMaterial {
  const plainText = `${WEBHOOK_SECRET_PREFIX}${randomBytes(24).toString("hex")}`;
  return {
    plainText,
    hashed: hashWebhookSecret(plainText),
    lastFour: plainText.slice(-4),
  };
}

export function isValidWebhookSecretShape(value: string): boolean {
  return (
    value.startsWith(WEBHOOK_SECRET_PREFIX) &&
    value.length >= WEBHOOK_SECRET_PREFIX.length + 24
  );
}

export function verifyWebhookSecretHash(
  plainText: string,
  secretHash: string | null,
): boolean {
  if (!secretHash || !isValidWebhookSecretShape(plainText)) {
    return false;
  }

  const candidate = Buffer.from(hashWebhookSecret(plainText), "utf8");
  const expected = Buffer.from(secretHash, "utf8");
  if (candidate.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(candidate, expected);
}

export function verifyWebhookApiKey(params: {
  apiKeyHeader: string | null;
  secretHash: string | null;
}): WebhookApiKeyVerificationResult {
  if (!params.apiKeyHeader) {
    return {
      ok: false,
      reason: "missing_api_key",
    };
  }

  const candidate = params.apiKeyHeader.trim();
  if (!isValidWebhookSecretShape(candidate)) {
    return {
      ok: false,
      reason: "invalid_api_key_shape",
    };
  }

  const matches = verifyWebhookSecretHash(candidate, params.secretHash);

  return {
    ok: matches,
    reason: matches ? "verified" : "invalid_api_key",
  };
}
