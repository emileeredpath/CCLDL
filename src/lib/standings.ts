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
