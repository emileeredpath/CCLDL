export type EntryPlayer = {
  recorded_scores?: number[];
  recorded_checkouts?: number[];
  player_id: string;
  side: "home" | "away";
  double_ones: number;
  highest_score: number | null;
  highest_checkout: number | null;
};
export type EntryGame = {
  number: number;
  kind: string;
  winner: string;
  players: EntryPlayer[];
};
export function reuseLineup(
  target: EntryGame,
  source: EntryGame,
  side: EntryPlayer["side"],
): EntryGame {
  const existing = target.players.filter((p) => p.side === side),
    copy = source.players.filter((p) => p.side === side);
  if (
    existing.some((p) => p.player_id) ||
    existing.length !== copy.length ||
    copy.some((p) => !p.player_id) ||
    new Set(copy.map((p) => p.player_id)).size !== copy.length
  )
    return target;
  let i = 0;
  return {
    ...target,
    players: target.players.map((p) =>
      p.side === side
        ? {
            ...p,
            player_id: copy[i++].player_id,
            double_ones: 0,
            highest_score: null,
            highest_checkout: null,
          }
        : p,
    ),
  };
}
export function gameComplete(game: EntryGame): boolean {
  return (
    ["home", "away"].includes(game.winner) &&
    game.players.every(
      (p) =>
        Boolean(p.player_id) &&
        Number.isInteger(p.double_ones) &&
        p.double_ones >= 0 &&
        p.double_ones <= 999 &&
        [p.highest_score, p.highest_checkout].every(
          (n, i) =>
            n === null ||
            (Number.isInteger(n) && n >= 0 && n <= (i === 0 ? 180 : 170)),
        ),
    ) &&
    new Set(game.players.map((p) => p.player_id)).size === game.players.length
  );
}
