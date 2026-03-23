import type { ServerOptions } from "next-passkey-webauthn/types";
import { SupabaseAdapter } from "next-passkey-webauthn/adapters";
import { SupabaseStore } from "next-passkey-webauthn/store";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function getBaseUrl(): string {
  const value =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : undefined) ??
    "http://localhost:3000";
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getExpectedOrigin(req?: Request): string | string[] {
  if (process.env.PASSKEY_EXPECTED_ORIGIN) {
    return process.env.PASSKEY_EXPECTED_ORIGIN;
  }
  if (req) {
    const origin = req.headers.get("origin");
    if (origin) return origin;
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host) {
      return host.includes("localhost") ? `http://${host}` : `https://${host}`;
    }
  }
  return getBaseUrl();
}

function getRpId(expectedOrigin: string | string[]): string {
  if (process.env.PASSKEY_RP_ID) {
    return process.env.PASSKEY_RP_ID;
  }

  const origin = Array.isArray(expectedOrigin)
    ? expectedOrigin[0]
    : expectedOrigin;
  try {
    return new URL(origin).hostname;
  } catch {
    return "localhost";
  }
}

export function createPasskeyServerOptions(req?: Request): ServerOptions {
  const supabase = createSupabaseAdminClient();
  const expectedOrigin = getExpectedOrigin(req);

  return {
    adapter: new SupabaseAdapter(supabase, "passkeys"),
    store: new SupabaseStore(supabase, "passkey_challenges"),
    rpConfig: {
      rpID: getRpId(expectedOrigin),
      rpName: process.env.PASSKEY_RP_NAME ?? "nexusorchestrator",
      expectedOrigin,
    },
  };
}
