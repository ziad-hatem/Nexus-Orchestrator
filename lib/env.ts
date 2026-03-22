function normalizeEnvValue(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unwrapped = trimmed.slice(1, -1).trim();
    return unwrapped || null;
  }

  return trimmed;
}

export function getOptionalEnv(name: string): string | null {
  return normalizeEnvValue(process.env[name]);
}

export function getRequiredEnv(name: string): string {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getFirstAvailableEnv(names: string[]): string {
  for (const name of names) {
    const value = getOptionalEnv(name);
    if (value) {
      return value;
    }
  }

  throw new Error(
    `Missing required environment variable: ${names.join(" or ")}`,
  );
}

function getPublicSupabaseUrlEnv(): string | null {
  return normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function getServerSupabaseUrlEnv(): string | null {
  return normalizeEnvValue(process.env.SUPABASE_URL);
}

function getPublicSupabaseAnonKeyEnv(): string | null {
  return normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getServerSupabaseAnonKeyEnv(): string | null {
  return normalizeEnvValue(process.env.SUPABASE_ANON_KEY);
}

export function getSupabaseUrl(): string {
  const publicValue = getPublicSupabaseUrlEnv();
  if (publicValue) {
    return publicValue;
  }

  if (typeof window === "undefined") {
    const serverValue = getServerSupabaseUrlEnv();
    if (serverValue) {
      return serverValue;
    }
  }

  throw new Error(
    `Missing required environment variable: ${
      typeof window === "undefined"
        ? "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL"
        : "NEXT_PUBLIC_SUPABASE_URL"
    }`,
  );
}

export function getSupabaseAnonKey(): string {
  const publicValue = getPublicSupabaseAnonKeyEnv();
  if (publicValue) {
    return publicValue;
  }

  if (typeof window === "undefined") {
    const serverValue = getServerSupabaseAnonKeyEnv();
    if (serverValue) {
      return serverValue;
    }
  }

  throw new Error(
    `Missing required environment variable: ${
      typeof window === "undefined"
        ? "NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY"
        : "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    }`,
  );
}

export function getSupabaseServiceRoleKey(): string {
  return getFirstAvailableEnv([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
  ]);
}
