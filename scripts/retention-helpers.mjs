/**
 * @typedef {{
 *   auditLogDays: number;
 *   executionLogDays: number;
 *   ingestionEventDays: number;
 * }} RetentionPolicy
 */

/**
 * @param {Record<string, string | undefined>} source
 * @param {string} name
 */
export function getOptionalEnvValue(source, name) {
  const value = source[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * @param {string | null | undefined} value
 * @param {number} fallback
 */
export function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

/**
 * @param {Record<string, string | undefined>} [source=process.env]
 * @returns {RetentionPolicy}
 */
export function getRetentionPolicyFromEnv(source = process.env) {
  return {
    auditLogDays: parsePositiveInteger(
      getOptionalEnvValue(source, "AUDIT_LOG_RETENTION_DAYS"),
      365,
    ),
    executionLogDays: parsePositiveInteger(
      getOptionalEnvValue(source, "EXECUTION_LOG_RETENTION_DAYS"),
      90,
    ),
    ingestionEventDays: parsePositiveInteger(
      getOptionalEnvValue(source, "INGESTION_EVENT_RETENTION_DAYS"),
      30,
    ),
  };
}

/**
 * @param {Date} now
 * @param {RetentionPolicy} retention
 */
export function buildRetentionCutoffs(now, retention) {
  return {
    audit: new Date(now.getTime() - retention.auditLogDays * 24 * 60 * 60 * 1000),
    execution: new Date(
      now.getTime() - retention.executionLogDays * 24 * 60 * 60 * 1000,
    ),
    ingestion: new Date(
      now.getTime() - retention.ingestionEventDays * 24 * 60 * 60 * 1000,
    ),
  };
}

/**
 * @param {Date} now
 */
export function buildRetentionScrubMarker(now) {
  return {
    retained: false,
    reason: "retention_policy",
    scrubbedAt: now.toISOString(),
  };
}
