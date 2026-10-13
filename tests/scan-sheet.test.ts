import test from "node:test";
import assert from "node:assert/strict";
import {
  extractSheet,
  fillEmptyGames,
  type ScanWord,
} from "../src/lib/scan-sheet";
const word = (
  text: string,
  x: number,
  y: number,
  confidence = 99,
): ScanWord => ({
  text,
  confidence,
  bbox: { x0: x - 15, x1: x + 15, y0: y, y1: y + 20 },
});
function sheet() {
  const words = [
    word("GAME", 100, 20),
    word("NAME", 250, 20),
    word("RES", 500, 20),
    word("NAME", 650, 20),
    word("RES", 900, 20),
  ];
  for (let i = 1; i <= 12; i++)
    words.push(
      word(String(i), 100, i * 60 + 20),
      word("Alice", 250, i * 60 + 20),
      word("1", 500, i * 60 + 20),
      word("Beth", 650, i * 60 + 20),
      word("0", 900, i * 60 + 20),
    );
  return words;
}
const roster = [
  { id: "a", name: "Alice", side: "home" as const },
  { id: "b", name: "Beth", side: "away" as const },
];
test("Recognises ordered game scores and exact roster names in table columns", () => {
  const r = extractSheet(sheet(), "sample", roster, Array(12).fill(1));
  assert.equal(r.suggestions.length, 12);
  assert.equal(r.suggestions[0].winner, "home");
  assert.deepEqual(r.suggestions[0].homePlayers, ["a"]);
  assert.deepEqual(r.suggestions[0].awayPlayers, ["b"]);
});
test("Missing game numbers fail closed rather than shifting results", () => {
  const r = extractSheet(
    sheet().filter((w) => w.text !== "7"),
    "sample",
    roster,
    Array(12).fill(1),
  );
  assert.equal(r.suggestions.length, 0);
});
test("A missing or uncertain score is not inferred from the other side", () => {
  const words = sheet().filter(
    (w) => !(w.text === "1" && w.bbox.x0 === 485 && w.bbox.y0 === 80),
  );
  const r = extractSheet(words, "TOTAL 12 0", roster, Array(12).fill(1));
  assert.equal(r.suggestions[0].winner, undefined);
  words.find((w) => w.text === "1" && w.bbox.x0 === 485)!.confidence = 30;
  assert.equal(
    extractSheet(words, "", roster, Array(12).fill(1)).suggestions[1].winner,
    undefined,
  );
});
test("Duplicate names and incomplete sides are not assigned", () => {
  const r = extractSheet(
    sheet(),
    "",
    [...roster, { id: "c", name: "Alice", side: "home" }],
    Array(12).fill(1),
  );
  assert.deepEqual(r.suggestions[0].homePlayers, []);
  assert.deepEqual(
    extractSheet(sheet(), "", roster, Array(12).fill(2)).suggestions[0]
      .homePlayers,
    [],
  );
});
test("Suggestions preserve entered winners, player sides and statistics", () => {
  const original = [
    {
      number: 1,
      winner: "away",
      players: [
        { player_id: "existing", side: "home" as const, double_ones: 2 },
        { player_id: "", side: "home" as const, double_ones: 0 },
        { player_id: "", side: "away" as const, double_ones: 0 },
      ],
    },
  ];
  const filled = fillEmptyGames(original, [
    { number: 1, winner: "home", homePlayers: ["a", "c"], awayPlayers: ["b"] },
  ]);
  assert.equal(filled[0].winner, "away");
  assert.deepEqual(
    filled[0].players.map((p) => p.player_id),
    ["existing", "", "b"],
  );
  assert.equal(filled[0].players[0].double_ones, 2);
  assert.equal(original[0].players[2].player_id, "");
});
