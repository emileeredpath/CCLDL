import { categoryStandings } from "@/lib/result-summary";
import { standings, type Result } from "@/lib/standings";
export type PosterStat = {
  name: string;
  d1: number;
  score: number;
  checkout: number;
};
function Block({
  title,
  subtitle,
  rows,
  highlight = true,
}: {
  title: string;
  subtitle?: string;
  highlight?: boolean;
  rows: { name: string; value: number }[];
}) {
  return (
    <section className="poster-block">
      <h2>
        {title}
        {subtitle && <small>{subtitle}</small>}
      </h2>
      {rows.length ? (
        <table>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.name}
                className={
                  highlight && r.value === rows[0]?.value ? "leader" : ""
                }
              >
                <td>{r.name}</td>
                <td>{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No results recorded</p>
      )}
    </section>
  );
}
export default function WeeklyPoster({
  results,
  stats,
  season,
  week,
  competition,
  incomplete,
  demo,
}: {
  results: Result[];
  stats: PosterStat[];
  season: string;
  week: string;
  competition: "league" | "cup";
  incomplete: number;
  demo: boolean;
}) {
  const league = standings(results, "league", week, season);
  const cup = standings(results, "cup", week, season);
  const statRows = (key: "d1" | "score" | "checkout") =>
    stats
      .filter((s) => s[key] > 0)
      .sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name))
      .map((s) => ({ name: s.name, value: s[key] }));
  const categoryRows = (kind: string) =>
    categoryStandings(results, kind, season, week);
  const missing = results.some(
    (r) =>
      r.approved &&
      r.season === season &&
      r.competition === "league" &&
      r.date <= week &&
      !r.breakdown,
  );
  return (
    <>
      <header className="poster-header">
        <h1>CHELMSFORD LADIES DARTS LEAGUE</h1>
        <p>
          Season{" "}
          {season.includes("/")
            ? season.split("/")[0] +
              " – " +
              season.split("/")[0].slice(0, 2) +
              season.split("/")[1]
            : season}{" "}
          · Current standings
        </p>
        <small>
          Through {new Date(week + "T12:00:00").toLocaleDateString("en-GB")} ·
          Player statistics: {competition}
          {demo ? " · FICTIONAL DEMONSTRATION" : ""}
        </small>
      </header>
      <section className="poster-league">
        <div className="poster-league-title"><span>LEAGUE TABLE</span><h2>The Gail Wander Trophy</h2><small>Overall league points</small></div>
        {league.length ? <table>
          <thead><tr><th>Team</th><th>Played</th><th>Total points</th></tr></thead>
          <tbody>{league.map((r) => <tr key={r.team} className={r.gamesFor === league[0]?.gamesFor ? "leader" : ""}><td>{r.team}</td><td>{r.played}</td><td>{r.gamesFor}</td></tr>)}</tbody>
        </table> : <p>No approved league results recorded</p>}
      </section>
      <div className="poster-grid">
        {["Singles", "Pairs", "Trebles"].map((k) => <Block key={k} title={k} rows={categoryRows(k)} />)}
        <Block title="Leigh Barnes Trophy" subtitle="Captains & vice" rows={categoryRows("Captains & vice")} />
        <Block title="Lorraine Hudson Trophy" subtitle="Highest Score" rows={statRows("score")} />
        <Block title="Highest Checkout" rows={statRows("checkout")} />
        <Block title="The Pitt Stop Madhouse Trophy" subtitle="Double 1 finishes" rows={statRows("d1")} />
        <Block highlight={false} title="Cup" subtitle="Games won · scoring rules awaiting confirmation" rows={cup.map((r) => ({ name: r.team, value: r.gamesFor }))} />
      </div>
      <footer>
        {incomplete
          ? `INCOMPLETE: ${incomplete} scheduled matches still need approved results.`
          : "All entered fixtures through this date have results."}
        {missing
          ? " Some results have no category breakdown; category totals are incomplete."
          : ""}
        <br />
        Equal totals are tied. Cup displayed alphabetically. CCLDL
      </footer>
    </>
  );
}
