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
test("weekly league table includes category points and total", () => {
  const html = renderToStaticMarkup(createElement(WeeklyPoster, {
    results: [{id:"r",season:"2026/27",competition:"league",date:"2026-10-06",home:"Home",away:"Away",homeWins:8,awayWins:4,approved:true,breakdown:{Pairs:2,Trebles:1,"Captains & vice":1,Singles:4}}],
    stats:[],season:"2026/27",week:"2026-10-22",competition:"league",incomplete:0,demo:true,
  }));
  assert(html.includes("<th>Pairs</th><th>Trebles</th><th>C&amp;V</th><th>Singles</th>"));
  assert(html.includes("<td>2</td><td>1</td><td>1</td><td>4</td><td>8</td>"));
  assert(html.includes("<td>1</td><td>1</td><td>0</td><td>2</td><td>4</td>"));
});
