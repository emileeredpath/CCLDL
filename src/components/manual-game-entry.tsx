"use client";
import {
  reuseLineup,
  gameComplete,
  type EntryGame,
  type EntryPlayer,
} from "@/lib/manual-entry";
type RosterPlayer = { id: string; name: string; side: EntryPlayer["side"] };
export default function ManualGameEntry({
  game,
  previous,
  roster,
  home,
  away,
  onChange,
}: {
  game: EntryGame;
  previous: EntryGame[];
  roster: RosterPlayer[];
  home: string;
  away: string;
  onChange: (game: EntryGame) => void;
}) {
  function changePlayer(index: number, id: string) {
    onChange({
      ...game,
      players: game.players.map((p, i) =>
        i === index && p.player_id !== id
          ? {
              ...p,
              player_id: id,
              double_ones: 0,
              highest_score: null,
              highest_checkout: null,
            }
          : p,
      ),
    });
  }
  return (
    <section className="game manual-game" aria-label={`Game ${game.number}`}>
      <div className="card-head">
        <h3>
          {game.number}. {game.kind}
        </h3>
        <span className="badge">
          {gameComplete(game) ? "Complete" : "To complete"}
        </span>
      </div>
      <div role="group" aria-label="Game winner">
        <p className="muted">Tap the winning team</p>
        <div className="winner-buttons">
          {(["home", "away"] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-pressed={game.winner === side}
              className={game.winner === side ? "primary" : "secondary"}
              onClick={() => onChange({ ...game, winner: side })}
            >
              {side === "home" ? home : away}
            </button>
          ))}
        </div>
        {game.winner && (
          <button
            className="clear-winner"
            type="button"
            onClick={() => onChange({ ...game, winner: "" })}
          >
            Clear winner
          </button>
        )}
      </div>
      <div className="lineup-sides">
        {(["home", "away"] as const).map((side) => {
          const team = side === "home" ? home : away;
          const entries = game.players
            .map((p, index) => ({ ...p, index }))
            .filter((p) => p.side === side);
          const available = roster
            .filter((p) => p.side === side)
            .sort((a, b) => a.name.localeCompare(b.name));
          const recentIds = [
            ...new Set(
              [...previous]
                .reverse()
                .flatMap((g) =>
                  g.players
                    .filter((p) => p.side === side && p.player_id)
                    .map((p) => p.player_id),
                ),
            ),
          ];
          const recent = recentIds
            .map((id) => available.find((p) => p.id === id))
            .filter((p): p is RosterPlayer => Boolean(p));
          const sources = previous.filter((g) => {
            const ps = g.players.filter((p) => p.side === side);
            return (
              ps.length === entries.length &&
              ps.every((p) => p.player_id) &&
              new Set(ps.map((p) => p.player_id)).size === ps.length
            );
          });
          return (
            <div className="lineup-side" key={side}>
              <h3>{team}</h3>
              {sources.length > 0 && (
                <label>
                  Reuse {team} players
                  <select
                    aria-label={`Reuse ${side} lineup`}
                    value=""
                    disabled={entries.some((p) => p.player_id)}
                    onChange={(e) => {
                      const source = sources.find(
                        (g) => g.number === Number(e.target.value),
                      );
                      if (source) onChange(reuseLineup(game, source, side));
                    }}
                  >
                    <option value="">Choose an earlier game</option>
                    {sources.map((g) => (
                      <option key={g.number} value={g.number}>
                        Game {g.number}:{" "}
                        {g.players
                          .filter((p) => p.side === side)
                          .map(
                            (p) =>
                              roster.find((r) => r.id === p.player_id)?.name,
                          )
                          .join(" / ")}
                      </option>
                    ))}
                  </select>
                  <span className="muted" style={{ fontSize: 11 }}>
                    Fills a blank lineup only; scores and statistics are not
                    copied.
                  </span>
                </label>
              )}
              {!available.length && (
                <p className="notice">
                  Add players to {team} in Fixtures before completing this
                  result.
                </p>
              )}
              {entries.map((p, slot) => {
                const blocked = (id: string) =>
                  game.players.some(
                    (other, i) => i !== p.index && other.player_id === id,
                  );
                const hasStats =
                  p.double_ones > 0 ||
                  p.highest_score !== null ||
                  p.highest_checkout !== null;
                return (
                  <div className="manual-player" key={p.index}>
                    <label>
                      {team} player {slot + 1}
                      <select
                        aria-label={`${team} player ${slot + 1}`}
                        value={p.player_id}
                        onChange={(e) => changePlayer(p.index, e.target.value)}
                      >
                        <option value="">Select player</option>
                        {recent.length > 0 && (
                          <optgroup label="Used earlier this match">
                            {recent.map((r) => (
                              <option
                                key={r.id}
                                value={r.id}
                                disabled={blocked(r.id)}
                              >
                                {r.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Team roster">
                          {available
                            .filter((r) => !recentIds.includes(r.id))
                            .map((r) => (
                              <option
                                key={r.id}
                                value={r.id}
                                disabled={blocked(r.id)}
                              >
                                {r.name}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                    </label>
                    <details open={hasStats || undefined}>
                      <summary>
                        {hasStats
                          ? "View / edit statistics"
                          : "Add Double 1s, high score or checkout"}
                      </summary>
                      {hasStats && (
                        <p className="muted">
                          Changing the player clears these statistics.
                        </p>
                      )}
                      <div className="player-stats">
                        {(
                          [
                            "double_ones",
                            "highest_score",
                            "highest_checkout",
                          ] as const
                        ).map((key) => (
                          <label key={key}>
                            {key === "double_ones"
                              ? "Double 1s"
                              : key === "highest_score"
                                ? "High score"
                                : "Checkout"}
                            <input
                              type="number"
                              min={0}
                              step={1}
                              max={
                                key === "highest_score"
                                  ? 180
                                  : key === "highest_checkout"
                                    ? 170
                                    : 999
                              }
                              value={p[key] ?? ""}
                              onChange={(e) => {
                                const number =
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value);
                                onChange({
                                  ...game,
                                  players: game.players.map((entry, i) =>
                                    i === p.index
                                      ? {
                                          ...entry,
                                          [key]:
                                            key === "double_ones"
                                              ? (number ?? 0)
                                              : number,
                                        }
                                      : entry,
                                  ),
                                });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
