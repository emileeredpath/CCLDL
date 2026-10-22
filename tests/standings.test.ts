import test from "node:test";
import assert from "node:assert/strict";
import { standings, gameTypes, type Result } from "../src/lib/standings";
const result: Result = {
  id: "1",
  season: "2026/27",
  competition: "league",
  date: "2026-10-01",
  home: "A",
  away: "B",
  homeWins: 7,
  awayWins: 5,
  approved: true,
};
test("League points equal games won and both sides are represented", () => {
  const rows = standings([result], "league", "2026-10-02");
  assert.equal(rows[0].gamesFor, 7);
  assert.equal(rows[1].gamesFor, 5);
  assert.equal(rows[0].won, 1);
});
test("Drafts, later weeks, other seasons and Cup are excluded", () => {
  assert.equal(
    standings(
      [
        { ...result, approved: false },
        { ...result, date: "2027-01-01" },
        { ...result, season: "2025/26" },
        { ...result, competition: "cup" },
      ],
      "league",
      "2026-10-02",
    ).length,
    0,
  );
});
test("12 games and correct League and Cup formats", () => {
  assert.equal(gameTypes("league").length, 12);
  assert.equal(gameTypes("league").filter((x) => x === "Trebles").length, 2);
  assert.ok(gameTypes("cup").every((x) => x === "Singles"));
});

test("Cup 2/1/0 recalculates historical wins draws losses and corrections; all teams included", () => {
  const cup = { ...result, competition: "cup" as const };
  const games = [
    cup,
    { ...cup, id: "2", home: "B", away: "C", homeWins: 6, awayWins: 6 },
  ];
  let rows = standings(games, "cup", "2026-10-10", "2026/27", [
    "A",
    "B",
    "C",
    "D",
  ]);
  assert.equal(rows.find((r) => r.team === "A")?.points, 2);
  assert.equal(rows.find((r) => r.team === "B")?.points, 1);
  assert.equal(rows.find((r) => r.team === "B")?.lost, 1);
  assert.equal(rows.find((r) => r.team === "C")?.drawn, 1);
  assert.equal(rows.find((r) => r.team === "D")?.played, 0);
  rows = standings(
    [{ ...cup, homeWins: 5, awayWins: 7 }, games[1]],
    "cup",
    "2026-10-10",
  );
  assert.equal(rows.find((r) => r.team === "B")?.points, 3);
  assert.equal(rows.find((r) => r.team === "A")?.points, 0);
  assert.equal(standings([result], "league", "2026-10-10")[0].points, 7);
});
