import test from "node:test";
import assert from "node:assert/strict";
import {
  identifySheet,
  suggestReadings,
  readingsSummary,
  suggestedCounts,
} from "../src/lib/scan";
import { emptySummary } from "../src/lib/result-summary";
const players = [{ id: "p", name: "Brooke Smith", side: "home" as const }];
test("every Double 1 occurrence survives OCR review and rescan replaces not appends", () => {
  const rows = suggestReadings(
    "Brooke Smith\nBrooke Smith\nBrooke Smith",
    players,
    "double_ones",
  );
  assert.equal(rows.length, 3);
  const first = readingsSummary(rows, players, emptySummary(false), "raw");
  assert.equal(first.achievements[0].double_ones, 3);
  assert.equal(
    readingsSummary(rows, players, first, "raw").achievements[0].double_ones,
    3,
  );
});
test("ambiguous names stay unresolved; invalid readings cannot be applied", () => {
  const row = suggestReadings(
    "Brooke Smith",
    [...players, { ...players[0], id: "other", side: "away" }],
    "double_ones",
  );
  assert.equal(row[0].playerId, "");
  assert.throws(() => readingsSummary(row, players, emptySummary(false), ""));
});
test("score margin notes retain all values and blank values stay unresolved", () => {
  const rows = suggestReadings(
    "Brooke Smith 100\nBrooke Smith 140",
    players,
    "highest_score",
  );
  const s = readingsSummary(rows, players, emptySummary(false), "notes");
  assert.deepEqual(s.achievements[0].recorded_scores, [100, 140]);
  assert.equal(s.achievements[0].highest_score, 140);
  assert.equal(
    suggestReadings("Brooke Smith", players, "highest_score")[0].value,
    null,
  );
});
test("league/cup identification and score suggestions never invent missing totals", () => {
  assert.equal(identifySheet("Cup Result Sheet").type, "cup");
  assert.equal(identifySheet("Pairs Trebles Captains").type, "league");
  assert.equal(identifySheet("unreadable").type, null);
  assert.equal(suggestedCounts("Singles 7 - 5", true).Singles, 7);
  assert.equal(suggestedCounts("Pairs 1 - 1", false).Pairs, null);
  assert.equal(suggestedCounts("Singles unreadable", true).Singles, null);
});

test("repeated names on one OCR line count separately", () => {
  assert.equal(
    suggestReadings("Brooke Smith Brooke Smith", players, "double_ones").length,
    2,
  );
});
