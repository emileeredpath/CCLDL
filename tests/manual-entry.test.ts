import test from "node:test";
import assert from "node:assert/strict";
import {
  reuseLineup,
  gameComplete,
  type EntryGame,
} from "../src/lib/manual-entry";
const source: EntryGame = {
  number: 1,
  kind: "Pairs",
  winner: "home",
  players: [
    {
      player_id: "a",
      side: "home",
      double_ones: 2,
      highest_score: 140,
      highest_checkout: 60,
    },
    {
      player_id: "b",
      side: "home",
      double_ones: 0,
      highest_score: null,
      highest_checkout: null,
    },
    {
      player_id: "c",
      side: "away",
      double_ones: 0,
      highest_score: null,
      highest_checkout: null,
    },
    {
      player_id: "d",
      side: "away",
      double_ones: 0,
      highest_score: null,
      highest_checkout: null,
    },
  ],
};
const empty = (): EntryGame => ({
  ...source,
  number: 2,
  winner: "away",
  players: source.players.map((p) => ({
    ...p,
    player_id: "",
    double_ones: 0,
    highest_score: null,
    highest_checkout: null,
  })),
});
test("Reuse copies only selected side names, not statistics or winner", () => {
  const target = empty();
  const result = reuseLineup(target, source, "home");
  assert.deepEqual(
    result.players.map((p) => p.player_id),
    ["a", "b", "", ""],
  );
  assert.equal(result.winner, "away");
  assert.equal(result.players[0].double_ones, 0);
  assert.equal(result.players[0].highest_score, null);
  assert.equal(target.players[0].player_id, "");
});
test("Partly completed targets and incompatible lineups are preserved", () => {
  const target = empty();
  target.players[0].player_id = "x";
  assert.equal(reuseLineup(target, source, "home"), target);
  const short = { ...source, players: source.players.slice(1) };
  const blank = empty();
  assert.equal(reuseLineup(blank, short, "home"), blank);
});
test("Incomplete or duplicate source players cannot be reused", () => {
  const blank = empty();
  assert.equal(
    reuseLineup(
      blank,
      {
        ...source,
        players: source.players.map((p) =>
          p.side === "home" ? { ...p, player_id: "a" } : p,
        ),
      },
      "home",
    ),
    blank,
  );
  assert.equal(reuseLineup(blank, empty(), "home"), blank);
});
test("Review requires valid distinct players, a winner and valid stats", () => {
  assert.equal(gameComplete(source), true);
  assert.equal(gameComplete(empty()), false);
  assert.equal(gameComplete({ ...source, winner: "" }), false);
  for (const value of [-1, 181, 1.5, NaN])
    assert.equal(
      gameComplete({
        ...source,
        players: source.players.map((p, i) =>
          i === 0 ? { ...p, highest_score: value } : p,
        ),
      }),
      false,
    );
  assert.equal(
    gameComplete({
      ...source,
      players: source.players.map((p) => ({ ...p, player_id: "a" })),
    }),
    false,
  );
});
