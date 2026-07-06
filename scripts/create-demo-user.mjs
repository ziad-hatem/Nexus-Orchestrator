import process from "node:process";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const email = requireEnv("NEXT_PUBLIC_DEMO_EMAIL").toLowerCase();
  const password = requireEnv("NEXT_PUBLIC_DEMO_PASSWORD");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: "Demo",
      last_name: "User",
      company: "Demo Organization",
    },
  });

  if (error && !error.message.toLowerCase().includes("already been registered")) {
    throw new Error(`Failed to create demo user: ${error.message}`);
  }

  console.log(
    error
      ? `Demo user ${email} already exists, nothing to do.`
      : `Demo user ${email} created.`,
  );
  console.log(
    "Sign in as this user once to bootstrap their workspace — the hourly /api/internal/demo/reset cron then keeps wiping it back to empty.",
  );
}

main().catch((error) => {
  console.error("Failed to create demo user.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
