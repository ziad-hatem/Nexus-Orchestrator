export const ACTIVE_ORG_COOKIE = "nexusorchestrator_active_org";
export const ACTIVE_ORG_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const FLAT_ROUTE_REDIRECTS = {
  "/dashboard": "",
  "/workflows": "/workflows",
  "/team": "/team",
  "/audit": "/audit",
  "/profile": "/profile",
} as const;
