import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WeeklyPoster from "../src/components/weekly-poster";
test("weekly image includes all nine teams in both tables and only five ranked players per category", () => {
  const teams = Array.from({ length: 9 }, (_, i) => "Test Team " + i);
  const stats = Array.from({ length: 7 }, (_, i) => ({
    id: String(i),
    name: "Test Player " + i,
    d1: 7 - i,
    score: 180 - i,
    checkout: 170 - i,
  }));
  const html = renderToStaticMarkup(
    createElement(WeeklyPoster, {
      results: [],
      stats,
      season: "2026/27",
      week: "2026-10-22",
      competition: "league",
      incomplete: 0,
      demo: true,
      teamNames: teams,
    }),
  );
  for (const team of teams) assert.equal(html.split(team).length - 1, 2);
  assert.equal(html.split("Test Player 4").length - 1, 3);
  assert(!html.includes("Test Player 5"));
  assert(html.includes("Win 2"));
  assert(html.includes("League &amp; Cup combined"));
});
