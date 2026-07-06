# Case study extraction — Nexus Orchestrator

## What's solid

- **Identity/timeline**: name, description, and shipped-date window all corroborated by `package.json`, `.env.example` (`PASSKEY_RP_NAME="Nexus Orchestrator"`), and `git log` (26 commits, first 2026-03, last 2026-04).
- **Solo authorship**: `git log --format="%an <%ae>"` shows two author labels ("Ziad Hatem", 25 commits; "ziad-hatem", 1 commit) but the *same* email both times — reported as one person, flagged for the owner's final confirmation only.
- **Stack**: `package.json` dependencies + `postcss.config.mjs` (Tailwind v4 has no `tailwind.config.*`) + `db/*.sql` (raw `pg`, no ORM).
- **Testing**: 54 `*.test.ts` files under `tests/`, run via Node's built-in test runner (`tsx --test`). No `.github/workflows` or any CI config anywhere in the repo — the full suite is local-only.
- **Architecture decisions (A-01…A-05)**: all five are backend/infra choices with no dedicated UI page of their own — verified by reading the exact referenced files (`lib/server/org-service.ts`, `lib/observability/redaction.ts`, `next.config.ts`, `app/hooks/[...path]/route.ts`, `app/api/me/account/route.ts`) line-by-line rather than trusting the earlier summary.
- **Accessibility**: `eslint-plugin-jsx-a11y` confirmed as a transitive dep via `package-lock.json`; 67 `aria-*`/`role=` attributes across 23 `.tsx` files; a dedicated `app/components/a11y/` route-announcer.
- **Performance — re-measured this session against a real production build**, not the earlier dev-server number:
  - Set a genuine `.env` (generated `NEXTAUTH_SECRET`, left Supabase/Sentry/Resend/Upstash blank since the unauthenticated landing page never touches them).
  - `npm run build` → clean production build. `npm run start` on port 3100.
  - `npx lighthouse http://localhost:3100/ --preset=desktop` (full category set) and again for mobile.
  - **Desktop**: performance 98, accessibility 96, best-practices 96, seo 100 — LCP 1.1s, CLS 0, TBT 0ms, FCP 0.3s, Speed Index 0.5s.
  - **Mobile**: performance 79, accessibility 96, best-practices 96, seo 100 — LCP 4.9s, CLS 0.032, TBT 190ms, FCP 1.1s, Speed Index 1.1s.
  - This **replaces** the previous session's dev-mode 65 score (which was measured against `next dev` with a missing `NEXTAUTH_SECRET` causing a background 500). `lighthouseScore` is now `98` (the desktop performance score, per the portfolio's convention). Full breakdown lives in `_performance` in `case-study.json`, raw reports in `lighthouse/`.

## Screenshots — what was captured and how

The landing page (`app/page.tsx`) is public and required no auth, so `hero-desktop.png` (1440×900 viewport, full page, 1440×4950 actual) and `hero-mobile.png` (390×844 viewport, full page, 390×7145 actual) were captured directly against the production server with Playwright (`npx playwright screenshot`, downloaded to a temp cache — not added to `package.json`). A 1.5s `--wait-for-timeout` was needed on the desktop shot because the hero headline uses an entrance animation (`motion` package) that was still mid-transition on the first capture attempt.

**All five `architectureDecisions` thumbnails are code excerpts, not app screenshots.** Every one of A-01 through A-05 is a backend/infrastructure decision (a DB rollback strategy, a Sentry redaction pass, a Sentry tunnel route, a webhook body-size check, an account-deletion guard) with no corresponding browsable page — and the authenticated workspace (`/org/[orgSlug]/...`, where a UI for account deletion or org creation *would* live) isn't reachable without a real Supabase database and a seeded account, which this repo doesn't have. Rather than fake a UI that doesn't exist or skip these five entirely, each thumbnail is a screenshot of the exact literal source lines the decision's `body` text refers to (verified against the live file, line numbers included in the caption), rendered in a plain dark monospace code block and captured via Playwright against a throwaway local static server. This is called out explicitly in each `manifest.json` `alt` string ("Code excerpt from...") so it's never mistaken for a real UI shot.

Actual measured PNG dimensions (not viewport sizes) are in `screenshots/manifest.json` and `case-study.json`'s `_screenshots` — the code-excerpt shots vary in height (719–1570px) because each excerpt is a different number of lines.

## `_needsInput` punch list

| Field | Reason |
|---|---|
| `indexCode` | Depends on ziadhatem.dev's existing case-study sequence — fill by hand. |
| `nextSlug` / `nextLabel` | Depends on which other case study should follow this one. |
| `domain` | No live deployment, custom domain, or CNAME anywhere in the repo. |
| `shippedDate` | Status is `in-development`; used last-commit month (2026-04) as the closest verifiable proxy. |
| `liveCtaLabel` | No live site to link to; defaulted to a source-link label — override if/when one exists. |
| `roleRows`/contributors | Two git author identities share one email — near-certain solo work, but flagged for the owner to confirm. |

## Skipped, and why

- No `clientRegister` or `demoCredentials` — this is a personal/solo project with no client and no seeded demo login in the repo.
- No `technicalDecisions`/`stackList` overlap issues — used the flagship-style field group (`stackList`, `architectureDecisions`, `testing`, `retrospective`) since this is a deep solo build, not a client delivery.
- Authenticated workspace screens (workflows, team, audit log, operations dashboard, account settings) were **not** screenshotted — they require a live Supabase project and a logged-in session that don't exist in this checkout. No private/seeded data was available to substitute, so per the extraction rules these were skipped rather than faked.

## Housekeeping

A stray `case-study.extracted.json` was already sitting at the repo root from an earlier, interrupted pass (JSON content only — no folder, no screenshots, no lighthouse reports, no `_performance`/`_screenshots`). Its content has been carried forward, corrected (see Lighthouse note above), and completed into `nexus-orchestrator/case-study.json`; the loose root-level file has been removed since everything now lives in this one folder. A local `.env` was added to the repo root to make the production build/measurement possible (`NEXTAUTH_SECRET` generated locally, everything else left blank) — this is a real, gitignored `.env`, not a committed secret.

**Unrelated in-progress work found in the working tree, left untouched**: `git status` shows uncommitted changes this extraction did not make — a demo-account feature (`app/api/internal/demo/reset/route.ts`, `scripts/create-demo-user.mjs`, `tests/security/demo-reset.test.ts`, a "Use demo credentials" button added to the login page, an hourly reset cron in `vercel.json`, and `NEXT_PUBLIC_DEMO_EMAIL`/`NEXT_PUBLIC_DEMO_PASSWORD` added to `.env.example`). It's real, well-built code (bearer-token-authenticated reset endpoint, deletion scoped only to orgs where the demo user is the sole member) — likely started specifically to enable a seeded demo login for authenticated screenshots, per this extraction's own rule 5. It needs a live Supabase project to actually create the demo user, which isn't available in this sandbox, so it was left as-is rather than finished or reverted. Because of it, `find tests -name "*.test.ts"` currently returns **55**, not 54 — `testing.unitTestCount` was kept at **54** to match the committed/shipped state that the rest of this case study (git log, commit count, shipped-date window) is anchored to, since the 55th file is uncommitted and unrelated to this extraction. Worth a fresh recount once that work is committed.

One more side effect worth flagging: `public/robots.txt` and `public/sitemap.xml` are tracked files, and this session's `npm run build` regenerated both via the `postbuild` next-sitemap script — since the build used `PORT=3100`/`NEXT_PUBLIC_APP_URL=http://localhost:3100` (to avoid the port-3000 process already running on this machine), both files now say `localhost:3100` instead of the committed `localhost:3000`. Harmless for this measurement, but worth reverting (`git checkout -- public/robots.txt public/sitemap.xml`) before committing anything else, since a permission guard blocked me from doing that revert myself.
