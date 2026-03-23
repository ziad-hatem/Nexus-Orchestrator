import * as Sentry from "@sentry/nextjs";
import { redactSentryEventLike } from "./lib/observability/redaction";

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.2,
  enableLogs: true,
  beforeSend(event) {
    return redactSentryEventLike(event);
  },
  beforeBreadcrumb(breadcrumb) {
    return redactSentryEventLike(breadcrumb);
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
