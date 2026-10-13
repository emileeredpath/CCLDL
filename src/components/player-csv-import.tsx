"use client";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  parsePlayersCsv,
  assessPlayers,
  type CsvPlayer,
  type TeamOption,
  type ExistingPlayer,
} from "@/lib/player-csv";
export default function PlayerCsvImport({
  teams,
  players,
  enabled,
  reload,
}: {
  teams: TeamOption[];
  players: ExistingPlayer[];
  enabled: boolean;
  reload: () => Promise<void>;
}) {
  const [rows, setRows] = useState<CsvPlayer[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const readId = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const checked = assessPlayers(rows, teams, players);
  const additions = checked.filter((r) => r.status === "new");
  const errors = checked.some((r) => r.status === "error");
  const duplicates = checked.filter((r) => r.status === "duplicate").length;
  async function read(file?: File) {
    const id = ++readId.current;
    setRows([]);
    setConfirmed(false);
    setMessage("");
    if (!file) return;
    try {
      if (file.size > 1048576)
        throw new Error("Choose a CSV smaller than 1 MB.");
      const text = await file.text();
      if (readId.current !== id) return;
      setRows(parsePlayersCsv(text));
    } catch (e) {
      if (readId.current === id)
        setMessage(e instanceof Error ? e.message : "Could not read the file.");
    }
  }
  function change(index: number, key: "name" | "team", value: string) {
    setConfirmed(false);
    setRows((rs) =>
      rs.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    );
  }
  async function save() {
    const client = supabase();
    if (!client || !enabled || !confirmed || busy || errors) return;
    setBusy(true);
    setMessage("");
    try {
      const [currentTeams, currentPlayers] = await Promise.all([
        client.from("teams").select("id,name"),
        client.from("players").select("name,team_id"),
      ]);
      if (currentTeams.error) throw currentTeams.error;
      if (currentPlayers.error) throw currentPlayers.error;
      const fresh = assessPlayers(
        rows,
        currentTeams.data ?? [],
        currentPlayers.data ?? [],
      );
      if (fresh.some((r) => r.status === "error"))
        throw new Error(
          "The team list has changed. Refresh the page and review this file again.",
        );
      const pending = fresh
        .filter((r) => r.status === "new")
        .map((r) => ({ name: r.name.trim(), team_id: r.team_id! }));
      if (pending.length) {
        const { error } = await client.from("players").insert(pending);
        if (error) throw error;
      }
      setRows([]);
      setConfirmed(false);
      if (input.current) input.current.value = "";
      setMessage(
        `Imported ${pending.length} players. Skipped ${fresh.length - pending.length} duplicates.`,
      );
      await reload();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Import failed. No successful import was confirmed; refresh before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="csv-import" aria-label="Import players">
      <h3>Upload players from CSV</h3>
      <p className="muted">
        Use columns <strong>name, team</strong> (optional: notes). Team names
        must match teams already added. Review and correct the names below
        before importing. Existing names on the same team are skipped.
      </p>
      <a href="/templates/players.csv" download>
        Download blank CSV template
      </a>
      <label>
        Player CSV file
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => void read(e.target.files?.[0])}
        />
      </label>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {rows.length > 0 && (
        <>
          <p className="notice">
            {additions.length} new players · {duplicates} duplicates skipped
            {errors ? " · Correct highlighted rows before importing." : ""}
          </p>
          {checked.map((row, i) => (
            <div key={i} className="csv-player">
              <div className="fields">
                <label>
                  Row {i + 1} player name
                  <input
                    value={row.name}
                    maxLength={100}
                    disabled={busy}
                    onChange={(e) => change(i, "name", e.target.value)}
                  />
                </label>
                <label>
                  Row {i + 1} team
                  <select
                    value={row.team}
                    disabled={busy}
                    onChange={(e) => change(i, "team", e.target.value)}
                  >
                    {!teams.some((t) => t.name === row.team) && (
                      <option value={row.team}>
                        {row.team || "Choose a team"}
                      </option>
                    )}
                    {teams.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {row.notes && <p className="notice">Check: {row.notes}</p>}
              <p className="muted">
                {row.status === "error"
                  ? row.issue
                  : row.status === "duplicate"
                    ? "Already listed — will be skipped."
                    : "Ready to add."}
              </p>
            </div>
          ))}
          <label className="import-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I have checked the player names, teams and any handwriting notes.
          </label>
          <div className="actions">
            <button
              className="primary"
              disabled={
                !enabled || busy || !confirmed || errors || !additions.length
              }
              onClick={save}
            >
              {busy ? "Importing…" : `Import ${additions.length} players`}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setRows([]);
                setConfirmed(false);
                if (input.current) input.current.value = "";
              }}
            >
              Cancel import
            </button>
          </div>
          {!enabled && (
            <p className="muted">
              Demonstration only: preview is available, saving is disabled.
            </p>
          )}
        </>
      )}
    </section>
  );
}
