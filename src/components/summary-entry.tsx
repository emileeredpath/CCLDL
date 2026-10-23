"use client";
import { useState } from "react";
import PlayerPicker from "./player-picker";
import { categories, resolvePending, type Summary } from "@/lib/result-summary";
export default function SummaryEntry({
  value,
  onChange,
  cup,
  home,
  away,
  players,
  readOnly = false,
  createPlayer,
}: {
  value: Summary;
  onChange: (v: Summary) => void;
  cup: boolean;
  home: string;
  away: string;
  players: { id: string; name: string; side: "home" | "away" }[];
  readOnly?: boolean;
  createPlayer?: (
    name: string,
    side: "home" | "away",
  ) => Promise<{ id: string; name: string; side: "home" | "away" }>;
}) {
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [rowKeys, setRowKeys] = useState(() =>
    value.achievements.map(() => crypto.randomUUID()),
  );
  const complete = categories(cup).every(([k]) => value.counts[k] !== null);
  const total = Object.values(value.counts).reduce<number>(
    (a, b) => a + (b ?? 0),
    0,
  );
  return (
    <fieldset disabled={savingPlayer} className="summary-fieldset">
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
      {value.notes && <p className="notice">{value.notes}</p>}
      {value.ocr_review && (
        <details>
          <summary>Reviewed OCR transcription</summary>
          <pre style={{ whiteSpace: "pre-wrap" }}>{value.ocr_review.text}</pre>
        </details>
      )}
      {value.pending_achievements?.map((pending, index) => (
        <div className="notice" key={`${pending.name}:${index}`}>
          <strong>Player to confirm: {pending.name}</strong>
          <p>
            {pending.note} · {pending.side === "home" ? home : away} ·{" "}
            {pending.double_ones} Double 1s
          </p>
          {!readOnly && (
            <PlayerPicker
              label={`Resolve ${pending.name}`}
              initialQuery={pending.name}
              value=""
              teamNames={{ home, away }}
              options={players.filter((p) => p.side === pending.side)}
              onChange={(id) => {
                if (!id) return;
                const player = players.find((p) => p.id === id);
                if (!player) return;
                setRowKeys((keys) =>
                  value.achievements.some((p) => p.player_id === id)
                    ? keys
                    : [...keys, crypto.randomUUID()],
                );
                onChange(resolvePending(value, index, id, player.side));
              }}
              onCreate={
                createPlayer
                  ? async (name, side) => {
                      if (side !== pending.side)
                        throw new Error(
                          "Choose the team recorded on the sheet.",
                        );
                      setSavingPlayer(true);
                      try {
                        const player = await createPlayer(name, side);
                        setRowKeys((keys) =>
                          value.achievements.some(
                            (p) => p.player_id === player.id,
                          )
                            ? keys
                            : [...keys, crypto.randomUUID()],
                        );
                        onChange(resolvePending(value, index, player.id, side));
                      } finally {
                        setSavingPlayer(false);
                      }
                    }
                  : undefined
              }
            />
          )}
        </div>
      ))}
      {value.achievements.map((p, i) => (
        <div className="achievement" key={rowKeys[i] ?? i}>
          {readOnly ? (
            <strong>
              {players.find((x) => x.id === p.player_id)?.name} ·{" "}
              {p.side === "home" ? home : away}
            </strong>
          ) : (
            <PlayerPicker
              label={`Achievement player ${i + 1}`}
              value={p.player_id}
              teamNames={{ home, away }}
              onCreate={
                createPlayer
                  ? async (name, side) => {
                      setSavingPlayer(true);
                      try {
                        const saved = await createPlayer(name, side);
                        if (
                          value.achievements.some(
                            (a, j) => j !== i && a.player_id === saved.id,
                          )
                        )
                          throw new Error(
                            "This player already has an achievement row. Use that row instead.",
                          );
                        onChange({
                          ...value,
                          achievements: value.achievements.map((a, j) =>
                            j === i
                              ? { ...a, player_id: saved.id, side: saved.side }
                              : a,
                          ),
                        });
                      } finally {
                        setSavingPlayer(false);
                      }
                    }
                  : undefined
              }
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
                          recorded_scores: a.player_id
                            ? undefined
                            : a.recorded_scores,
                          recorded_checkouts: a.player_id
                            ? undefined
                            : a.recorded_checkouts,
                          side:
                            players.find((x) => x.id === id)?.side ?? "home",
                          double_ones: a.player_id ? 0 : a.double_ones,
                          highest_score: a.player_id ? null : a.highest_score,
                          highest_checkout: a.player_id
                            ? null
                            : a.highest_checkout,
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
                  readOnly={
                    readOnly ||
                    (key === "highest_score"
                      ? Boolean(p.recorded_scores?.length)
                      : key === "highest_checkout"
                        ? Boolean(p.recorded_checkouts?.length)
                        : false)
                  }
                  type="number"
                  inputMode="numeric"
                  min={key === "double_ones" ? 0 : 1}
                  max={[999, 180, 170][j]}
                  value={
                    key === "double_ones" && p[key] === 0 ? "" : (p[key] ?? "")
                  }
                  placeholder={key === "double_ones" ? "0" : undefined}
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
          {(
            [
              ["recorded_scores", "highest_score", "scores", 180],
              ["recorded_checkouts", "highest_checkout", "checkouts", 170],
            ] as const
          ).map(([records, best, label, max]) => (
            <details key={records}>
              <summary>
                All recorded {label} ({p[records]?.length ?? (p[best] ? 1 : 0)})
              </summary>
              {(p[records] ?? (p[best] ? [p[best]!] : [])).map((n, j) => (
                <div className="actions" key={j}>
                  <label>
                    {label} reading {j + 1}
                    <input
                      readOnly={readOnly}
                      type="number"
                      min={1}
                      max={max}
                      value={n || ""}
                      onChange={(e) => {
                        const values = [...(p[records] ?? [p[best]!])];
                        values[j] = Number(e.target.value);
                        onChange({
                          ...value,
                          achievements: value.achievements.map((a, k) =>
                            k === i
                              ? {
                                  ...a,
                                  [records]: values,
                                  [best]: Math.max(...values) || null,
                                }
                              : a,
                          ),
                        });
                      }}
                    />
                  </label>
                  {!readOnly && (
                    <button
                      className="secondary"
                      onClick={() => {
                        const values = (p[records] ?? [p[best]!]).filter(
                          (_, k) => k !== j,
                        );
                        onChange({
                          ...value,
                          achievements: value.achievements.map((a, k) =>
                            k === i
                              ? {
                                  ...a,
                                  [records]: values,
                                  [best]: Math.max(0, ...values) || null,
                                }
                              : a,
                          ),
                        });
                      }}
                    >
                      Remove reading
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
                      achievements: value.achievements.map((a, k) =>
                        k === i
                          ? {
                              ...a,
                              [records]: [
                                ...(a[records] ?? (a[best] ? [a[best]!] : [])),
                                0,
                              ],
                            }
                          : a,
                      ),
                    })
                  }
                >
                  Add another {label === "scores" ? "score" : "checkout"}
                </button>
              )}
            </details>
          ))}
          {!readOnly && (
            <button
              className="secondary"
              onClick={() => {
                setRowKeys((keys) => keys.filter((_, j) => j !== i));
                onChange({
                  ...value,
                  achievements: value.achievements.filter((_, j) => j !== i),
                });
              }}
            >
              Remove player
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button
          className="secondary"
          onClick={() => {
            setRowKeys((keys) => [...keys, crypto.randomUUID()]);
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
            });
          }}
        >
          + Add player achievement
        </button>
      )}
      {readOnly && !value.achievements.length && (
        <p>No player achievements recorded.</p>
      )}
    </fieldset>
  );
}
