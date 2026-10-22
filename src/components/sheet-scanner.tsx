"use client";
import { useEffect, useRef, useState } from "react";
import type { Worker } from "tesseract.js";
import {
  identifySheet,
  suggestReadings,
  readingsSummary,
  suggestedCounts,
  type Reading,
  type ScanPlayer,
} from "@/lib/scan";
import type { Summary } from "@/lib/result-summary";
import PlayerPicker from "./player-picker";
export default function SheetScanner({
  file,
  fixture,
  cup,
  home,
  away,
  date,
  disabled,
  onApply,
  players,
  current,
}: {
  file: File | null;
  fixture: string;
  cup: boolean;
  home: string;
  away: string;
  date: string;
  disabled: boolean;
  onApply: (summary: Summary) => void;
  players: ScanPlayer[];
  current: Summary;
}) {
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [rows, setRows] = useState<Reading[]>([]),
    [checked, setChecked] = useState(false),
    [confidence, setConfidence] = useState<number | null>(null),
    [mode, setMode] = useState<"whole" | Reading["kind"]>("whole");
  const [crop, setCrop] = useState({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
  });
  const source = JSON.stringify({ mode, crop });
  const canvas = useRef<HTMLCanvasElement>(null),
    worker = useRef<Worker | null>(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      void worker.current?.terminate();
    },
    [],
  );
  useEffect(() => {
    if (!file || !canvas.current) return;
    let cancelled = false;
    createImageBitmap(file)
      .then((bitmap) => {
        if (cancelled) {
          bitmap.close();
          return;
        }
        const c = canvas.current;
        if (!c) {
          bitmap.close();
          return;
        }
        const sx = (bitmap.width * crop.left) / 100,
          sy = (bitmap.height * crop.top) / 100,
          sw = (bitmap.width * Math.min(crop.width, 100 - crop.left)) / 100,
          sh = (bitmap.height * Math.min(crop.height, 100 - crop.top)) / 100;
        const scale = Math.min(1, 2200 / Math.max(sw, sh));
        c.width = Math.max(1, Math.round(sw * scale));
        c.height = Math.max(1, Math.round(sh * scale));
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, c.width, c.height);
        }
        bitmap.close();
      })
      .catch(() =>
        setError(
          "This photo cannot be read by this browser. Use JPEG, PNG or WebP.",
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [file, crop]);
  async function run() {
    if (!file || busy || !canvas.current) return;
    const runId = ++generation.current;
    setBusy(true);
    setError("");
    setChecked(false);
    let active: Worker | null = null;
    try {
      const { createWorker } = await import("tesseract.js");
      const w = await createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr",
        langPath: "/ocr",
        cacheMethod: "none",
        logger: (m) => {
          if (runId === generation.current)
            setProgress(`${m.status} ${Math.round(m.progress * 100)}%`);
        },
      });
      if (runId !== generation.current) {
        await w.terminate();
        return;
      }
      worker.current = w;
      active = w;
      const result = await w.recognize(canvas.current);
      if (runId !== generation.current) return;
      setText(result.data.text);
      setConfidence(result.data.confidence);
      if (mode !== "whole")
        setRows((old) => [
          ...old.filter((r) => r.source !== source),
          ...suggestReadings(result.data.text, players, mode).map((r) => ({
            ...r,
            source,
          })),
        ]);
    } catch {
      if (runId === generation.current)
        setError(
          "OCR did not finish. You can still enter or type the readings manually.",
        );
    } finally {
      await active?.terminate();
      if (worker.current === active) worker.current = null;
      if (runId === generation.current) setBusy(false);
    }
  }
  const detected = identifySheet(text);
  return (
    <section className="scanner-panel" aria-label="Free local scanner">
      <h3>Free photo reader · review required</h3>
      <p className="muted">
        Runs on your device. No AI service, API key or subscription. Handwriting
        and crossed-out entries may be missed: compare every reading with the
        original, including margin notes.
      </p>
      <fieldset disabled={busy || disabled}>
        <label>
          Read area
          <select
            value={mode}
            onChange={(e) => {
              const m = e.target.value as typeof mode;
              setMode(m);
              setCrop(
                m === "double_ones"
                  ? { left: 72, top: 20, width: 28, height: 55 }
                  : { left: 0, top: 0, width: 100, height: 100 },
              );
            }}
          >
            <option value="whole">Whole sheet — identify and read text</option>
            <option value="double_ones">
              Double 1 column — each name is one finish
            </option>
            <option value="highest_score">Highest scores / margin notes</option>
            <option value="highest_checkout">
              Highest checkouts / margin notes
            </option>
          </select>
        </label>
        <details>
          <summary>Adjust crop to match your photograph</summary>
          <div className="fields">
            {(["left", "top", "width", "height"] as const).map((key) => (
              <label key={key}>
                {key} (%)
                <input
                  type="number"
                  min={key === "left" || key === "top" ? 0 : 1}
                  max={key === "left" || key === "top" ? 99 : 100}
                  value={crop[key]}
                  onChange={(e) =>
                    setCrop((c) => ({
                      ...c,
                      [key]: Math.max(
                        key === "left" || key === "top" ? 0 : 1,
                        Math.min(
                          key === "left" || key === "top" ? 99 : 100,
                          Number(e.target.value),
                        ),
                      ),
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </details>
        {file && (
          <canvas
            ref={canvas}
            className="ocr-preview"
            aria-label="Area to read"
          />
        )}
        <button
          className="secondary"
          type="button"
          disabled={!file}
          onClick={run}
        >
          Read selected area
        </button>
      </fieldset>
      {busy && (
        <p role="status">
          {progress}
          <button
            className="secondary"
            onClick={() => {
              generation.current++;
              void worker.current?.terminate();
              worker.current = null;
              setBusy(false);
            }}
          >
            Cancel scan
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {confidence !== null && (
        <p className="notice">
          OCR confidence {Math.round(confidence)}% — this is not a handwriting
          accuracy guarantee. Review every field.
        </p>
      )}
      <p className="muted">
        Selected: {home} v {away} · {date} · {cup ? "Cup" : "League"}.{" "}
        {detected.type
          ? `Detected ${detected.type} sheet.`
          : "Sheet type not identified."}{" "}
        {detected.date && `Date read: ${detected.date}.`}
      </p>
      {detected.type && detected.type !== (cup ? "cup" : "league") && (
        <p className="notice">
          Sheet type differs from the fixture. Choose the correct fixture before
          applying.
        </p>
      )}
      <details open={Boolean(text)}>
        <summary>Recognised text — correct or type missing readings</summary>
        <textarea
          className="ocr-text"
          aria-label="Recognised text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setChecked(false);
          }}
        />
        {mode !== "whole" && (
          <button
            className="secondary"
            disabled={busy || disabled || !text.trim()}
            onClick={() => {
              setRows((old) => [
                ...old.filter((r) => r.source !== source),
                ...suggestReadings(text, players, mode).map((r) => ({
                  ...r,
                  source,
                })),
              ]);
              setChecked(false);
            }}
          >
            Update suggestions from this text
          </button>
        )}
      </details>
      <p className="muted">
        Check repeated names separately. Reading the same area again replaces
        its suggestions. Scan output does not identify crossed-out entries
        reliably.
      </p>
      {rows.map((row, i) => (
        <div className="ocr-reading" key={i}>
          <p>{row.text || "Manual reading"}</p>
          <PlayerPicker
            label={`Reading ${i + 1} player`}
            value={row.playerId}
            options={players}
            teamNames={{ home, away }}
            onChange={(id) => {
              setRows((rs) =>
                rs.map((r, j) => (j === i ? { ...r, playerId: id } : r)),
              );
              setChecked(false);
            }}
          />
          <div className="fields">
            <label>
              Statistic
              <select
                value={row.kind}
                onChange={(e) => {
                  setRows((rs) =>
                    rs.map((r, j) =>
                      j === i
                        ? { ...r, kind: e.target.value as Reading["kind"] }
                        : r,
                    ),
                  );
                  setChecked(false);
                }}
              >
                <option value="double_ones">Double 1 finishes</option>
                <option value="highest_score">Score</option>
                <option value="highest_checkout">Checkout</option>
              </select>
            </label>
            <label>
              Value
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max={
                  row.kind === "double_ones"
                    ? 999
                    : row.kind === "highest_score"
                      ? 180
                      : 170
                }
                value={row.value ?? ""}
                onChange={(e) => {
                  setRows((rs) =>
                    rs.map((r, j) =>
                      j === i
                        ? {
                            ...r,
                            value:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          }
                        : r,
                    ),
                  );
                  setChecked(false);
                }}
              />
            </label>
          </div>
          <button
            className="secondary"
            onClick={() => {
              setRows((rs) => rs.filter((_, j) => j !== i));
              setChecked(false);
            }}
          >
            Remove reading
          </button>
        </div>
      ))}
      <button
        className="secondary"
        onClick={() => {
          setRows((rs) => [
            ...rs,
            { text: "", playerId: "", kind: "double_ones", value: 1 },
          ]);
          setChecked(false);
        }}
      >
        Add missing reading
      </button>
      <label className="import-confirm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        I checked the fixture, every reading, repeated names, crossed-out
        writing and margin notes against the photo.
      </label>
      <button
        className="primary"
        disabled={
          !checked ||
          busy ||
          disabled ||
          Boolean(detected.type && detected.type !== (cup ? "cup" : "league"))
        }
        onClick={() => {
          try {
            const next = readingsSummary(rows, players, current, text);
            const counts = suggestedCounts(text, cup);
            for (const [k, v] of Object.entries(counts))
              if (next.counts[k] === null && v !== null)
                next.counts = { ...next.counts, [k]: v };
            if (
              window.confirm(
                "Replace the achievement entries in this form with these checked readings? Existing saved results are unchanged until you approve.",
              )
            ) {
              onApply(next);
              setRows([]);
              setChecked(false);
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : "Check the readings.");
          }
        }}
      >
        Use checked readings in form
      </button>
      <p className="muted">
        Home wins remain editable below; away wins calculate automatically.
        Applying readings does not save or approve a result.
      </p>
    </section>
  );
}
