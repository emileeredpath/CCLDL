# CCLDL — Chelmsford City Ladies Darts League

Phase 1: private committee application foundation. Next.js 16, TypeScript, Tailwind 4, Supabase, installable PWA. Railway hosts the app; Supabase holds private league records.

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

1. For a new database, apply both files in `supabase/migrations/` in order. For an existing installation, apply only `202610130002_summary_results.sql`. The initial migration `supabase/migrations/202610130001_initial.sql` is run once through the Supabase CLI (`supabase db push` after linking) or SQL editor. It creates only the confirmed 2026/27 season, **no teams, players, results or user accounts**. Review actual season dates before use; the initial season record uses September–August boundaries, which can be adjusted by the committee.
2. In Authentication settings, **disable Allow new users to sign up** and anonymous sign-ins. Password sign-in is supported; no registration form exists. Configure strong passwords and MFA for the committee in Supabase where available. MFA enforcement in the app is a later task.
3. Create one shared committee user securely in the dashboard. Insert its user ID into `public.committee_members` using SQL editor. Membership cannot be granted or altered by browser clients:

```sql
insert into public.committee_members(user_id, role) values
 ('COMMITTEE-AUTH-UUID', 'administrator');
```

4. Put the project URL and **anon/publishable public key** in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never put a service-role key in the browser, source or public variables. Only the public key is used by the application; RLS enforces membership.
5. Start the app, log in with the shared committee account, and add real teams/players and fixtures via More → Teams & players. Upload an image, enter category totals and optional player achievements, review, approve, edit, and verify Tables, Results and the audit history. Check a signed-out request and an authenticated nonmember are denied.

Real backend flows require this integration acceptance check before claiming production readiness. Upload files: JPEG, PNG or WebP ≤10 MB. Convert iPhone HEIC files if necessary. Images are immutable in a private bucket; each new upload gets a unique path. Short-lived viewing links expire after 60 seconds. Never share those links outside the committee. A failed metadata insert after upload can leave a private orphan; recovery tooling is planned.

## Implemented foundation

- Phone-first dashboard and Home / Fixtures / Add Result / Tables / More bottom navigation, plus desktop sidebar.
- Password login and fail-closed configuration screen; committee membership checks and PostgreSQL RLS on all public tables.
- Teams, players, seasons and fixture creation. One shared committee account has management permissions. Edit history identifies that account, not the individual using it.
- League 3 pairs, 2 trebles, 1 captains & vice, 6 singles; Cup 12 singles.
- Original-photo upload, category totals and optional player achievements, review and transactional approval via `save_summary_result`. Existing detailed results continue using `save_result`; corrections are audited and originals retained.
- Approved-result tables, season and competition separation, player-stat aggregates, Excel-compatible CSV downloads.
- Results filters for season, team, match date and competition, short-lived original viewing and fixture/result history.
- Weekly PNG export, date cutoff and missing-result flag.
- Manifest, 192/512 PNG icons, safe service worker with an offline message. Authenticated records and photos are never cached.

The Gail Wander Trophy is total league games won: pairs + trebles + singles + captains & vice. League tables show most points first, with equal points tied; alphabetical names within ties are only display order. Cup shows match/game totals, no invented points. Statistics remain scoped to the selected competition. Zero is displayed as zero, not a fabricated achievement.

## Phase 2 / limitations

- Test against the real Supabase project, including RLS, storage and transaction behavior; add automated backend and browser tests before live use.
- Fixture editing/deletion UI, player transfers and season-specific rosters, invitation/password recovery flows, photo recovery tooling, richer actor-labelled audit views and accessible UI polish.
- Confirm further League tie-break rules, Cup points/ranking and whether weekly player statistics should combine competitions.
- Historical PNGs currently use corrected records as of the selected match-date cutoff. They **do not** recreate what was known or published at that time. Immutable publication snapshots and historical revision reconstruction remain to be built.
- Native device install checks, automated backup scheduling and restore drills remain to be tested. Photo scanning has been removed after poor real-world handwriting results.
- CSV exports can be opened in Excel; native `.xlsx` exports are not yet implemented.

## PWA

Production requires HTTPS. iPhone Safari: Share → Add to Home Screen. Android Chrome: Install app / Add to Home screen. The icon label is CCLDL; the dashboard uses the full league name. No offline access to private records. Phone-specific installation has not yet been tested. The install manifest does not make this a native App Store app.

## Backup and recovery

Use Supabase's supported backup/export features for your selected plan; do not assume automatic backups or PITR are enabled. See `supabase/BACKUPS.md`. SQL migrations are versioned here. Database dumps **do not include storage photo contents**. Back up originals separately and protect exports as private league data.

## Validation performed in this cloud workspace

- Production build and 14 unit tests passed (standings, detailed-entry helpers, summary scores and CSV parsing).
- 6 Chromium browser tests passed: locked production screen, summary entry and CSV review at phone widths, searchable players, consolidated navigation, a real PNG download, desktop dashboard and PWA assets.
- PostgreSQL 17 migration and SQL acceptance assertions passed using local auth/storage schema stubs: nonmember read/write denial, complete result approval, correction audit history and retention of originals. This validates SQL behavior, **not** Supabase auth/storage integration.
- Dependency audit reported zero vulnerabilities after upgrading to Next.js 16.4.

Run browser checks after `npm run build`, with Supabase variables unset and demo mode disabled for the normal build:

```sh
npm run test:browser
```

The tests build a separate fictional demo in `.next-demo`; neither build inserts database records. Chromium must be installed; set `CHROMIUM_PATH` if its location differs from `/usr/bin/chromium`.

To reproduce SQL checks, run an isolated disposable PostgreSQL 17 instance, then apply `tests/sql/bootstrap.sql`, the migration, and `tests/sql/rls-and-results.sql` in order with `psql -v ON_ERROR_STOP=1`. These files must **never** be applied to your live Supabase project: they contain test identities and fictional records.

In this cloud browser, Next.js development-mode hydration was blocked by failed HMR WebSocket handshakes (both Turbopack and webpack). Production-mode browser flows passed. Use `npm run build && npm start` to review the app here; ordinary local development uses `npm run dev`. Cloud hot reload remains unverified.


## Simplified results and Facebook standings

Apply **only** `supabase/migrations/202610130002_summary_results.sql` to an existing database. It adds a summary column, validation and `save_summary_result`; it does not delete existing league records or photos. Existing RLS and audit triggers continue to apply. New result saving is gated until this update is detected. Do not rerun the initial migration on an existing project.

New League results use four home-win totals (3 pairs, 2 trebles, 1 captains & vice, 6 singles); away wins and the final score are calculated. Cup uses 12 singles. Only players with achievements need selection. Search for a saved name and add Double 1 counts, highest score (1–180) and/or checkout (1–170). No invented per-game results are created. Original photographs and review remain required before approval. Summary edits are atomic and audited. Older detailed results retain their original game/player editor, and cannot be silently replaced with totals.

Home has no upcoming-fixture or approval/archive counters. Fixtures is only the saved schedule. More → Teams & players holds administration. Tables combines standings, category totals and player statistics. More → Results shows existing scores, edits, originals and history.

Weekly Overview exports a 2160px-wide PNG with a responsive preview. Trophy headings match the committee's example: Lorraine Hudson Trophy / Highest Score, The Gail Wander Trophy, Highest Checkout, Pairs, Trebles, Singles, Leigh Barnes Trophy / Captains & vice, and The Pitt Stop Madhouse Trophy / Double 1 finishes. Cup stays separate. Equal leading totals share highlighting; Cup has no ranking highlight. Select the date and competition for player statistics; incomplete scheduled results and absent category breakdowns are flagged. Download the PNG and attach it to the Facebook group manually; nothing is posted automatically. Historical exports use currently corrected records.

Validation: unit checks cover score bounds, duplicate players, competition/date/season separation and category aggregation. Browser checks cover 320px entry, CSV review, navigation and an actual PNG download. Database checks exercise both migrations, summary approval/edit validation, Cup, nonmember RLS denial, original retention, audit history and preservation/editing of detailed results. Live Supabase acceptance and actual iPhone/Android device checks remain separate.

To repeat the additional database checks without installing a database server or changing app dependencies:

```sh
npm install --prefix /tmp/ccldl-db-test @electric-sql/pglite --cache /tmp/npm-cache --no-audit --no-fund
PGLITE_MODULE=/tmp/ccldl-db-test/node_modules/@electric-sql/pglite/dist/index.js node tests/database/summary.mjs
```

## Player lists, CSV import and name suggestions

More → Teams & players shows current players grouped by team, with search. CSV import is optional; individual player creation remains available. Use UTF-8 CSV with `name,team` and an optional `notes` column (a blank template is provided). Comma, semicolon and tab separators, quoted fields and Excel UTF-8 BOM are supported. Files are limited to 1 MB and 500 players. Preview and correct names/team assignments, check any transcription notes, and confirm before importing. Unknown/ambiguous teams and invalid rows block saving; matching names already on the same team and duplicates within the file are skipped. Add teams first. Notes are review-only and are not stored as player data.

Import rechecks existing teams/players immediately before sending one bulk insert through the signed-in Supabase client and existing committee RLS. It does not delete/overwrite players or automatically create teams. No migration or extra backend credential is needed. Duplicate detection is application-level; it is not a new database uniqueness constraint. CSV parsing/preview and duplicate/error handling are tested locally; the live bulk insert still needs acceptance testing with the committee account.

During result entry, start typing a saved team member's name and choose a suggestion (or use arrow keys and Enter). Only players from the fixture’s two teams are offered. Players already added to the achievement list are excluded. Existing detailed results keep their earlier lineup helpers. Unrecognised/free-typed names do not count as a selected player and prevent approval until an existing player is chosen. Statistics remain attached to the selected player/result; changing the selected player clears their prior stats. The sample rosters are still confined to demo mode.

Phone shortcut: More → Teams & players opens roster management. Input controls and player suggestions use generous tap targets; the import preview is tested at 320px width as well as the result flow at 390px. Actual iPhone/Android device acceptance remains separate from these Chromium viewport checks.
