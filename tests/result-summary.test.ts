import test from "node:test";
import assert from "node:assert/strict";
import {
  emptySummary,
  summaryValid,
  categoryStandings,
  type Summary,
} from "../src/lib/result-summary";
import type { Result } from "../src/lib/standings";
const summary: Summary = {
  counts: { Pairs: 2, Trebles: 1, "Captains & vice": 0, Singles: 5 },
  achievements: [],
};
test("Summary requires complete bounded category totals without requiring all players", () => {
  assert.equal(summaryValid(emptySummary(false), false), false);
  assert.equal(summaryValid(summary, false), true);
  assert.equal(
    summaryValid(
      { ...summary, counts: { ...summary.counts, Pairs: 4 } },
      false,
    ),
    false,
  );
  assert.equal(
    summaryValid(
      { ...summary, counts: { ...summary.counts, Pairs: 1.5 } },
      false,
    ),
    false,
  );
  assert.equal(
    summaryValid({ counts: { Singles: 12 }, achievements: [] }, true),
    true,
  );
});
test("Achievement totals require a selected player, bounded stats and unique player IDs", () => {
  const p = {
    player_id: "a",
    side: "home" as const,
    double_ones: 2,
    highest_score: 140,
    highest_checkout: null,
  };
  assert.equal(summaryValid({ ...summary, achievements: [p] }, false), true);
  for (const achievements of [
    [{ ...p, player_id: "" }],
    [p, p],
    [{ ...p, highest_checkout: 171 }],
    [{ ...p, double_ones: -1 }],
    [{ ...p, double_ones: 0, highest_score: null }],
  ])
    assert.equal(summaryValid({ ...summary, achievements }, false), false);
});
test("Category totals use approved league records through the cutoff only, with both sides", () => {
  const r: Result = {
    id: "a",
    season: "2026/27",
    competition: "league",
    date: "2026-10-06",
    home: "A",
    away: "B",
    homeWins: 8,
    awayWins: 4,
    approved: true,
    breakdown: { Pairs: 2, Trebles: 1, "Captains & vice": 0, Singles: 5 },
  };
  assert.deepEqual(
    categoryStandings(
      [
        r,
        { ...r, approved: false },
        { ...r, competition: "cup" },
        { ...r, date: "2026-11-01" },
        { ...r, season: "2025/26" },
      ],
      "Pairs",
      "2026/27",
      "2026-10-13",
    ),
    [
      { name: "A", value: 2 },
      { name: "B", value: 1 },
    ],
  );
  assert.deepEqual(
    categoryStandings([r], "Captains & vice", "2026/27", "2026-10-13"),
    [
      { name: "B", value: 1 },
      { name: "A", value: 0 },
    ],
  );
});
