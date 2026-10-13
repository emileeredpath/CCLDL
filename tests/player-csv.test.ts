import test from "node:test";
import assert from "node:assert/strict";
import { parsePlayersCsv, assessPlayers } from "../src/lib/player-csv";
const teams = [
  { id: "a", name: "Team A" },
  { id: "b", name: "Team B" },
];
test("CSV reads BOM, quoted commas, notes and CRLF", () => {
  assert.deepEqual(
    parsePlayersCsv(
      '\uFEFFname,team,notes\r\n"Smith, Jane",Team A,"Check, spelling"\r\n',
    ),
    [{ name: "Smith, Jane", team: "Team A", notes: "Check, spelling" }],
  );
});
test("Excel semicolon delimiters and header aliases work", () => {
  assert.equal(
    parsePlayersCsv("Player Name;Team Name\nAlice;Team A")[0].name,
    "Alice",
  );
});
test("Unknown teams and empty names block import; normalised duplicates skip", () => {
  const r = assessPlayers(
    [
      { name: " ALICE ", team: "team a", notes: "" },
      { name: "Beth", team: "Team A", notes: "" },
      { name: "beth", team: "Team A", notes: "" },
      { name: "Beth", team: "Team B", notes: "" },
      { name: "", team: "Team A", notes: "" },
      { name: "X", team: "Unknown", notes: "" },
    ],
    teams,
    [{ name: "Alice", team_id: "a" }],
  );
  assert.deepEqual(
    r.map((x) => x.status),
    ["duplicate", "new", "duplicate", "new", "error", "error"],
  );
});
test("Malformed rows, missing headers and large files are rejected", () => {
  for (const text of [
    "name\nAlice",
    "name,team\nAlice,Team A,extra",
    'name,team\n"Alice,Team A',
    "name,team\n" + Array(501).fill("Alice,Team A").join("\n"),
  ])
    assert.throws(() => parsePlayersCsv(text));
});
