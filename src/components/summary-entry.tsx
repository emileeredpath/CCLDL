"use client";
import PlayerPicker from "./player-picker";
import { categories, type Summary } from "@/lib/result-summary";
export default function SummaryEntry({
  value,
  onChange,
  cup,
  home,
  away,
  players,
  readOnly = false,
}: {
  value: Summary;
  onChange: (v: Summary) => void;
  cup: boolean;
  home: string;
  away: string;
  players: { id: string; name: string; side: "home" | "away" }[];
  readOnly?: boolean;
}) {
  const complete = categories(cup).every(([k]) => value.counts[k] !== null);
  const total = Object.values(value.counts).reduce<number>(
    (a, b) => a + (b ?? 0),
    0,
  );
  return (
    <>
      <p className="muted">
        Enter games won by {home}. {away} totals fill in automatically.
      </p>
      <div className="score-summary">
        <div className="score-summary-row">
          <strong>Games won</strong>
          <strong>{home}</strong>
          <strong>{away}</strong>
        </div>
        {categories(cup).map(([k, max]) => (
          <div className="score-summary-row" key={k}>
            <span>{k}</span>
            {readOnly ? (
              <strong>{value.counts[k]}</strong>
            ) : (
              <label>
                <span className="sr-only">
                  {home} {k} wins
                </span>
                <select
                  aria-label={`${home} ${k} wins`}
                  value={value.counts[k] ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      counts: {
                        ...value.counts,
                        [k]:
                          e.target.value === "" ? null : Number(e.target.value),
                      },
                    })
                  }
                >
                  <option value="">—</option>
                  {Array.from({ length: max + 1 }, (_, i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </label>
            )}
            <strong>
              {value.counts[k] === null ? "—" : max - value.counts[k]!}
            </strong>
          </div>
        ))}
        <div className="score-summary-row total">
          <strong>Final score</strong>
          <strong>{complete ? total : "—"}</strong>
          <strong>{complete ? 12 - total : "—"}</strong>
        </div>
      </div>
      <h3>Player achievements</h3>
      <p className="muted">
        Only add players with Double 1s, a highest score or a highest checkout.
        Leave unused boxes blank.
      </p>
      {value.achievements.map((p, i) => (
        <div className="achievement" key={i}>
          {readOnly ? (
            <strong>
              {players.find((x) => x.id === p.player_id)?.name} ·{" "}
              {p.side === "home" ? home : away}
            </strong>
          ) : (
            <PlayerPicker
              label={`Achievement player ${i + 1}`}
              value={p.player_id}
              options={players
                .filter(
                  (x) =>
                    x.id === p.player_id ||
                    !value.achievements.some((a) => a.player_id === x.id),
                )
                .map((x) => ({
                  ...x,
                  name: `${x.name} · ${x.side === "home" ? home : away}`,
                }))}
              onChange={(id) =>
                onChange({
                  ...value,
                  achievements: value.achievements.map((a, j) =>
                    j === i
                      ? {
                          player_id: id,
                          side:
                            players.find((x) => x.id === id)?.side ?? "home",
                          double_ones: 0,
                          highest_score: null,
                          highest_checkout: null,
                        }
                      : a,
                  ),
                })
              }
            />
          )}
          <div className="fields">
            {(
              ["double_ones", "highest_score", "highest_checkout"] as const
            ).map((key, j) => (
              <label key={key}>
                {["Double 1s", "Highest score", "Highest checkout"][j]}
                <input
                  readOnly={readOnly}
                  type="number"
                  inputMode="numeric"
                  min={key === "double_ones" ? 0 : 1}
                  max={[999, 180, 170][j]}
                  value={p[key] ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      achievements: value.achievements.map((a, n) =>
                        n === i
                          ? {
                              ...a,
                              [key]:
                                e.target.value === ""
                                  ? key === "double_ones"
                                    ? 0
                                    : null
                                  : Number(e.target.value),
                            }
                          : a,
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
          {!readOnly && (
            <button
              className="secondary"
              onClick={() =>
                onChange({
                  ...value,
                  achievements: value.achievements.filter((_, j) => j !== i),
                })
              }
            >
              Remove player
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button
          className="secondary"
          onClick={() =>
            onChange({
              ...value,
              achievements: [
                ...value.achievements,
                {
                  player_id: "",
                  side: "home",
                  double_ones: 0,
                  highest_score: null,
                  highest_checkout: null,
                },
              ],
            })
          }
        >
          + Add player achievement
        </button>
      )}
      {readOnly && !value.achievements.length && (
        <p>No player achievements recorded.</p>
      )}
    </>
  );
}
