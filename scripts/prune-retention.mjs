import process from "node:process";
import nextEnv from "@next/env";
import pg from "pg";

const { Client } = pg;
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

function getOptionalEnv(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function getDatabaseUrl() {
  const candidates = [
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.DATABASE_URL,
  ];

  const value = candidates.find(
    (candidate) => typeof candidate === "string" && candidate.trim(),
  );
  if (!value) {
    throw new Error(
      "Missing database connection string. Set POSTGRES_URL_NON_POOLING, POSTGRES_PRISMA_URL, POSTGRES_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL.",
    );
  }

  return value.trim().replace("sslmode=require", "sslmode=no-verify");
}

function buildClient(connectionString) {
  const isLocalhost =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");

  return new Client({
    connectionString,
    ssl: isLocalhost
      ? false
      : {
          rejectUnauthorized: false,
        },
  });
}

function getRetentionPolicy() {
  return {
    auditLogDays: parsePositiveInteger(getOptionalEnv("AUDIT_LOG_RETENTION_DAYS"), 365),
    executionLogDays: parsePositiveInteger(
      getOptionalEnv("EXECUTION_LOG_RETENTION_DAYS"),
      90,
    ),
    ingestionEventDays: parsePositiveInteger(
      getOptionalEnv("INGESTION_EVENT_RETENTION_DAYS"),
      30,
    ),
  };
}

async function countRows(client, table, cutoff) {
  const { rows } = await client.query(
    `select count(*)::int as count from public.${table} where created_at < $1`,
    [cutoff],
  );
  return rows[0]?.count ?? 0;
}

async function listAffectedOrganizations(client, cutoffs) {
  const { rows } = await client.query(
    `
      select distinct organization_id
      from (
        select organization_id from public.audit_logs where created_at < $1
        union all
        select organization_id from public.workflow_run_steps where created_at < $2
        union all
        select organization_id from public.workflow_ingestion_events where created_at < $3
      ) as affected
      where organization_id is not null
    `,
    [cutoffs.audit, cutoffs.execution, cutoffs.ingestion],
  );

  return rows.map((row) => row.organization_id).filter(Boolean);
}

async function writeRetentionAuditEntries(client, organizationIds, metadata) {
  if (organizationIds.length === 0) {
    return;
  }

  for (const organizationId of organizationIds) {
    await client.query(
      `
        insert into public.audit_logs (
          organization_id,
          actor_user_id,
          action,
          entity_type,
          entity_id,
          metadata
        )
        values ($1, null, 'system.retention_pruned', 'system', 'retention', $2::jsonb)
      `,
      [organizationId, JSON.stringify(metadata)],
    );
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const retention = getRetentionPolicy();
  const connectionString = getDatabaseUrl();
  const client = buildClient(connectionString);
  const now = new Date();
  const cutoffs = {
    audit: new Date(now.getTime() - retention.auditLogDays * 24 * 60 * 60 * 1000),
    execution: new Date(now.getTime() - retention.executionLogDays * 24 * 60 * 60 * 1000),
    ingestion: new Date(now.getTime() - retention.ingestionEventDays * 24 * 60 * 60 * 1000),
  };
  const scrubMarker = {
    retained: false,
    reason: "retention_policy",
    scrubbedAt: now.toISOString(),
  };

  console.log(`Connecting to database${dryRun ? " for dry run" : ""}...`);
  await client.connect();

  try {
    const [auditLogCount, executionLogCount, ingestionEventCount] = await Promise.all([
      countRows(client, "audit_logs", cutoffs.audit.toISOString()),
      countRows(client, "workflow_run_steps", cutoffs.execution.toISOString()),
      countRows(client, "workflow_ingestion_events", cutoffs.ingestion.toISOString()),
    ]);

    const summary = {
      dryRun,
      generatedAt: now.toISOString(),
      retention,
      affectedRows: {
        auditLogs: auditLogCount,
        executionSteps: executionLogCount,
        ingestionEvents: ingestionEventCount,
      },
    };

    console.log(JSON.stringify(summary, null, 2));

    if (dryRun) {
      return;
    }

    await client.query("begin");

    const affectedOrganizations = await listAffectedOrganizations(client, {
      audit: cutoffs.audit.toISOString(),
      execution: cutoffs.execution.toISOString(),
      ingestion: cutoffs.ingestion.toISOString(),
    });

    await client.query(
      "delete from public.audit_logs where created_at < $1",
      [cutoffs.audit.toISOString()],
    );

    await client.query(
      `
        update public.workflow_run_steps
        set
          input_payload = $2::jsonb,
          output_payload = $2::jsonb,
          logs = jsonb_build_array($2::jsonb),
          updated_at = now()
        where created_at < $1
      `,
      [cutoffs.execution.toISOString(), JSON.stringify(scrubMarker)],
    );

    await client.query(
      `
        update public.workflow_ingestion_events
        set
          payload = $2::jsonb,
          source_context = $2::jsonb
        where created_at < $1
      `,
      [cutoffs.ingestion.toISOString(), JSON.stringify(scrubMarker)],
    );

    await writeRetentionAuditEntries(client, affectedOrganizations, {
      ...summary,
      dryRun: false,
      scrubMarker,
    });

    await client.query("commit");
    console.log("Retention pruning completed successfully.");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Retention pruning failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
