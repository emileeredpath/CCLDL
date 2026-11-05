import type { WeeklyMatch } from "@/lib/weekly-results";
import { longDate } from "@/lib/weekly-results";

/** Shareable image of one round's matches. Sized 1080px wide for phones. */
export default function WeeklyResults({
  season,
  date,
  label,
  matches,
  bye,
  demo,
}: {
  season: string;
  date: string;
  label: string;
  matches: WeeklyMatch[];
  bye: string[];
  demo: boolean;
}) {
  const pending = matches.filter((m) => m.homeWins === null).length;
  return (
    <div className="wr">
      <header className="wr-head">
        <img className="wr-crest" src="/ccldl-crest.png" alt="" />
        <div>
          <p className="wr-league">Chelmsford City Ladies Darts League</p>
          <h1>Weekly results</h1>
          <p className="wr-round">
            <span>{label}</span> {longDate(date)}
          </p>
        </div>
      </header>

      {matches.length ? (
        <div className="wr-matches">
          {matches.map((m) => {
            const done = m.homeWins !== null && m.awayWins !== null;
            const homeWon = done && m.homeWins! > m.awayWins!;
            const awayWon = done && m.awayWins! > m.homeWins!;
            const draw = done && m.homeWins === m.awayWins;
            return (
              <section className="wr-match" key={m.fixtureId}>
                {label.includes("catch-up") || label.startsWith("Catch-up") ? (
                  <p className="wr-comp">
                    {m.competition === "cup" ? "Cup" : "League"}
                  </p>
                ) : null}
                <div className="wr-line">
                  <span className={`wr-team ${homeWon ? "won" : ""}`}>
                    {m.home}
                  </span>
                  {done ? (
                    <span className={`wr-score ${draw ? "draw" : ""}`}>
                      {m.homeWins}
                      <i>–</i>
                      {m.awayWins}
                    </span>
                  ) : (
                    <span className="wr-score pending">To follow</span>
                  )}
                  <span className={`wr-team away ${awayWon ? "won" : ""}`}>
                    {m.away}
                  </span>
                </div>
                {draw && <p className="wr-note">Match drawn</p>}
                {m.sections.length > 0 && (
                  <div className="wr-sections">
                    {m.sections.map((s) => (
                      <div className="wr-section" key={s.name}>
                        <span className="wr-section-name">{s.short}</span>
                        <span className="wr-section-score">
                          <b className={s.home > s.away ? "win" : ""}>
                            {s.home}
                          </b>
                          <i>–</i>
                          <b className={s.away > s.home ? "win" : ""}>
                            {s.away}
                          </b>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <p className="wr-empty">No fixtures on this date.</p>
      )}

      {bye.length > 0 && (
        <p className="wr-bye">
          Bye this week: <strong>{bye.join(", ")}</strong>
        </p>
      )}

      <footer className="wr-foot">
        {matches.some((m) => m.sections.length) && (
          <p>
            Section scores are home – away. The winning side is shown in pink.
          </p>
        )}
        {pending > 0 && (
          <p>
            {pending === 1 ? "1 result is" : `${pending} results are`} still to
            be confirmed.
          </p>
        )}
        <p className="wr-brand">
          {season} season{demo ? " · FICTIONAL DEMONSTRATION" : ""}
        </p>
      </footer>
    </div>
  );
}
