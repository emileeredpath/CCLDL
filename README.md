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

1. For a new database, apply all files in `supabase/migrations/` in order. For an existing installation, apply only migrations not yet applied; the latest is `202610140001_pending_achievements.sql` (draft saving and unresolved achievement protection). The initial migration `supabase/migrations/202610130001_initial.sql` is run once through the Supabase CLI (`supabase db push` after linking) or SQL editor. It creates only the confirmed 2026/27 season, **no teams, players, results or user accounts**. Review actual season dates before use; the initial season record uses September–August boundaries, which can be adjusted by the committee.
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

The Gail Wander Trophy is total league games won: pairs + trebles + singles + captains & vice. League tables show most points first, with equal points tied; alphabetical names within ties are only display order. Cup awards 2 points for a win, 1 for a draw and 0 for a loss. Player statistics combine League and Cup within the season. Zero is displayed as zero, not a fabricated achievement.

## Phase 2 / limitations

- Test against the real Supabase project, including RLS, storage and transaction behavior; add automated backend and browser tests before live use.
- Fixture editing/deletion UI, player transfers and season-specific rosters, invitation/password recovery flows, photo recovery tooling, richer actor-labelled audit views and accessible UI polish.
- Confirm any additional tie-break rules; equal points currently remain tied.
- Historical PNGs currently use corrected records as of the selected match-date cutoff. They **do not** recreate what was known or published at that time. Immutable publication snapshots and historical revision reconstruction remain to be built.
- Native device install checks, automated backup scheduling and restore drills remain to be tested. Local OCR is review-assisted because real handwriting recognition remains unreliable.
- CSV exports can be opened in Excel; native `.xlsx` exports are not yet implemented.

## PWA

Production requires HTTPS. iPhone Safari: Share → Add to Home Screen. Android Chrome: Install app / Add to Home screen. The icon label is CCLDL; the dashboard uses the full league name. No offline access to private records. Phone-specific installation has not yet been tested. The install manifest does not make this a native App Store app.

## Backup and recovery

Use Supabase's supported backup/export features for your selected plan; do not assume automatic backups or PITR are enabled. See `supabase/BACKUPS.md`. SQL migrations are versioned here. Database dumps **do not include storage photo contents**. Back up originals separately and protect exports as private league data.

## Validation performed in this cloud workspace

- Production build and 15 unit tests passed (standings, detailed-entry helpers, summary scores and CSV parsing).
- 7 Chromium browser tests passed: locked production screen, summary entry and CSV review at phone widths, searchable players, consolidated navigation, a real PNG download, desktop dashboard and PWA assets. The authenticated write-flow test intercepts a dedicated fake Supabase host; it checks request payloads, failure recovery, draft/reopen, photo upload during approval, saved confirmation, summaries after reload and pending-player resolution without writing live records.
- PostgreSQL 17 migration and SQL acceptance assertions passed using local auth/storage schema stubs: nonmember read/write denial, complete result approval, correction audit history and retention of originals. This validates SQL behavior, **not** Supabase auth/storage integration.
- Dependency audit reported zero vulnerabilities after upgrading to Next.js 16.4.

Run browser checks after `npm run build`, with Supabase variables unset and demo mode disabled for the normal build:

```sh
npm run test:browser
```

The tests build a fictional demo in `.next-demo`, an unconfigured app in `.next-test`, and an authenticated-flow test app in `.next-auth-test` with the reserved `league-test.invalid` backend fully mocked by Playwright. None writes live records. Chromium must be installed; set `CHROMIUM_PATH` if its location differs from `/usr/bin/chromium`.

To reproduce SQL checks, run an isolated disposable PostgreSQL 17 instance, then apply `tests/sql/bootstrap.sql`, the migration, and `tests/sql/rls-and-results.sql` in order with `psql -v ON_ERROR_STOP=1`. These files must **never** be applied to your live Supabase project: they contain test identities and fictional records.

In this cloud browser, Next.js development-mode hydration was blocked by failed HMR WebSocket handshakes (both Turbopack and webpack). Production-mode browser flows passed. Use `npm run build && npm start` to review the app here; ordinary local development uses `npm run dev`. Cloud hot reload remains unverified.


## Simplified results and Facebook standings

Apply **only** `supabase/migrations/202610130002_summary_results.sql` to an existing database. It adds a summary column, validation and `save_summary_result`; it does not delete existing league records or photos. Existing RLS and audit triggers continue to apply. New result saving is gated until this update is detected. Do not rerun the initial migration on an existing project.

New League results use four home-win totals (3 pairs, 2 trebles, 1 captains & vice, 6 singles); away wins and the final score are calculated. Cup uses 12 singles. Only players with achievements need selection. Search for a saved name and add Double 1 counts, highest score (1–180) and/or checkout (1–170). No invented per-game results are created. Original photographs and review remain required before approval. Summary edits are atomic and audited. Older detailed results retain their original game/player editor, and cannot be silently replaced with totals.

Home has no upcoming-fixture or approval/archive counters. Fixtures is only the saved schedule. More → Teams & players holds administration. Tables combines standings, category totals and player statistics. More → Results shows existing scores, edits, originals and history.

Weekly Overview exports a 2160px-wide, taller PNG with large type, both full season tables and top-five player awards. Select a cutoff date; all player statistics combine League and Cup. Historical exports use currently corrected records. Download and share the image manually; nothing is posted automatically.

Validation: unit checks cover score bounds, duplicate players, competition/date/season separation and category aggregation. Browser checks cover 320px entry, CSV review, navigation and an actual PNG download. Database checks exercise both migrations, summary approval/edit validation, Cup, nonmember RLS denial, original retention, audit history and preservation/editing of detailed results. Live Supabase acceptance and actual iPhone/Android device checks remain separate.

To repeat the additional database checks without installing a database server or changing app dependencies:

```sh
npm install --prefix /tmp/ccldl-db-test @electric-sql/pglite --cache /tmp/npm-cache --no-audit --no-fund
PGLITE_MODULE=/tmp/ccldl-db-test/node_modules/@electric-sql/pglite/dist/index.js node tests/database/summary.mjs
```

## Player lists, CSV import and name suggestions

More → Teams & players shows current players grouped by team, with search. CSV import is optional; individual player creation remains available. Use UTF-8 CSV with `name,team` and an optional `notes` column (a blank template is provided). Comma, semicolon and tab separators, quoted fields and Excel UTF-8 BOM are supported. Files are limited to 1 MB and 500 players. Preview and correct names/team assignments, check any transcription notes, and confirm before importing. Unknown/ambiguous teams and invalid rows block saving; matching names already on the same team and duplicates within the file are skipped. Add teams first. Notes are review-only and are not stored as player data.

Import rechecks existing teams/players immediately before sending one bulk insert through the signed-in Supabase client and existing committee RLS. It does not delete/overwrite players or automatically create teams. No migration or extra backend credential is needed. Duplicate detection is application-level; it is not a new database uniqueness constraint. CSV parsing/preview and duplicate/error handling are tested locally; the live bulk insert still needs acceptance testing with the committee account.

During result entry, start typing a saved team member's name and choose a suggestion (or use arrow keys and Enter). Only players from the fixture’s two teams are offered. Players already added to the achievement list are excluded. Existing detailed results keep their earlier lineup helpers. For a new name, choose the home or away team and use **Add player to team** without leaving result entry. It rechecks the selected team for a normalised matching name before inserting; existing matches are reused. Creating/selecting a player for an unassigned achievement retains entered statistics. Changing an already selected identity clears old statistics. Creation failures keep the name and values for retry. Unrecognised/free-typed names do not count as selected until chosen or saved. Statistics remain attached to the selected player/result; changing the selected player clears their prior stats. The sample rosters are still confined to demo mode.

Phone shortcut: More → Teams & players opens roster management. Input controls and player suggestions use generous tap targets; the import preview is tested at 320px width as well as the result flow at 390px. Actual iPhone/Android device acceptance remains separate from these Chromium viewport checks.


## Saved drafts and fixture summaries

Apply `202610140001_pending_achievements.sql` after the summary-results migration. It adds an authenticated committee-only `save_summary_draft` transaction, which cannot demote/overwrite an approved or detailed result, and an approval guard for unresolved achievements. The migration is safe to rerun. A complete score summary can be saved as a draft before a photograph is attached. Drafts are stored in Supabase and excluded from standings until approved. Unsaved edits are held only in memory; there is no local storage of private results.

Select the photograph and review the result; approval archives a selected photo automatically if none is saved yet. The existing explicit Save photograph button remains available. Approval checks the returned database record before showing success, then opens the match summary. Select a fixture (or a result in Results) to view its totals, category wins, named achievements, approval status and linked originals. **Finish & approve result** reopens a draft without retyping its stored data; **Add another result** starts the next match.

Transcribed data imports are private artifacts outside the public repository. Imports should reuse fixtures/players, preserve existing results, and create drafts with original-photo checks rather than fabricating archive objects. Unknown identities are stored in `summary.pending_achievements`; the form lets the committee resolve them against the recorded team or add a known name. Resolution preserves the finish count and merges into an existing achievement row. Approval is blocked on both client and database while unresolved entries remain. The whole-season fixture schedule must be supplied by the committee; result sheets only establish their particular matches.

Inline player duplicate checks are application-level; concurrent creations in separate sessions may still need committee deduplication. Browser write tests use mocked Supabase responses, and SQL checks use disposable PostgreSQL-compatible databases. These checks do not claim a live Railway/Supabase acceptance run.

### Duplicate result-sheet uploads

Apply `supabase/migrations/202610150001_remove_duplicate_sheets.sql` in the
Supabase SQL Editor to enable the × controls in Results. This additive migration
can be rerun. Removal hides an extra upload from the app while retaining its
private original and audit history. A photograph linked to a saved result cannot
be removed; remove the other uploads for that fixture instead. Scores and player
achievements are unaffected. The application reports a missing database update
if the migration has not yet been applied.

The Home league table shows points alongside pairs, trebles, singles and captains
& vice wins, calculated from approved league results for the selected season and
cutoff date. Cup results remain separate.

### Secretary layout and weekly images

Fixtures are grouped by match date with team search and result-status filters.
Open any match to see its summary and private original sheets, or enter its result.
Tables combines match totals and game categories, followed by category leaders and
switchable player-statistic lists. The result archive retains team and date filters.

Weekly PNGs use a taller readability-first layout. The preview scales to phone width; export retains all season teams and five player rows per award.
The local assisted scanner described below needs no provider configuration. Review is required before saving.
Do not enable a paid OCR/vision provider without committee authorization.


### October 2026 accuracy and mobile update

Cup points are calculated from the current approved results: win 2, draw 1,
loss 0. League points remain legs won. Equal points are tied; alphabetical order
within ties is only a display order. Both tables include teams with season fixtures
but no results, so all nine scheduled teams remain visible.

Player statistics use stable player IDs and combine approved League and Cup
results for the selected season and date. Corrections replace the current result;
aggregation is recomputed, never incremented on top of old totals. Every recorded
Double 1 counts. Additional score/checkout readings are retained as arrays inside
the existing summary JSON and can be edited under each player's recorded readings.
Older records without these arrays remain compatible. Raw reviewed OCR text is
retained in summary JSON; originals and audit history remain in Supabase.

The PNG uses a fixed 1600px layout exported at 2× resolution. Larger typography
and side-by-side League and Cup tables favour readability over landscape. All season teams
appear in both tables; only five players appear per award. Joint positions use
competition ranks (1,1,3), and equal values are ordered by name then ID. A tie at
the fifth row does not expand the image: all tied players remain in dashboard lists.

### Free local OCR and review

Tesseract.js runs in a browser worker. The worker, WASM and English data are copied
from locked npm packages into `/public/ocr` by `prebuild`/`predev`. No image leaves
the device for OCR, no provider API key is needed, and no paid service is enabled.
Normal private Supabase archival still occurs when saving the result.

Select one photograph and a fixture. Read the whole sheet or crop the Double 1
column / handwritten notes. OCR type/date suggestions never change the selected
fixture. Text and individual readings remain editable. Exact unique saved-player
matches are suggestions; unclear names require explicit selection. Every repeated
Double 1 line remains a separate reading. A rescan of the same region replaces
its suggestions, and applying readings replaces form achievements after confirmation.
No scan creates players, results or approvals. Home wins remain manual (with
conservative complete-category suggestions); away wins calculate automatically.
OCR cannot reliably recognise handwriting or crossed-out entries, so the review
checklist and manual fallback are mandatory. Correct the raw text, add missed
readings, or enter normally if recognition is poor. Do not present this as a fully
automatic or validated handwritten-sheet scanner.

### Rollback and live data

This release contains no database migration, destructive operation or live data
import. Existing JSON rows, photos and identities are not rewritten. Before any
future database change, follow `supabase/BACKUPS.md` and prove restore to an isolated
project. A recoverable live backup has NOT been verified by this coding session.
The pre-change deployed commit is `5bf923a`; revert this release's commit and
redeploy if required, keeping stored data intact. Earlier code ignores the optional
new JSON reading fields. Do not restore an old database just to roll back the UI.

Live handwriting omissions cannot be repaired from aggregate numbers. Compare
originals with saved readings, resolve ambiguous names and edit the existing
result. No historical name corrections or estimated missing finishes are applied.

The Weekly Overview image-content selector also offers Tables only and Player
leaders, for an optional two-image Facebook post at the same high resolution.

Player names can be corrected in More → Teams & players → Edit name. Updates preserve the player ID and existing statistics. Fixtures defaults to both League and Cup for the selected season. The weekly League table includes all four category totals before total points.
