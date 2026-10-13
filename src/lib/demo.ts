import type { Result } from "./standings";
export const demoResults: Result[] = [
  {
    id: "demo-1",
    season: "2026/27",
    competition: "league",
    date: "2026-10-06",
    home: "Rose & Crown",
    away: "Pink Arrows",
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
    date: "2026-10-20",
    competition: "league",
    home: "Pink Arrows",
    away: "City Belles",
  },
  {
    id: "f2",
    date: "2026-10-20",
    competition: "league",
    home: "The Foxes",
    away: "Rose & Crown",
  },
];
