import { categories } from "@/lib/result-summary";
import type { Result } from "@/lib/standings";
export default function MatchSummary({
  fixture,
  result,
  players,
  onEdit,
  onPhoto,
  photos,
  disabled,
}: {
  fixture: { date: string; home: string; away: string; competition: string };
  result?: Result;
  players: { id: string; name: string }[];
  onEdit: () => void;
  onPhoto: (id: string) => void;
  photos: { id: string }[];
  disabled: boolean;
}) {
  const achievements =
    result?.summary?.achievements ?? result?.achievements ?? [];
  return (
    <div className="card match-summary">
      <span className="eyebrow">
        {new Date(fixture.date + "T12:00:00").toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}{" "}
        · {fixture.competition}
      </span>
      <h2>
        {fixture.home} v {fixture.away}
      </h2>
      <p className="match-score">
        {result
          ? `${result.homeWins} – ${result.awayWins}`
          : "Result not entered"}
      </p>
      <p className="badge">
        {result?.approved
          ? "Saved & approved"
          : result
            ? "Saved draft · not yet included in standings"
            : "Awaiting result"}
      </p>
      {result && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Games won</th>
                  <th>{fixture.home}</th>
                  <th>{fixture.away}</th>
                </tr>
              </thead>
              <tbody>
                {categories(fixture.competition === "cup").map(
                  ([kind, max]) => (
                    <tr key={kind}>
                      <td>{kind}</td>
                      <td>{result.breakdown?.[kind] ?? "—"}</td>
                      <td>
                        {result.breakdown?.[kind] === undefined
                          ? "—"
                          : max - result.breakdown[kind]}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <h3>Player achievements</h3>
          {achievements
            .filter(
              (p) => p.double_ones || p.highest_score || p.highest_checkout,
            )
            .map((p) => (
              <div className="result-row" key={p.player_id}>
                <div>
                  <strong>
                    {players.find((x) => x.id === p.player_id)?.name ??
                      "Unknown player"}
                  </strong>
                  <p className="muted">
                    {p.side === "home" ? fixture.home : fixture.away}
                  </p>
                  <p>
                    Double 1s: {p.double_ones} · Highest score:{" "}
                    {p.highest_score ?? "—"} · Checkout:{" "}
                    {p.highest_checkout ?? "—"}
                  </p>
                  {p.recorded_scores?.length && (
                    <p className="muted">
                      Recorded scores: {p.recorded_scores.join(", ")}
                    </p>
                  )}
                  {p.recorded_checkouts?.length && (
                    <p className="muted">
                      Recorded checkouts: {p.recorded_checkouts.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          {!achievements.some(
            (p) => p.double_ones || p.highest_score || p.highest_checkout,
          ) && <p className="muted">No player achievements recorded.</p>}
          {result.summary?.pending_achievements?.map((p, i) => (
            <p className="notice" key={i}>
              Needs checking: {p.name} (
              {p.side === "home" ? fixture.home : fixture.away}) · Double 1s:{" "}
              {p.double_ones}. {p.note}
            </p>
          ))}
          {result.summary?.notes && (
            <p className="notice">{result.summary.notes}</p>
          )}
        </>
      )}
      <div className="actions">
        <button className="primary" onClick={onEdit} disabled={disabled}>
          {result
            ? result.approved
              ? "Edit result"
              : "Finish & approve result"
            : "Add result"}
        </button>
        {photos.map((p, i) => (
          <button
            className="secondary"
            key={p.id}
            onClick={() => onPhoto(p.id)}
          >
            View original {i + 1}
          </button>
        ))}
      </div>
      {!photos.length && (
        <p className="muted">No original photograph saved yet.</p>
      )}
    </div>
  );
}
