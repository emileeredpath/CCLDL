import { categoryStandings } from "@/lib/result-summary";
import { positions, standings, type Result } from "@/lib/standings";
import { rankedStats, type PlayerStat } from "@/lib/player-statistics";
import { longDate, type WeeklyMatch } from "@/lib/weekly-results";

/** Shared top band for the weekly images: crest, league name, title. */
export function ImageHeader({
  title,
  sub,
  tag,
}: {
  title: string;
  sub: string;
  tag: string;
}) {
  return (
    <header className="si-band">
      <img className="si-crest" src="/ccldl-crest.png" alt="" />
      <div>
        <p className="si-league">Chelmsford City Ladies Darts League</p>
        <h1>{title}</h1>
        <p className="si-sub">{sub}</p>
      </div>
      <span className="si-tag">{tag}</span>
    </header>
  );
}

export function ImageFooter({
  note,
  season,
  demo,
}: {
  note?: string;
  season: string;
  demo: boolean;
}) {
  return (
    <footer className="si-foot">
      {note && <p>{note}</p>}
      <p className="si-brand">
        {season} season{demo ? " · FICTIONAL DEMONSTRATION" : ""}
      </p>
    </footer>
  );
}

const sections = [
  ["Pairs", "Pairs"],
  ["Trebles", "Trebles"],
  ["Captains & vice", "C&V"],
  ["Singles", "Singles"],
] as const;

/** Image 2 of 3: the League table with section totals. */
export function LeagueImage({
  results,
  season,
  week,
  teamNames,
  roundText,
  demo,
}: {
  results: Result[];
  season: string;
  week: string;
  teamNames: string[];
  roundText: string;
  demo: boolean;
}) {
  const rows = positions(standings(results, "league", week, season, teamNames));
  const totals = sections.map(
    ([kind]) =>
      new Map(
        categoryStandings(results, kind, season, week).map((r) => [
          r.name,
          r.value,
        ]),
      ),
  );
  return (
    <div className="si">
      <ImageHeader
        title="League table"
        sub={`The Gail Wander Trophy · ${roundText}`}
        tag="2 of 3"
      />
      <div className="si-body">
        <div className="si-card">
          <table className="si-table si-league-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Team</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                {sections.map(([, short]) => (
                  <th className="cat" key={short}>
                    {short}
                  </th>
                ))}
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.team}
                  className={r.played && r.rank === 1 ? "top" : ""}
                >
                  <td className="pos">{r.played ? r.label : "–"}</td>
                  <td className="team">{r.team}</td>
                  <td>{r.played}</td>
                  <td>{r.won}</td>
                  <td>{r.drawn}</td>
                  <td>{r.lost}</td>
                  {totals.map((t, i) => (
                    <td className="cat" key={sections[i][0]}>
                      {t.get(r.team) ?? (r.played ? "–" : 0)}
                    </td>
                  ))}
                  <td className="pts">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="si-empty">No teams registered for this season yet.</p>
          )}
        </div>
      </div>
      <ImageFooter
        note="Points are games won (Pairs + Trebles + Captains & Vice + Singles). Teams level on points share a position."
        season={season}
        demo={demo}
      />
    </div>
  );
}

const awardList = [
  ["score", "Highest score", "Lorraine Hudson Trophy"],
  ["checkout", "Highest checkout", "Season best"],
  ["d1", "Most Double 1s", "The Pitt Stop Madhouse Trophy"],
] as const;

/** Image 3 of 3: the Cup table and the three Top 5 player awards. */
export function CupAwardsImage({
  results,
  stats,
  season,
  week,
  teamNames,
  roundText,
  demo,
}: {
  results: Result[];
  stats: PlayerStat[];
  season: string;
  week: string;
  teamNames: string[];
  roundText: string;
  demo: boolean;
}) {
  const rows = positions(standings(results, "cup", week, season, teamNames));
  return (
    <div className="si">
      <ImageHeader
        title="Cup & player awards"
        sub={`Glad's Trophy & season leaders · ${roundText}`}
        tag="3 of 3"
      />
      <div className="si-body">
        <div className="si-card">
          <h2>Cup table</h2>
          <p className="si-note">Win 2 · Draw 1 · Loss 0</p>
          <table className="si-table si-cup-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Team</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>Legs</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.team}
                  className={r.played && r.rank === 1 ? "top" : ""}
                >
                  <td className="pos">{r.played ? r.label : "–"}</td>
                  <td className="team">{r.team}</td>
                  <td>{r.played}</td>
                  <td>{r.won}</td>
                  <td>{r.drawn}</td>
                  <td>{r.lost}</td>
                  <td>
                    {r.gamesFor}–{r.gamesAgainst}
                  </td>
                  <td className="pts">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="si-awards">
          {awardList.map(([key, title, trophy]) => {
            const ranked = rankedStats(stats, key, 5);
            const [lead, ...rest] = ranked;
            return (
              <section className="si-award" key={key}>
                <h3>{title}</h3>
                <p className="si-trophy">{trophy}</p>
                {lead ? (
                  <>
                    <div className="si-lead">
                      <span className="v">{lead[key]}</span>
                      <span className="n">
                        {lead.name}
                        <small>
                          {lead.team || "–"}
                          {lead.joint ? " · joint 1st" : ""}
                        </small>
                      </span>
                    </div>
                    <ol>
                      {rest.map((p) => (
                        <li key={p.id}>
                          <span>
                            <b>{p.rank}</b> {p.name}
                          </span>
                          <span>{p[key]}</span>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <p className="si-empty">No statistics recorded yet.</p>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <ImageFooter
        note="Top five players · Double 1s count League finishes only (Rule 16)"
        season={season}
        demo={demo}
      />
    </div>
  );
}

/**
 * The single weekly image: League and Cup tables, the three Top 5 awards
 * and this week's results, in one 1080 x 1350 picture.
 */
export function AllInOneImage({
  results,
  stats,
  season,
  week,
  teamNames,
  matches,
  roundLabel,
  roundDate,
  demo,
}: {
  results: Result[];
  stats: PlayerStat[];
  season: string;
  week: string;
  teamNames: string[];
  matches: WeeklyMatch[];
  roundLabel: string;
  roundDate: string;
  demo: boolean;
}) {
  const league = positions(
    standings(results, "league", week, season, teamNames),
  );
  const cup = positions(standings(results, "cup", week, season, teamNames));
  const totals = sections.map(
    ([kind]) =>
      new Map(
        categoryStandings(results, kind, season, week).map((r) => [
          r.name,
          r.value,
        ]),
      ),
  );
  return (
    <div className="ai">
      <header className="ai-band">
        <img className="ai-crest" src="/ccldl-crest.png" alt="" />
        <div>
          <p className="si-league">Chelmsford City Ladies Darts League</p>
          <h1>Weekly standings</h1>
          <p className="ai-sub">
            {season} season · through {longDate(week)}
          </p>
        </div>
      </header>
      <div className="ai-body">
        <div className="ai-tables">
          <div className="ai-card">
            <h2>
              League table <small>The Gail Wander Trophy</small>
            </h2>
            <table className="ai-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Team</th>
                  <th>P</th>
                  <th>W</th>
                  <th>D</th>
                  <th>L</th>
                  <th className="cat">Pairs</th>
                  <th className="cat">Treb</th>
                  <th className="cat">C&amp;V</th>
                  <th className="cat">Sing</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {league.map((r) => (
                  <tr
                    key={r.team}
                    className={r.played && r.rank === 1 ? "top" : ""}
                  >
                    <td className="pos">{r.label}</td>
                    <td className="team">{r.team}</td>
                    <td>{r.played}</td>
                    <td>{r.won}</td>
                    <td>{r.drawn}</td>
                    <td>{r.lost}</td>
                    {totals.map((t, i) => (
                      <td className="cat" key={sections[i][0]}>
                        {t.get(r.team) ?? (r.played ? "–" : 0)}
                      </td>
                    ))}
                    <td className="pts">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ai-card">
            <h2>
              Cup table <small>Win 2 · Draw 1 · Loss 0</small>
            </h2>
            <table className="ai-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Team</th>
                  <th>P</th>
                  <th>W</th>
                  <th>D</th>
                  <th>L</th>
                  <th>Legs</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {cup.map((r) => (
                  <tr
                    key={r.team}
                    className={r.played && r.rank === 1 ? "top" : ""}
                  >
                    <td className="pos">{r.label}</td>
                    <td className="team">{r.team}</td>
                    <td>{r.played}</td>
                    <td>{r.won}</td>
                    <td>{r.drawn}</td>
                    <td>{r.lost}</td>
                    <td>
                      {r.gamesFor}–{r.gamesAgainst}
                    </td>
                    <td className="pts">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="ai-awards">
          {awardList.map(([key, title, trophy]) => {
            const ranked = rankedStats(stats, key, 5);
            return (
              <section className="ai-card ai-award" key={key}>
                <h3>{title}</h3>
                <p className="ai-trophy">{trophy}</p>
                {ranked.length ? (
                  <ol>
                    {ranked.map((p, i) => (
                      <li key={p.id} className={i === 0 ? "lead" : ""}>
                        <b>{p.rank}</b>
                        <span>
                          {p.name}
                          <small>{p.team || "–"}</small>
                        </span>
                        <span className="v">{p[key]}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="si-empty">No statistics recorded yet.</p>
                )}
              </section>
            );
          })}
        </div>
        <div className="ai-card ai-results">
          <h2>
            This week&apos;s results{" "}
            <small>
              {roundLabel} · {longDate(roundDate)}
            </small>
          </h2>
          {matches.length ? (
            <div className="ai-grid">
              {matches.map((m) => {
                const done = m.homeWins !== null && m.awayWins !== null;
                return (
                  <div className="ai-m" key={m.fixtureId}>
                    <span
                      className={done && m.homeWins! > m.awayWins! ? "won" : ""}
                    >
                      {m.home}
                    </span>
                    <i className={done ? "" : "pending"}>
                      {done ? `${m.homeWins} – ${m.awayWins}` : "To follow"}
                    </i>
                    <span
                      className={`away ${done && m.awayWins! > m.homeWins! ? "won" : ""}`}
                    >
                      {m.away}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="si-empty">No fixtures this week.</p>
          )}
        </div>
      </div>
      <footer className="ai-foot">
        <p>
          Points are games won · Teams level on points share a position · Legs =
          for–against · Winners in bold · Double 1s count League finishes only
        </p>
        <p className="si-brand">
          Chelmsford City Ladies Darts League · {season}
          {demo ? " · FICTIONAL DEMONSTRATION" : ""}
        </p>
      </footer>
    </div>
  );
}

export type RoundResults = {
  date: string;
  label: string;
  matches: WeeklyMatch[];
};

/** Rounds per "Results so far" image: two columns of five. */
export const ROUNDS_PER_PAGE = 10;

/** "Results so far": every round to date in date order, in pages of ten. */
export function ResultsSoFarImage({
  season,
  week,
  rounds,
  page,
  pages,
  demo,
}: {
  season: string;
  week: string;
  rounds: RoundResults[];
  page: number;
  pages: number;
  demo: boolean;
}) {
  return (
    <div className="ai rs">
      <header className="ai-band">
        <img className="ai-crest" src="/ccldl-crest.png" alt="" />
        <div>
          <p className="si-league">Chelmsford City Ladies Darts League</p>
          <h1>Results so far</h1>
          <p className="ai-sub">
            {season} season · through {longDate(week)}
          </p>
        </div>
        {pages > 1 && (
          <span className="si-tag">
            {page} of {pages}
          </span>
        )}
      </header>
      <div className="ai-body">
        {rounds.length ? (
          <div className="rs-grid">
            {rounds.map((r) => (
              <section className="ai-card rs-round" key={r.date}>
                <h2>
                  {r.label}
                  <small>{longDate(r.date).replace(/^\w+ /, "")}</small>
                </h2>
                <ul>
                  {r.matches.map((m) => {
                    const done = m.homeWins !== null && m.awayWins !== null;
                    return (
                      <li key={m.fixtureId}>
                        <span
                          className={
                            done && m.homeWins! > m.awayWins! ? "won" : ""
                          }
                        >
                          {m.home}
                        </span>
                        <i className={done ? "" : "pending"}>
                          {done ? `${m.homeWins}–${m.awayWins}` : "TBC"}
                        </i>
                        <span
                          className={`away ${done && m.awayWins! > m.homeWins! ? "won" : ""}`}
                        >
                          {m.away}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="si-empty">No matches played yet this season.</p>
        )}
      </div>
      <footer className="ai-foot">
        <p>
          In date order · Winners in bold · TBC = result not yet confirmed
        </p>
        <p className="si-brand">
          Chelmsford City Ladies Darts League · {season}
          {demo ? " · FICTIONAL DEMONSTRATION" : ""}
        </p>
      </footer>
    </div>
  );
}
