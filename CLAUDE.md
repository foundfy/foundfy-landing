# Foundfy — guide for Claude Code

Foundfy is an automated SEO agency experience for small business owners. Product loop:
UNDERSTAND → RESEARCH → OBSERVE → DECIDE → CREATE / ACT → VERIFY → LEARN.
This is a live production app at www.foundfy.me. It is not a greenfield project. The repository is **public**.

## Communication
- Talk to the product owner in **Spanish**. Code, identifiers, commits, PRs and technical docs are in English.
- Give clear GO / NO-GO calls. Keep these kinds of evidence separate:
  - source inspection
  - test evidence
  - Preview deployment
  - Production deployment
  - owner-session testing
  - live Google verification
- Never present a capability as autonomous unless it is implemented and operational. Keep these states separate: Recommended, Approved, Executed by Foundfy, Implemented externally, Verified, Not verified.

## Working agreements
- Work is gated. Do only what the current GO authorizes, then stop and report.
- These all need explicit approval:
  - merging or deploying
  - running SQL or migrations in Production
  - changing environment variables
  - touching credentials or OAuth
  - running real Google disconnects
- Investigate read-only first. Before you call an endpoint as a "read" or smoke test, check its side effects: some reads create or update records.
- Keep PRs small and bounded. No speculative architecture, no unrelated refactors, no features that are only technically interesting. If a blocker needs more scope, stop and explain it.
- Never print secrets. Because the repo is public, keep these out of commits, PR text, comments and this file:
  - project refs and internal IDs
  - deployment identifiers
  - customer or prospect names
  - prices
  - security findings
- Never modify unrelated websites, owner records, tokens or environment variables.

## Stack and commands
- Next.js 15 (App Router), React 19, TypeScript, Vitest.
- Supabase Postgres 17, accessed only server-side through `src/lib/db/supabase-admin.ts`. Never expose privileged database access to the browser.
- Hosting: Vercel. `main` auto-deploys to Production.
- `npm test` runs the full Vitest suite. `npm run build` is the production build.
- TypeScript: `npx tsc --noEmit` has known pre-existing errors. Compare its output with the same command on `main`. Any error that is new, anywhere, is a blocker, not noise. Do not add to the existing debt.
- `npm run <script>` tasks run with `tsx --env-file=.env.local`. Treat the configured database as Production: do not run scripts that write data without explicit approval.
- Disposable Postgres gates (Docker, synthetic data, migrations 001→latest):
  - `node scripts/observe-pg-gate.mjs`
  - `node scripts/research-027-pg-gate.mjs`
  - `node scripts/google-cleanup-pg-gate.mjs`

  Add a gate when database behavior matters.
- VERIFY regression check: `npm run regression:check -- spec.json`. It needs an explicit website, baseline crawl, verification crawl, URLs and expected changes. It never auto-selects the latest two crawls.

## Database migrations
- `supabase/migrations/NNN_*.sql` are authoritative.
- Production has no migration ledger: migrations are applied manually, only with explicit approval.
- Production apply procedure:
  1. Verify the file's SHA-256.
  2. Check read-only preconditions.
  3. Run one atomic batch: `set local lock_timeout = '5s';` followed by the exact file content.
  4. Run read-only verification: schema, data fingerprints, API visibility.
  5. Keep the evidence in a private record, not in public PRs.
- Apply a migration **before** deploying code that depends on it. A green build does not mean the migration is applied.
- Never apply part of a migration.
- RPC functions follow this pattern: `security definer`, `set search_path = public`, revoke from `public`/`anon`/`authenticated`, and `grant execute` to `service_role`.

## Domain invariants
- **Website isolation.** Every owner query and every delete is scoped by `website_id`. Owner endpoints require an owner session.
- **Owner session ≠ Google identity credential.** One Google credential can serve several websites, so changes at the identity level affect all of them. Do not casually reconnect, revoke, replace tokens or broaden OAuth scopes. A valid-looking token does not prove that a refresh or GSC call will succeed.
- **Google indexing checks.** Read-only URL Inspection, triggered by the owner, behind a server-side allowlist. Never broaden it, never auto-run it, and never request indexing.
- **Paid research (DataForSEO)** stays restricted. Changing who is eligible needs an explicit cost and abuse-control decision. Keep owner auth, feature flags, reuse rules, per-run limits, locking and provenance.
- **VERIFY.** NOT COLLECTED (`NULL`) is never ABSENT. PASS needs reliable evidence for every requested URL and every expected change. A resolved finding is not proof of a safe implementation.
- **Owner-applied changes** are reported as owner-published, never as Foundfy-published.
- **Google disconnect / property-change cleanup** must:
  - delete only that website's Google-derived data;
  - keep historical ACT records and RESEARCH;
  - respect foreign-key dependency order;
  - propagate errors, never reporting a partial cleanup as success;
  - be safe to retry.
- The foundfy.me-specific ACT adapter must never run against another website.

## Environments
- Preview deployments must never access Production services: database, email, Google or paid APIs.
  - Never configure Production credentials for the Preview environment.
  - Never point a Preview at Production data.
  - Never run crawls from a Preview.
- Production verification after a deploy:
  1. The deployment is READY and current.
  2. The build served on www matches the deployment.
  3. Smoke test: home, overview, owner endpoints refuse requests without a session.
  4. Runtime and database logs are clean.

## Release practice
1. Confirm the baseline (`main` HEAD and tree).
2. Inspect existing patterns.
3. Propose the smallest change.
4. Implement only what is authorized.
5. Run focused tests, then the full suite, then the build, then the TypeScript comparison against `main`, then a Postgres gate if the change touches the DB.
6. Open one focused PR and report its HEAD and tree.
7. Wait for authorization, then merge with a merge commit pinned to the approved head (`gh pr merge --merge --match-head-commit <sha>`).
8. Verify Production separately.

## Current priority: commercial validation
Validation comes before new infrastructure. The milestone:
- **Three** real businesses with **published and verified** SEO improvements.
- **At least one paying pilot.**
- ACT is **manual** during these pilots: Foundfy proposes, the owner approves, and implementation is coordinated by hand.
- For every intervention, record time spent, access needed, implementation steps, blockers and repeated operations.
- **No new CMS adapter** (and no ACT slice 2) until the third intervention has been reviewed. Choose any adapter from that evidence.

Also deferred unless there is an explicit decision:
- DECIDE v2
- LEARN v1
- GA4 business attribution
- large-scale CREATE automation
- dashboard expansion
