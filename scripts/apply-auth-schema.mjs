import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import nextEnv from "@next/env";
import pg from "pg";

const { Client } = pg;
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const schemaFiles = [
  "db/topbar-schema.sql",
  "db/team-schema.sql",
  "db/phase-one-rbac-schema.sql",
  "db/mfa-email-schema.sql",
  "db/passkeys-schema.sql",
];

function getDatabaseUrl() {
  const candidates = [
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.DATABASE_URL,
  ];

  const value = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  if (!value) {
    throw new Error(
      "Missing database connection string. Set POSTGRES_URL_NON_POOLING, POSTGRES_PRISMA_URL, POSTGRES_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL.",
    );
  }

  return value
    .trim()
    .replace("sslmode=require", "sslmode=no-verify");
}

function buildClient(connectionString) {
  const isLocalhost =
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

  return new Client({
    connectionString,
    ssl: isLocalhost
      ? false
      : {
          rejectUnauthorized: false,
        },
  });
}

async function main() {
  const connectionString = getDatabaseUrl();
  const client = buildClient(connectionString);

  console.log("Connecting to database...");
  await client.connect();

  try {
    for (const relativeFile of schemaFiles) {
      const absoluteFile = path.join(process.cwd(), relativeFile);
      const sql = await readFile(absoluteFile, "utf8");
      console.log(`Applying ${relativeFile}...`);
      await client.query(sql);
    }

    console.log("Auth schema applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to apply auth schema.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
