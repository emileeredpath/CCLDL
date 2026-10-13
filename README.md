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
- Original-photo upload, manual player-level statistics, review and transactional approval/replacement via `save_result`; corrections are audited and originals retained. Manual entry uses one-tap winners, recent player selections and optional lineup reuse; review remains mandatory.
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
- Native device install checks, automated backup scheduling and restore drills remain to be tested. Photo scanning has been removed after poor real-world handwriting results.
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


## Faster manual result entry

The unsuccessful experimental OCR scanner and its model downloads have been removed. Original photographs are still archived privately, and approving a result still requires an archived original and review of all 12 games. No migration or extra service is needed.

Tap a team to select the game winner; clear or change it if needed. Each team's player dropdown puts names already selected in this match first and prevents selecting one player twice in the same game. A blank team lineup can be filled explicitly from an earlier game with the same number of players; scores and statistics are never copied. Partially filled lineups are preserved. Open a player's statistics only when there is a Double 1 finish, high score or checkout to record. Changing a player clears their statistics to prevent attribution to the wrong person.

A running score and completed-game count show progress. Review stays disabled until every game has a winner, unique players and valid statistics. All games are shown again for final approval. The demo includes fictional rosters for trying this flow; nothing is inserted into Supabase.

## Player lists, CSV import and name suggestions

Fixtures → Season administration shows current players grouped by team, with search. CSV import is optional; individual player creation remains available. Use UTF-8 CSV with `name,team` and an optional `notes` column (a blank template is provided). Comma, semicolon and tab separators, quoted fields and Excel UTF-8 BOM are supported. Files are limited to 1 MB and 500 players. Preview and correct names/team assignments, check any transcription notes, and confirm before importing. Unknown/ambiguous teams and invalid rows block saving; matching names already on the same team and duplicates within the file are skipped. Add teams first. Notes are review-only and are not stored as player data.

Import rechecks existing teams/players immediately before sending one bulk insert through the signed-in Supabase client and existing committee RLS. It does not delete/overwrite players or automatically create teams. No migration or extra backend credential is needed. Duplicate detection is application-level; it is not a new database uniqueness constraint. CSV parsing/preview and duplicate/error handling are tested locally; the live bulk insert still needs acceptance testing with the committee account.

During result entry, start typing a saved team member's name and choose a suggestion (or use arrow keys and Enter). Names already used in the match appear first. Players selected elsewhere in the same game are excluded. Unrecognised/free-typed names do not count as a selected player and prevent approval until an existing player is chosen. Statistics remain attached to the selected player/game; changing the selected player clears their prior stats. The sample rosters are still confined to demo mode.

Phone shortcut: More → Teams & players opens roster management. Input controls and player suggestions use generous tap targets; the import preview is tested at 320px width as well as the result flow at 390px. Actual iPhone/Android device acceptance remains separate from these Chromium viewport checks.
