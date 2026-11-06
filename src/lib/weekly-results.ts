import { categories } from "./result-summary";
import type { Result } from "./standings";

export type RoundFixture = {
  id: string;
  date: string;
  competition: string;
  home: string;
  away: string;
  season?: string;
};

export type Round = {
  date: string;
  /** "League 4", "Cup 2", or "Catch-up matches" for rearranged games. */
  label: string;
  competition: "league" | "cup" | "mixed";
  number: number | null;
  fixtures: number;
};

export type WeeklyMatch = {
  fixtureId: string;
  competition: "league" | "cup";
  home: string;
  away: string;
  /** Null until an approved result exists. Drafts are never shown. */
  homeWins: number | null;
  awayWins: number | null;
  sections: { name: string; short: string; home: number; away: number }[];
};

// A full round has four fixtures (nine teams, one bye). A date with fewer
// fixtures of a competition holds rearranged games, so it is not counted as
// a numbered round. This keeps "League 4" in step with the official list.
const FULL_ROUND = 3;

const shortName: Record<string, string> = {
  Pairs: "Pairs",
  Trebles: "Trebles",
  "Captains & vice": "Capt & Vice",
  Singles: "Singles",
};

export function weeklyRounds(
  fixtures: RoundFixture[],
  season: string,
): Round[] {
  const inSeason = fixtures.filter((f) => !f.season || f.season === season);
  const dates = [...new Set(inSeason.map((f) => f.date))].sort();
  const counts = { league: 0, cup: 0 };
  return dates.map((date) => {
    const onDate = inSeason.filter((f) => f.date === date);
    const league = onDate.filter((f) => f.competition === "league").length;
    const cup = onDate.filter((f) => f.competition === "cup").length;
    const main: "league" | "cup" = league >= cup ? "league" : "cup";
    const mainCount = Math.max(league, cup);
    if (mainCount >= FULL_ROUND) {
      counts[main] += 1;
      const extra = league && cup ? " + catch-up" : "";
      return {
        date,
        label: `${main === "league" ? "League" : "Cup"} ${counts[main]}${extra}`,
        competition: league && cup ? "mixed" : main,
        number: counts[main],
        fixtures: onDate.length,
      };
    }
    return {
      date,
      label: "Catch-up matches",
      competition: league && cup ? "mixed" : main,
      number: null,
      fixtures: onDate.length,
    };
  });
}

export function weeklyMatches(
  fixtures: RoundFixture[],
  results: Result[],
  date: string,
  season: string,
): WeeklyMatch[] {
  return fixtures
    .filter((f) => f.date === date && (!f.season || f.season === season))
    .sort(
      (a, b) =>
        a.competition.localeCompare(b.competition) ||
        a.home.localeCompare(b.home),
    )
    .map((f) => {
      const competition = f.competition === "cup" ? "cup" : "league";
      const r = results.find((x) => x.fixtureId === f.id && x.approved);
      const sections =
        r && competition === "league" && r.breakdown
          ? categories(false).flatMap(([name, max]) => {
              const home = r.breakdown![name];
              return Number.isInteger(home) && home >= 0 && home <= max
                ? [
                    {
                      name,
                      short: shortName[name] ?? name,
                      home,
                      away: max - home,
                    },
                  ]
                : [];
            })
          : [];
      return {
        fixtureId: f.id,
        competition,
        home: f.home,
        away: f.away,
        homeWins: r ? r.homeWins : null,
        awayWins: r ? r.awayWins : null,
        sections,
      };
    });
}

export function byeTeams(
  fixtures: RoundFixture[],
  date: string,
  season: string,
  teams: string[],
): string[] {
  const playing = new Set(
    fixtures
      .filter((f) => f.date === date && (!f.season || f.season === season))
      .flatMap((f) => [f.home, f.away]),
  );
  // Only a full round has a meaningful bye; catch-up dates leave most teams out.
  if (playing.size < teams.length - 1) return [];
  return teams.filter((t) => !playing.has(t)).sort();
}

/** The latest round on or before the date, so the image matches the cut-off. */
export function latestRound(
  rounds: Round[],
  cutoff: string,
): Round | undefined {
  return [...rounds].reverse().find((r) => r.date <= cutoff);
}

export function longDate(date: string) {
  const d = new Date(date + "T12:00:00");
  const part = (o: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString("en-GB", o);
  // Built from parts so it always reads "Tuesday 3 November 2026".
  return `${part({ weekday: "long" })} ${part({ day: "numeric" })} ${part({ month: "long" })} ${part({ year: "numeric" })}`;
}
