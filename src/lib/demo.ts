import type { Result } from "./standings";
export const demoResults: Result[] = [
  {
    id: "demo-1",
    season: "2026/27",
    competition: "league",
    date: "2026-10-06",
    home: "Rose & Crown",
    away: "Pink Arrows",
    breakdown: { Pairs: 2, Trebles: 1, "Captains & vice": 0, Singles: 4 },
    homeWins: 7,
    awayWins: 5,
    approved: true,
  },
  {
    id: "demo-2",
    season: "2026/27",
    competition: "league",
    date: "2026-10-06",
    home: "City Belles",
    away: "The Foxes",
    breakdown: { Pairs: 2, Trebles: 1, "Captains & vice": 1, Singles: 4 },
    homeWins: 8,
    awayWins: 4,
    approved: true,
  },
  {
    id: "demo-3",
    season: "2026/27",
    competition: "cup",
    date: "2026-10-08",
    home: "Rose & Crown",
    away: "City Belles",
    homeWins: 6,
    awayWins: 6,
    approved: true,
  },
];
export const demoFixtures = [
  {
    id: "f1",
    home_team_id: "demo-pink",
    away_team_id: "demo-city",
    date: "2026-10-20",
    competition: "league",
    home: "Pink Arrows",
    away: "City Belles",
  },
  {
    id: "f2",
    home_team_id: "demo-foxes",
    away_team_id: "demo-rose",
    date: "2026-10-20",
    competition: "league",
    home: "The Foxes",
    away: "Rose & Crown",
  },
];

// Fictional rosters used only in the isolated demo and browser tests.
export const demoPlayers = ["pink", "city", "foxes", "rose"].flatMap((team) =>
  Array.from({ length: 8 }, (_, i) => ({
    id: `demo-${team}-${i + 1}`,
    name: `${team[0].toUpperCase() + team.slice(1)} Player ${i + 1}`,
    team_id: `demo-${team}`,
  })),
);
