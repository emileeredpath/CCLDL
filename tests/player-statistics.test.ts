import test from "node:test";
import assert from "node:assert/strict";
import { playerStatistics, rankedStats } from "../src/lib/player-statistics";
import type { Result } from "../src/lib/standings";
const players = [{ id: "p", name: "Brooke", team_id: "t" }],
  teams = [{ id: "t", name: "Team" }];
const match = (
  id: string,
  n: number,
  competition: "league" | "cup" = "league",
): Result => ({
  id,
  fixtureId: id,
  season: "2026/27",
  competition,
  date: "2026-10-06",
  home: "A",
  away: "B",
  homeWins: 7,
  awayWins: 5,
  approved: true,
  achievements: [
    {
      player_id: "p",
      side: "home",
      double_ones: n,
      highest_score: 100,
      highest_checkout: null,
    },
  ],
});
test("Double 1 totals count repeated League finishes only (Rule 16); corrected results recalculate", () => {
  const a = match("1", 3),
    b = match("2", 2, "cup");
  const stats = (rs: Result[]) =>
    playerStatistics(rs, players, teams, "2026/27", "2026-10-22")[0];
  // Every League finish counts; Cup finishes are left out.
  assert.equal(stats([a, b]).d1, 3);
  // A result saved twice is still counted once.
  assert.equal(stats([a, a, b]).d1, 3);
  // A correction replaces the old count rather than adding to it.
  assert.equal(stats([match("1", 1), b]).d1, 1);
  // Cup alone gives no Double 1s, but the Cup high score still counts.
  assert.equal(stats([b]).d1, 0);
  assert.equal(stats([b]).score, 100);
});
test("stable IDs and season/cutoff/approval boundaries prevent incorrect totals", () => {
  const a = match("1", 3);
  assert.equal(
    playerStatistics(
      [
        a,
        { ...match("2", 9), approved: false },
        { ...match("3", 9), season: "2025/26" },
        { ...match("4", 9), date: "2027-01-01" },
      ],
      players,
      teams,
      "2026/27",
      "2026-10-22",
    )[0].d1,
    3,
  );
});
test("top five has joint positions without modifying underlying records", () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({
    id: String(i),
    name: "Player " + i,
    d1: i < 2 ? 10 : 9 - i,
    score: 140,
    checkout: 40,
  }));
  const top = rankedStats(rows, "d1", 5);
  assert.equal(top.length, 5);
  assert.deepEqual(
    top.slice(0, 3).map((p) => p.rank),
    [1, 1, 3],
  );
  assert.equal(rows.length, 7);
});
