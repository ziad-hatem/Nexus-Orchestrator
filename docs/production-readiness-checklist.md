# Production Readiness Checklist

## Environment
- Set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`.
- Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- Set `WEBHOOK_MAX_BODY_BYTES` and verify the public webhook route rejects oversized payloads.
- Confirm `INTERNAL_EVENTS_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` are configured where those features are enabled.

## Database
- Run `npm run db:apply-auth-schema`.
- Verify phase three through phase eight tables and indexes exist in staging.
- Confirm `workflow_trigger_bindings.secret_rotated_at` and `secret_last_used_at` are populated for active webhook bindings.

## Worker And Queue
- Start the worker with `npm run worker:start`.
- Verify `/org/[orgSlug]/operations` shows queue backlog metrics and no stale running runs.
- Confirm retry backlog and delayed queue counts change as expected during retry scenarios.

## Audit Coverage
- Confirm privileged actions create audit entries:
  - workflow create, draft update, publish, archive
  - webhook/API-key rotation
  - manual retry
  - run cancel
  - invite/member/admin changes
  - retention cleanup
- Check audit metadata is tenant-scoped and does not expose secrets.

## Webhook Security
- Verify API keys are only returned on initial creation or rotation.
- Confirm webhook request logs, audit metadata, step logs, and Sentry events redact API keys, tokens, passwords, cookies, and authorization headers.
- Trigger invalid API-key and malformed/oversized request scenarios and confirm they fail cleanly.

## Retention
- Dry-run cleanup with `npm run retention:prune:dry-run`.
- Schedule `npm run retention:prune` on the production cadence.
- Confirm the retention policy matches:
  - audit logs: 365 days
  - execution logs: 90 days
  - ingestion payload history: 30 days

## Alert Fire-Drill
- Force a queue backlog above threshold and confirm a Sentry alert event is captured.
- Force webhook rejection spikes and confirm a Sentry alert event is captured.
- Force retry exhaustion and confirm a Sentry alert event is captured.
- Record the alert links and responders for the pilot runbook.

## Verification
- Run `npm run lint`.
- Run `npx tsc --noEmit`.
- Run `npm run build`.
- Run `npm run test:security`.
- Run `npm run test:operations`.
