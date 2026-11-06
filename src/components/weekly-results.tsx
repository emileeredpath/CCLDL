import type { WeeklyMatch } from "@/lib/weekly-results";
import { longDate } from "@/lib/weekly-results";
import { ImageFooter, ImageHeader } from "@/components/share-images";

/** Image 1 of 3: one round's matches, scores and section winners. */
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
  const catchUp = label.startsWith("Catch-up") || label.includes("catch-up");
  const notes = [
    matches.some((m) => m.sections.length)
      ? "Section scores are home – away. The section winner is shown in pink."
      : "",
    pending
      ? `${pending === 1 ? "1 result is" : `${pending} results are`} still to be confirmed.`
      : "",
  ].filter(Boolean);
  return (
    <div className="si">
      <ImageHeader
        title="This week's results"
        sub={`${label} · ${longDate(date)}`}
        tag="1 of 3"
      />
      <div className="si-body">
        {matches.length ? (
          matches.map((m) => {
            const done = m.homeWins !== null && m.awayWins !== null;
            const homeWon = done && m.homeWins! > m.awayWins!;
            const awayWon = done && m.awayWins! > m.homeWins!;
            const draw = done && m.homeWins === m.awayWins;
            return (
              <section className="si-card si-match" key={m.fixtureId}>
                {catchUp && (
                  <p className="si-comp">
                    {m.competition === "cup" ? "Cup" : "League"}
                  </p>
                )}
                <div className="si-line">
                  <span className={`si-team ${homeWon ? "won" : ""}`}>
                    {m.home}
                  </span>
                  {done ? (
                    <span className={`si-score ${draw ? "draw" : ""}`}>
                      {m.homeWins}
                      <i>–</i>
                      {m.awayWins}
                    </span>
                  ) : (
                    <span className="si-score pending">To follow</span>
                  )}
                  <span className={`si-team away ${awayWon ? "won" : ""}`}>
                    {m.away}
                  </span>
                </div>
                {draw && <p className="si-draw">Match drawn</p>}
                {m.sections.length > 0 && (
                  <div className="si-sections">
                    {m.sections.map((s) => (
                      <div className="si-section" key={s.name}>
                        <span className="name">{s.short}</span>
                        <span className="val">
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
          })
        ) : (
          <p className="si-empty">No fixtures on this date.</p>
        )}
        {bye.length > 0 && (
          <p className="si-bye">
            Bye this week: <strong>{bye.join(", ")}</strong>
          </p>
        )}
      </div>
      <ImageFooter note={notes.join(" ")} season={season} demo={demo} />
    </div>
  );
}
