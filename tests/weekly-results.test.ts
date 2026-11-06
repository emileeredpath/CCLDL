import test from "node:test";
import assert from "node:assert/strict";
import {
  byeTeams,
  latestRound,
  longDate,
  weeklyMatches,
  weeklyRounds,
  type RoundFixture,
} from "../src/lib/weekly-results";
import type { Result } from "../src/lib/standings";

const teams = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
const round = (
  date: string,
  competition: string,
  ids: string,
): RoundFixture[] =>
  [0, 2, 4, 6].map((i, n) => ({
    id: `${ids}${n}`,
    date,
    competition,
    home: teams[i],
    away: teams[i + 1],
    season: "2026/27",
  }));
const fixtures: RoundFixture[] = [
  ...round("2026-10-06", "league", "l1-"),
  ...round("2026-10-13", "league", "l2-"),
  ...round("2026-10-20", "cup", "c1-"),
  ...round("2026-10-27", "league", "l3-"),
  // A single rearranged game on a catch-up date is not a numbered round.
  {
    id: "x",
    date: "2026-11-10",
    competition: "league",
    home: "A",
    away: "C",
    season: "2026/27",
  },
  ...round("2026-11-17", "cup", "c2-"),
  {
    id: "old",
    date: "2025-10-06",
    competition: "league",
    home: "A",
    away: "B",
    season: "2025/26",
  },
];

test("rounds follow the official League and Cup numbering", () => {
  const labels = weeklyRounds(fixtures, "2026/27").map((r) => r.label);
  assert.deepEqual(labels, [
    "League 1",
    "League 2",
    "Cup 1",
    "League 3",
    "Catch-up matches",
    "Cup 2",
  ]);
});

test("latest round is the last one on or before the cut-off", () => {
  const rounds = weeklyRounds(fixtures, "2026/27");
  assert.equal(latestRound(rounds, "2026-10-30")?.label, "League 3");
  assert.equal(latestRound(rounds, "2026-10-01"), undefined);
});

test("matches show approved scores and section scores; drafts stay hidden", () => {
  const results: Result[] = [
    {
      id: "r1",
      fixtureId: "l3-0",
      season: "2026/27",
      competition: "league",
      date: "2026-10-27",
      home: "A",
      away: "B",
      homeWins: 7,
      awayWins: 5,
      approved: true,
      breakdown: { Pairs: 2, Trebles: 1, "Captains & vice": 0, Singles: 4 },
    },
    {
      id: "r2",
      fixtureId: "l3-1",
      season: "2026/27",
      competition: "league",
      date: "2026-10-27",
      home: "C",
      away: "D",
      homeWins: 3,
      awayWins: 9,
      approved: false,
      breakdown: { Pairs: 0, Trebles: 1, "Captains & vice": 0, Singles: 2 },
    },
  ];
  const matches = weeklyMatches(fixtures, results, "2026-10-27", "2026/27");
  assert.equal(matches.length, 4);
  const ab = matches.find((m) => m.home === "A")!;
  assert.equal(ab.homeWins, 7);
  assert.equal(ab.awayWins, 5);
  assert.deepEqual(
    ab.sections.map((s) => [s.name, s.home, s.away]),
    [
      ["Pairs", 2, 1],
      ["Trebles", 1, 1],
      ["Captains & vice", 0, 1],
      ["Singles", 4, 2],
    ],
  );
  const cd = matches.find((m) => m.home === "C")!;
  assert.equal(cd.homeWins, null, "draft must not be published");
  assert.deepEqual(cd.sections, []);
});

test("cup matches have no league section breakdown", () => {
  const results: Result[] = [
    {
      id: "c",
      fixtureId: "c1-0",
      season: "2026/27",
      competition: "cup",
      date: "2026-10-20",
      home: "A",
      away: "B",
      homeWins: 6,
      awayWins: 6,
      approved: true,
      breakdown: { Singles: 6 },
    },
  ];
  const [m] = weeklyMatches(fixtures, results, "2026-10-20", "2026/27");
  assert.equal(m.competition, "cup");
  assert.equal(m.homeWins, 6);
  assert.deepEqual(m.sections, []);
});

test("bye team is the one not playing in a full round", () => {
  assert.deepEqual(byeTeams(fixtures, "2026-10-06", "2026/27", teams), ["I"]);
  assert.deepEqual(byeTeams(fixtures, "2026-11-10", "2026/27", teams), []);
});

test("long date reads in British style", () => {
  assert.equal(longDate("2026-11-03"), "Tuesday 3 November 2026");
});
