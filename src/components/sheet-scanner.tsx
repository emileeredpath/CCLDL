"use client";
import { useEffect, useRef, useState } from "react";
import type { Worker } from "tesseract.js";
import {
  extractSheet,
  type ScanPlayer,
  type ScanSuggestion,
  type SheetScan,
} from "@/lib/scan-sheet";
export default function SheetScanner({
  file,
  roster,
  counts,
  onApply,
}: {
  file: File;
  roster: ScanPlayer[];
  counts: number[];
  onApply: (suggestions: ScanSuggestion[]) => void;
}) {
  const [running, setRunning] = useState(false),
    [status, setStatus] = useState(""),
    [scan, setScan] = useState<SheetScan | null>(null),
    [checked, setChecked] = useState(false),
    [error, setError] = useState("");
  const active = useRef(0);
  const worker = useRef<Worker | null>(null);
  useEffect(
    () => () => {
      active.current++;
      void worker.current?.terminate();
      worker.current = null;
    },
    [file],
  );
  function cancel() {
    active.current++;
    void worker.current?.terminate();
    worker.current = null;
    setRunning(false);
    setStatus("Scan cancelled. Your entries are unchanged.");
  }
  async function read() {
    const run = ++active.current;
    setRunning(true);
    setScan(null);
    setError("");
    setChecked(false);
    setStatus("Loading free scanner…");
    let engine: Worker | null = null;
    let bitmap: ImageBitmap | null = null;
    const timeout = window.setTimeout(() => {
      if (active.current === run) {
        cancel();
        setError(
          "Scanning took too long. Try a smaller, clearer image, or enter the result manually.",
        );
      }
    }, 120000);
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 10485760
      )
        throw new Error("Choose a JPEG, PNG or WebP image up to 10 MB.");
      bitmap = await createImageBitmap(file);
      if (active.current !== run) return;
      // Cap decoded pixels before passing to OCR, to limit phone memory usage.
      const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error(
          "This browser cannot prepare the image. Please enter the result manually.",
        );
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      bitmap = null;
      const { createWorker, OEM, PSM } = await import("tesseract.js");
      if (active.current !== run) return;
      engine = await createWorker("eng", OEM.LSTM_ONLY, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr",
        langPath: "/ocr",
        workerBlobURL: false,
        cacheMethod: "none",
        logger: (m) => {
          if (active.current === run)
            setStatus(
              m.status === "recognizing text"
                ? `Reading photograph… ${Math.round(m.progress * 100)}%`
                : "Loading free scanner…",
            );
        },
      });
      if (active.current !== run) return;
      worker.current = engine;
      await engine.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
      const { data } = await engine.recognize(
        canvas,
        {},
        { text: true, blocks: true },
      );
      if (active.current !== run) return;
      const words = (data.blocks ?? []).flatMap((b) =>
        b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
      );
      setScan(extractSheet(words, data.text, roster, counts));
      setStatus("Scan complete. Review the photo and suggestions below.");
    } catch (e) {
      if (active.current === run)
        setError(
          e instanceof Error
            ? e.message
            : "The scanner could not read this photo. Try again or enter it manually.",
        );
    } finally {
      clearTimeout(timeout);
      bitmap?.close();
      if (engine) {
        await engine.terminate().catch(() => {});
        if (worker.current === engine) worker.current = null;
      }
      if (active.current === run) setRunning(false);
    }
  }
  return (
    <section className="scanner" aria-label="Free photo scanner">
      <h3>Free photo scanner · experimental</h3>
      <p className="muted">
        Reads on this device. No photo is sent to an OCR service and there is no
        per-scan fee. Handwriting often needs manual correction. Keep the whole
        sheet straight, upright and well lit.
      </p>
      <div className="actions">
        <button className="secondary" disabled={running} onClick={read}>
          {scan ? "Scan photo again" : "Scan photo for free"}
        </button>
        {running && (
          <button className="secondary" onClick={cancel}>
            Cancel scan
          </button>
        )}
      </div>
      <p className="muted" role="status" aria-live="polite">
        {status}
      </p>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {scan && (
        <>
          <div className="notice">
            {scan.warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
          {scan.suggestions.map((s) => (
            <div className="game" key={s.number}>
              <strong>Game {s.number}</strong>
              <p className="muted">
                Winner: {s.winner ?? "Not recognised"}
                <br />
                Home players:{" "}
                {s.homePlayers
                  .map((id) => roster.find((p) => p.id === id)?.name)
                  .join(", ") || "Check manually"}
                <br />
                Away players:{" "}
                {s.awayPlayers
                  .map((id) => roster.find((p) => p.id === id)?.name)
                  .join(", ") || "Check manually"}
              </p>
            </div>
          ))}
          <details>
            <summary>Show recognised text (may contain mistakes)</summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                fontSize: 13,
              }}
            >
              {scan.text.trim() || "No text recognised."}
            </pre>
          </details>
          {scan.suggestions.length > 0 && (
            <>
              <label className="scan-confirm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                I checked these suggestions against the selected fixture and
                original photograph.
              </label>
              <button
                className="secondary"
                disabled={!checked}
                onClick={() => {
                  onApply(scan.suggestions);
                  setScan(null);
                  setChecked(false);
                  setStatus(
                    "Suggestions added to empty fields. Check all 12 games and enter player statistics before approving.",
                  );
                }}
              >
                Fill empty fields with checked suggestions
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
