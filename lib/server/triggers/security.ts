import { getOptionalEnv } from "@/lib/env";
export {
  createWebhookSecret,
  hashWebhookSecret,
  isValidWebhookSecretShape,
  verifyWebhookApiKey,
  verifyWebhookSecretHash,
} from "@/lib/server/triggers/security-core";
const DEFAULT_WEBHOOK_MAX_BODY_BYTES = 262144;

export function getWebhookMaxBodyBytes(): number {
  const configured = Number(getOptionalEnv("WEBHOOK_MAX_BODY_BYTES"));
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_WEBHOOK_MAX_BODY_BYTES;
  }

  return Math.floor(configured);
}
