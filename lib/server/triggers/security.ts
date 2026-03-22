import "server-only";

import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type {
  WebhookApiKeyVerificationResult,
  WebhookSecretMaterial,
} from "@/lib/server/triggers/types";

export function hashWebhookSecret(secret: string): string {
  return createHmac("sha256", "nexus-workflow-webhooks")
    .update(secret)
    .digest("hex");
}

export function createWebhookSecret(): WebhookSecretMaterial {
  const plainText = `nwhsec_${randomBytes(24).toString("hex")}`;
  return {
    plainText,
    hashed: hashWebhookSecret(plainText),
    lastFour: plainText.slice(-4),
  };
}

export function verifyWebhookSecretHash(
  plainText: string,
  secretHash: string | null,
): boolean {
  if (!secretHash) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(hashWebhookSecret(plainText), "utf8"),
    Buffer.from(secretHash, "utf8"),
  );
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

  const matches = verifyWebhookSecretHash(
    params.apiKeyHeader.trim(),
    params.secretHash,
  );

  return {
    ok: matches,
    reason: matches ? "verified" : "invalid_api_key",
  };
}
