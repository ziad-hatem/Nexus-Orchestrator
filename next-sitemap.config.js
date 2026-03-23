/** @type {import('next-sitemap').IConfig} */
const siteUrl = (
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

const privatePathPatterns = [
  "/api/*",
  "/auth/*",
  "/forgot-password",
  "/hooks/*",
  "/invite/*",
  "/login",
  "/org",
  "/org/*",
  "/org/select",
  "/register",
  "/reset-password",
  "/sentry-example-page",
  "/verify",
];

module.exports = {
  siteUrl,
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  sitemapSize: 7000,
  changefreq: "weekly",
  priority: 0.7,
  exclude: privatePathPatterns,
  additionalPaths: async () => [
    {
      loc: "/",
      changefreq: "daily",
      priority: 1,
      lastmod: new Date().toISOString(),
    },
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
      },
      {
        userAgent: "*",
        disallow: [
          "/api",
          "/auth",
          "/forgot-password",
          "/hooks",
          "/invite",
          "/login",
          "/org",
          "/register",
          "/reset-password",
          "/verify",
        ],
      },
    ],
  },
  transform: async (config, path) => ({
    loc: path,
    changefreq: path === "/" ? "daily" : config.changefreq,
    priority: path === "/" ? 1 : config.priority,
    lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
    alternateRefs: config.alternateRefs ?? [],
  }),
};
