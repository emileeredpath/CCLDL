export type Result = {
  id: string;
  fixtureId?: string;
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
  for (const r of results.filter(
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
  // League points confirmed by committee; no additional tie-break rule.
  return [...rows.values()].sort(
    (a, b) =>
      (competition === "league" ? b.gamesFor - a.gamesFor : 0) ||
      a.team.localeCompare(b.team),
  );
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
