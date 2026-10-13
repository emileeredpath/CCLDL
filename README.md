# CCLDL — Chelmsford City Ladies Darts League

Phase 1: private committee application foundation. Next.js 16, TypeScript, Tailwind 4, Supabase, installable PWA. No deployment or paid service has been provisioned.

## Local development

Node.js 22 or 24 and npm are required.

```sh
npm ci --cache /workspace/.npm-cache
cp .env.example .env.local
npm run dev
```

Without Supabase configuration the app shows a locked setup/sign-in screen. To explore the **fictional, read-only demo**, set `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local` and restart. Demo records live only in `src/lib/demo.ts`; they are never inserted into Supabase. Keep demo mode false for real use. Variables prefixed `NEXT_PUBLIC_` are embedded at build time: rebuild when they change.

```sh
npm run typecheck
npm test
npm run build
npm start
```

Use the existing checkout in each isolated cloud task; no Git worktree is needed.

## Supabase setup (requires your chosen project)

Use an existing project or approve creating one first. Do not paste credentials in chat or commit `.env.local`.

1. Apply `supabase/migrations/202610130001_initial.sql` through the Supabase CLI (`supabase db push` after linking) or SQL editor. It creates only the confirmed 2026/27 season, **no teams, players, results or user accounts**. Review actual season dates before use; the initial season record uses September–August boundaries, which can be adjusted by the committee.
2. In Authentication settings, **disable Allow new users to sign up** and anonymous sign-ins. Password sign-in is supported; no registration form exists. Configure strong passwords and MFA for the committee in Supabase where available. MFA enforcement in the app is a later task.
3. Create one shared committee user securely in the dashboard. Insert its user ID into `public.committee_members` using SQL editor. Membership cannot be granted or altered by browser clients:

```sql
insert into public.committee_members(user_id, role) values
 ('COMMITTEE-AUTH-UUID', 'administrator');
```

4. Put the project URL and **anon/publishable public key** in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never put a service-role key in the browser, source or public variables. Only the public key is used by the application; RLS enforces membership.
5. Start the app, log in with the shared committee account, and add real teams/players and fixtures via Fixtures → Season administration. Upload an image, enter every game/player, review, approve, edit, and verify the tables, stats, archive and audit history. Check a signed-out request and an authenticated nonmember are denied.

Real backend flows require this integration acceptance check before claiming production readiness. Upload files: JPEG, PNG or WebP ≤10 MB. Convert iPhone HEIC files if necessary. Images are immutable in a private bucket; each new upload gets a unique path. Short-lived viewing links expire after 60 seconds. Never share those links outside the committee. A failed metadata insert after upload can leave a private orphan; recovery tooling is planned.

## Implemented foundation

- Phone-first dashboard and Home / Fixtures / Add Result / Stats / More bottom navigation, plus desktop sidebar.
- Password login and fail-closed configuration screen; committee membership checks and PostgreSQL RLS on all public tables.
- Teams, players, seasons and fixture creation. One shared committee account has management permissions. Edit history identifies that account, not the individual using it.
- League 3 pairs, 2 trebles, 1 captains & vice, 6 singles; Cup 12 singles.
- Original-photo upload, manual player-level statistics, review and transactional approval/replacement via `save_result`; corrections are audited and originals retained. **No OCR or automatic scanning.**
- Approved-result tables, season and competition separation, player-stat aggregates, Excel-compatible CSV downloads.
- Archive filters for season, team, match date and competition, short-lived original viewing and fixture/result history.
- Weekly PNG export, date cutoff and missing-result flag.
- Manifest, 192/512 PNG icons, safe service worker with an offline message. Authenticated records and photos are never cached.

League points equal games won. Tables remain **alphabetical, not ranked** until ranking/tie-break rules are confirmed. Cup shows match/game totals, no invented points. Statistics remain scoped to the selected competition. Zero is displayed as zero, not a fabricated achievement.

## Phase 2 / limitations

- Test against the real Supabase project, including RLS, storage and transaction behavior; add automated backend and browser tests before live use.
- Fixture editing/deletion UI, player transfers and season-specific rosters, invitation/password recovery flows, photo recovery tooling, richer actor-labelled audit views and accessible UI polish.
- Confirm League ranking/tie-break rules, Cup points/ranking and whether weekly player statistics should combine competitions.
- Historical PNGs currently use corrected records as of the selected match-date cutoff. They **do not** recreate what was known or published at that time. Immutable publication snapshots and historical revision reconstruction remain to be built.
- OCR/scanning, native device install checks, automated backup scheduling and restore drills remain to be implemented/tested.
- CSV exports can be opened in Excel; native `.xlsx` exports are not yet implemented.

## PWA

Production requires HTTPS. iPhone Safari: Share → Add to Home Screen. Android Chrome: Install app / Add to Home screen. The icon label is CCLDL; the dashboard uses the full league name. No offline access to private records. Phone-specific installation has not yet been tested. The install manifest does not make this a native App Store app.

## Backup and recovery

Use Supabase's supported backup/export features for your selected plan; do not assume automatic backups or PITR are enabled. See `supabase/BACKUPS.md`. SQL migrations are versioned here. Database dumps **do not include storage photo contents**. Back up originals separately and protect exports as private league data.

## Validation performed in this cloud workspace

- Production build, TypeScript check and 3 standings/game-format tests passed.
- 3 Chromium browser tests passed: locked production screen; 390px mobile navigation with no page overflow, manual-entry notice and a real PNG download; desktop dashboard and PWA assets.
- PostgreSQL 17 migration and SQL acceptance assertions passed using local auth/storage schema stubs: nonmember read/write denial, complete result approval, correction audit history and retention of originals. This validates SQL behavior, **not** Supabase auth/storage integration.
- Dependency audit reported zero vulnerabilities after upgrading to Next.js 16.4.

Run browser checks after `npm run build`, with Supabase variables unset and demo mode disabled for the normal build:

```sh
npm run test:browser
```

The tests build a separate fictional demo in `.next-demo`; neither build inserts database records. Chromium must be installed; set `CHROMIUM_PATH` if its location differs from `/usr/bin/chromium`.

To reproduce SQL checks, run an isolated disposable PostgreSQL 17 instance, then apply `tests/sql/bootstrap.sql`, the migration, and `tests/sql/rls-and-results.sql` in order with `psql -v ON_ERROR_STOP=1`. These files must **never** be applied to your live Supabase project: they contain test identities and fictional records.

In this cloud browser, Next.js development-mode hydration was blocked by failed HMR WebSocket handshakes (both Turbopack and webpack). Production-mode browser flows passed. Use `npm run build && npm start` to review the app here; ordinary local development uses `npm run dev`. Cloud hot reload remains unverified.
