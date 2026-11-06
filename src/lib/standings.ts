export type Result = {
  id: string;
  fixtureId?: string;
  achievements?: import("./manual-entry").EntryPlayer[];
  breakdown?: Record<string, number>;
  summary?: import("./result-summary").Summary;
  season: string;
  competition: "league" | "cup";
  date: string;
  home: string;
  away: string;
  homeWins: number;
  awayWins: number;
  approved: boolean;
};
export function standings(
  results: Result[],
  competition: Result["competition"],
  cutoff: string,
  season = "2026/27",
  teams: string[] = [],
) {
  const rows = new Map<
    string,
    {
      team: string;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      gamesFor: number;
      gamesAgainst: number;
    }
  >();
  for (const team of teams)
    rows.set(team, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gamesFor: 0,
      gamesAgainst: 0,
    });
  for (const r of [
    ...new Map(results.map((r) => [r.fixtureId ?? r.id, r])).values(),
  ].filter(
    (r) =>
      r.approved &&
      r.competition === competition &&
      r.season === season &&
      r.date <= cutoff,
  )) {
    for (const [team, gf, ga] of [
      [r.home, r.homeWins, r.awayWins],
      [r.away, r.awayWins, r.homeWins],
    ] as const) {
      const row = rows.get(team) ?? {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gamesFor: 0,
        gamesAgainst: 0,
      };
      row.played++;
      row.gamesFor += gf;
      row.gamesAgainst += ga;
      row.won += Number(gf > ga);
      row.drawn += Number(gf === ga);
      row.lost += Number(gf < ga);
      rows.set(team, row);
    }
  }
  return [...rows.values()]
    .map((r) => ({
      ...r,
      points: competition === "cup" ? r.won * 2 + r.drawn : r.gamesFor,
    }))
    .sort((a, b) => b.points - a.points || a.team.localeCompare(b.team));
}
export function gameTypes(competition: "league" | "cup") {
  return competition === "cup"
    ? Array<string>(12).fill("Singles")
    : [
        "Pairs",
        "Pairs",
        "Pairs",
        "Trebles",
        "Trebles",
        "Captains & vice",
        ...Array<string>(6).fill("Singles"),
      ];
}

/**
 * Table positions. Teams that have played come first, in points order; teams
 * level on points share a position number (1, 2, 2, 4). Teams yet to play
 * keep their place at the bottom without a position. No tie-break is applied
 * until the committee confirms one.
 */
export function positions<T extends { points: number; played?: number }>(
  rows: T[],
) {
  const played = rows.filter((r) => r.played === undefined || r.played > 0);
  const waiting = rows.filter((r) => r.played !== undefined && r.played === 0);
  return [...played, ...waiting].map((r) => {
    const ranked = r.played === undefined || r.played > 0;
    const rank = ranked
      ? played.findIndex((x) => x.points === r.points) + 1
      : 0;
    const joint =
      ranked && played.filter((x) => x.points === r.points).length > 1;
    return { ...r, rank, joint, label: ranked ? String(rank) : "–" };
  });
}
