import { Target } from "lucide-react";
import { categoryStandings } from "@/lib/result-summary";
import { standings, type Result } from "@/lib/standings";
import { rankedStats, type PlayerStat } from "@/lib/player-statistics";
export type PosterStat = PlayerStat;
export default function WeeklyPoster({
  results,
  stats,
  season,
  week,
  incomplete,
  demo,
  teamNames = [],
  part = "all",
}: {
  results: Result[];
  stats: PosterStat[];
  season: string;
  week: string;
  competition: "league" | "cup";
  incomplete: number;
  demo: boolean;
  teamNames?: string[];
  part?: "all" | "tables" | "players";
}) {
  const kinds = ["Pairs", "Trebles", "Captains & vice", "Singles"];
  const categoryPoints = kinds.map(
    (kind) =>
      new Map(
        categoryStandings(results, kind, season, week).map((r) => [
          r.name,
          r.value,
        ]),
      ),
  );
  return (
    <>
      <header className="poster-header">
        <Target className="poster-emblem" aria-hidden="true" /><div><h1>CHELMSFORD CITY LADIES DARTS LEAGUE</h1>
        <p>{season} WEEKLY STANDINGS</p>
        <small>
          Through {new Date(week + "T12:00:00").toLocaleDateString("en-GB")} ·
          League & Cup combined player statistics
          {demo ? " · FICTIONAL DEMONSTRATION" : ""}
        </small></div><Target className="poster-emblem" aria-hidden="true" />
      </header>
      {part !== "players" && (
        <div className="poster-main-tables">
          {(["league", "cup"] as const).map((comp) => {
            const rows = standings(results, comp, week, season, teamNames);
            return (
              <section className="poster-league" key={comp}>
                <div className="poster-league-title">
                  <span>
                    {comp === "league" ? "LEAGUE TABLE" : "CUP TABLE"}
                  </span>
                  <h2>
                    {comp === "league"
                      ? "The Gail Wander Trophy"
                      : "Win 2 · Draw 1 · Loss 0"}
                  </h2>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>P</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      {comp === "cup" && (
                        <>
                          <th>LF</th>
                          <th>LA</th>
                        </>
                      )}
                      {comp === "league" && (
                        <>
                          <th>Pairs</th>
                          <th>Trebles</th>
                          <th>C&amp;V</th>
                          <th>Singles</th>
                        </>
                      )}
                      <th>Total pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.team}
                        className={
                          r.played > 0 && r.points === rows[0]?.points
                            ? "leader"
                            : ""
                        }
                      >
                        <td>{r.team}</td>
                        <td>{r.played}</td>
                        <td>{r.won}</td>
                        <td>{r.drawn}</td>
                        <td>{r.lost}</td>
                        {comp === "cup" && (
                          <>
                            <td>{r.gamesFor}</td>
                            <td>{r.gamesAgainst}</td>
                          </>
                        )}
                        {comp === "league" &&
                          categoryPoints.map((points, i) => (
                            <td key={kinds[i]}>
                              {points.get(r.team) ?? (r.played ? "—" : 0)}
                            </td>
                          ))}
                        <td>{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!rows.length && (
                  <p>No teams registered for this season yet.</p>
                )}
              </section>
            );
          })}
        </div>
      )}
      {part !== "tables" && (
        <div className="poster-grid">
          {(
            [
              ["score", "Highest score", "Lorraine Hudson Trophy"],
              ["checkout", "Highest checkout", "Season best"],
              ["d1", "Most Double 1s", "The Pitt Stop Madhouse Trophy"],
            ] as const
          ).map(([key, title, trophy]) => (
            <section className={`poster-block poster-stat-${key}`} key={key}>
              <h2>
                {title}
                <small>{trophy} · Top five players</small>
              </h2>
              <table>
                <thead><tr>{key !== "d1" && <th>Pos</th>}<th>Player</th><th>Team</th><th>{key === "score" ? "Score" : key === "checkout" ? "Checkout" : "Total"}</th></tr></thead>
                <tbody>
                  {rankedStats(stats, key, 5).map((p) => (
                    <tr key={p.id}>
                      {key !== "d1" && <td>
                        {p.joint ? "=" : ""}
                        {p.rank}
                      </td>}
                      <td>
                        {p.name}
                      </td>
                      <td className="poster-player-team">{p.team || "—"}</td>
                      <td>{p[key]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!stats.some((s) => s[key] > 0) && (
                <p>No statistics recorded yet.</p>
              )}
            </section>
          ))}
        </div>
      )}
      <footer>
        {incomplete
          ? `INCOMPLETE: ${incomplete} scheduled matches still need approved results.`
          : "All entered fixtures through this date have approved results."}
        <br />P played · W won · D drawn · L lost · LF/LA legs for/against · Pts
        points. C&V captains & vice. — category breakdown not recorded.
        <br />
        Equal points remain tied. Joint player positions use =. Five players per
        list; equal values ordered by name. Full statistics remain in the
        committee dashboard.
      </footer>
    </>
  );
}
