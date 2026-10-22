// Disposable PostgreSQL-compatible database only. Never connects to Supabase.
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
import fs from "node:fs";
import assert from "node:assert/strict";
process.on("uncaughtException", (e) => {
  console.error(
    e.message,
    e.where,
    e.position,
    e.query?.slice(Number(e.position) - 180, Number(e.position) + 180),
  );
  process.exit(1);
});
const db = new PGlite();
await db.exec(
  `create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$; insert into auth.users values(auth.uid()); create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid,bucket_id text);`,
);
for (const name of [
  "202610130001_initial.sql",
  "202610130002_summary_results.sql",
  "202610140001_pending_achievements.sql",
])
  await db.exec(
    fs.readFileSync(
      new URL("../../supabase/migrations/" + name, import.meta.url),
      "utf8",
    ),
  );
await db.exec(
  `insert into committee_members values(auth.uid(),'administrator'); insert into teams(id,name) values('00000000-0000-0000-0000-000000000002','Home'),('00000000-0000-0000-0000-000000000003','Away'); insert into players(id,name,team_id) values('00000000-0000-0000-0000-000000000004','Player','00000000-0000-0000-0000-000000000002'); insert into fixtures(id,season_id,competition,played_on,home_team_id,away_team_id) select '00000000-0000-0000-0000-000000000005',id,'league','2026-10-06','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003' from seasons; insert into result_sheets(id,fixture_id,storage_path) values('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000005','private/test.jpg');`,
);
const summary = {
  counts: { Pairs: 2, Trebles: 1, "Captains & vice": 0, Singles: 5 },
  achievements: [
    {
      player_id: "00000000-0000-0000-0000-000000000004",
      side: "home",
      double_ones: 2,
      highest_score: 140,
      highest_checkout: null,
      recorded_scores: [100,140],
    },
  ],
};
const save = (s, sheet = "00000000-0000-0000-0000-000000000006") =>
  db.query(
    `select save_summary_result('00000000-0000-0000-0000-000000000005',$1,$2)`,
    [sheet, JSON.stringify(s)],
  );
await save(summary);
assert.deepEqual((await db.query("select summary from results limit 1")).rows[0].summary.achievements[0].recorded_scores,[100,140]);
assert.equal(
  (await db.query("select status from results")).rows[0].status,
  "approved",
);
await assert.rejects(
  save({ ...summary, counts: { ...summary.counts, Pairs: 4 } }),
);
await assert.rejects(
  save({ ...summary, counts: { ...summary.counts, Pairs: 1.5 } }),
);
await assert.rejects(
  save({
    ...summary,
    achievements: [{ ...summary.achievements[0], side: "away" }],
  }),
);
await assert.rejects(
  save({
    ...summary,
    achievements: [{ ...summary.achievements[0], highest_score: 181 }],
  }),
);
await assert.rejects(
  save({
    ...summary,
    achievements: [...summary.achievements, ...summary.achievements],
  }),
);
await save({ ...summary, counts: { ...summary.counts, Pairs: 3 } });
assert.equal(
  (await db.query("select count(*)::int as n from result_sheets")).rows[0].n,
  1,
);
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from audit_log where table_name='results' and action='UPDATE'",
    )
  ).rows[0].n,
  1,
);
await assert.rejects(db.query("update results set sheet_id=null"));
assert.equal(
  (await db.query("select summary from results")).rows[0].summary.counts.Pairs,
  3,
);

// The legacy detailed workflow remains valid, including edits.
const fixture = (
  await db.query(
    `insert into fixtures(season_id,competition,played_on,home_team_id,away_team_id) select id,'league','2026-10-13','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003' from seasons returning id`,
  )
).rows[0].id;
const sheet = (
  await db.query(
    `insert into result_sheets(fixture_id,storage_path) values($1,'private/legacy.jpg') returning id`,
    [fixture],
  )
).rows[0].id;
const rosters = { home: [], away: [] };
for (const side of ["home", "away"])
  for (let i = 0; i < 3; i++)
    rosters[side].push(
      (
        await db.query(
          "insert into players(name,team_id) values($1,$2) returning id",
          [
            `${side} ${i}`,
            side === "home"
              ? "00000000-0000-0000-0000-000000000002"
              : "00000000-0000-0000-0000-000000000003",
          ],
        )
      ).rows[0].id,
    );
const games = Array.from({ length: 12 }, (_, i) => {
  const kind =
    i < 3
      ? "Pairs"
      : i < 5
        ? "Trebles"
        : i === 5
          ? "Captains & vice"
          : "Singles";
  const n = kind === "Trebles" ? 3 : kind === "Singles" ? 1 : 2;
  return {
    number: i + 1,
    kind,
    winner: i < 7 ? "home" : "away",
    players: ["home", "away"].flatMap((side) =>
      rosters[side].slice(0, n).map((player_id) => ({
        player_id,
        side,
        double_ones: 0,
        highest_score: null,
        highest_checkout: null,
      })),
    ),
  };
});
await db.query("select save_result($1,$2,$3,true)", [
  fixture,
  sheet,
  JSON.stringify(games),
]);
await db.query("select save_result($1,$2,$3,true)", [
  fixture,
  sheet,
  JSON.stringify(games),
]);
await assert.rejects(
  db.query("select save_summary_result($1,$2,$3)", [
    fixture,
    sheet,
    JSON.stringify(summary),
  ]),
);
assert.equal(
  (await db.query("select count(*)::int as n from games")).rows[0].n,
  12,
);
// Cup only accepts 12 singles totals.
const cup = (
  await db.query(
    `insert into fixtures(season_id,competition,played_on,home_team_id,away_team_id) select id,'cup','2026-10-13','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003' from seasons returning id`,
  )
).rows[0].id;
const cupSheet = (
  await db.query(
    `insert into result_sheets(fixture_id,storage_path) values($1,'private/cup.jpg') returning id`,
    [cup],
  )
).rows[0].id;
await db.query("select save_summary_result($1,$2,$3)", [
  cup,
  cupSheet,
  JSON.stringify({ counts: { Singles: 6 }, achievements: [] }),
]);
await assert.rejects(
  db.query("select save_summary_result($1,$2,$3)", [
    cup,
    cupSheet,
    JSON.stringify(summary),
  ]),
);

const draftFixture = (
  await db.query(
    `insert into fixtures(season_id,competition,played_on,home_team_id,away_team_id) select id,'league','2026-10-20','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003' from seasons returning id`,
  )
).rows[0].id;
const pending = {
  ...summary,
  pending_achievements: [
    {
      name: "Unconfirmed",
      side: "away",
      double_ones: 1,
      highest_score: null,
      highest_checkout: null,
      note: "Check surname",
    },
  ],
};
await db.query("select save_summary_draft($1,null,$2)", [
  draftFixture,
  JSON.stringify(pending),
]);
assert.equal(
  (
    await db.query("select status from results where fixture_id=$1", [
      draftFixture,
    ])
  ).rows[0].status,
  "draft",
);
const draftSheet = (
  await db.query(
    `insert into result_sheets(fixture_id,storage_path) values($1,'private/draft.jpg') returning id`,
    [draftFixture],
  )
).rows[0].id;
await assert.rejects(
  db.query("select save_summary_result($1,$2,$3)", [
    draftFixture,
    draftSheet,
    JSON.stringify(pending),
  ]),
  /pending achievement/,
);
await db.query("select save_summary_result($1,$2,$3)", [
  draftFixture,
  draftSheet,
  JSON.stringify(summary),
]);
await assert.rejects(
  db.query("select save_summary_draft($1,$2,$3)", [
    draftFixture,
    draftSheet,
    JSON.stringify(summary),
  ]),
  /already approved/,
);
// Exercise the authenticated non-committee role against the actual RLS policies.
await db.exec(
  `grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated; grant usage on schema auth to authenticated; create or replace function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000099'::uuid $$; set role authenticated;`,
);
assert.equal((await db.query("select * from results")).rows.length, 0);
await assert.rejects(save(summary));
console.log(
  "PASS: migrations; summary save/edit and validation; private access; audit/original retention; Cup totals; legacy save/edit and conversion protection.",
);
await db.exec("reset role; create or replace function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;");
await db.exec(fs.readFileSync(new URL("../../supabase/migrations/202610150001_remove_duplicate_sheets.sql", import.meta.url), "utf8"));
const linked = (await db.query("select sheet_id,fixture_id,id,status from results where sheet_id is not null limit 1")).rows[0];
await assert.rejects(db.query("select remove_result_sheet($1)", [linked.sheet_id]), /original linked/);
const extra = (await db.query("insert into result_sheets(fixture_id,storage_path) values($1,'test/duplicate.jpg') returning id", [linked.fixture_id])).rows[0].id;
await db.query("select remove_result_sheet($1)", [extra]);
assert((await db.query("select removed_at from result_sheets where id=$1", [extra])).rows[0].removed_at);
await assert.rejects(db.query("update results set sheet_id=$1 where id=$2", [extra,linked.id]), /active original/);
assert.equal((await db.query("select status from results where id=$1", [linked.id])).rows[0].status,linked.status);
console.log("PASS: duplicate removal retains original, protects linked sheet, preserves result and rejects relinking removed sheets.");
await db.close();
