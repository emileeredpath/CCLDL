import type { Result } from "./standings";
export type PlayerStat = {
  id: string;
  name: string;
  team?: string;
  d1: number;
  score: number;
  checkout: number;
};
export function playerStatistics(
  results: Result[],
  players: { id: string; name: string; team_id?: string }[],
  teams: { id: string; name: string }[],
  season: string,
  cutoff: string,
): PlayerStat[] {
  const totals = new Map<string, PlayerStat>();
  for (const r of new Map(
    results.map((r) => [r.fixtureId ?? r.id, r]),
  ).values()) {
    if (!r.approved || r.season !== season || r.date > cutoff) continue;
    for (const p of r.summary?.achievements ?? r.achievements ?? []) {
      const player = players.find((x) => x.id === p.player_id);
      const row = totals.get(p.player_id) ?? {
        id: p.player_id,
        name: player?.name ?? "Unknown player (review required)",
        team: teams.find((t) => t.id === player?.team_id)?.name,
        d1: 0,
        score: 0,
        checkout: 0,
      };
      row.d1 += p.double_ones;
      row.score = Math.max(
        row.score,
        p.highest_score ?? 0,
        ...(p.recorded_scores ?? []),
      );
      row.checkout = Math.max(
        row.checkout,
        p.highest_checkout ?? 0,
        ...(p.recorded_checkouts ?? []),
      );
      totals.set(p.player_id, row);
    }
  }
  return [...totals.values()];
}
export function rankedStats(
  stats: PlayerStat[],
  key: "d1" | "score" | "checkout",
  limit = Infinity,
) {
  const sorted = stats
    .filter((s) => s[key] > 0)
    .sort(
      (a, b) =>
        b[key] - a[key] ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
  return sorted
    .slice(0, limit)
    .map((s, i) => ({
      ...s,
      rank: sorted.findIndex((x) => x[key] === s[key]) + 1,
      joint: sorted.filter((x) => x[key] === s[key]).length > 1,
    }));
}
