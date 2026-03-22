import * as Sentry from "@sentry/nextjs";

const sentryDsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment:
    process.env.SENTRY_ENVIRONMENT ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.2,
  enableLogs: true,
});
