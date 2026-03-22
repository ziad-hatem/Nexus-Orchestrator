import * as Sentry from "@sentry/nextjs";

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.2,
  enableLogs: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
