"use client";
import { useEffect, useId, useRef, useState } from "react";
type Player = { id: string; name: string; recent?: boolean };
export default function PlayerPicker({
  label,
  value,
  options,
  onChange,
  onCreate,
  teamNames,
  initialQuery = "",
}: {
  label: string;
  value: string;
  options: Player[];
  onChange: (id: string) => void;
  onCreate?: (name: string, side: "home" | "away") => Promise<void>;
  teamNames?: { home: string; away: string };
  initialQuery?: string;
}) {
  const id = useId();
  const [side, setSide] = useState<"" | "home" | "away">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = options.find((p) => p.id === value);
  const [query, setQuery] = useState(selected?.name ?? initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const last = useRef(value);
  useEffect(() => {
    if (last.current !== value) {
      setQuery(options.find((p) => p.id === value)?.name ?? "");
      last.current = value;
    }
  }, [value, options]);
  const matches = options
    .filter((p) =>
      p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
    .slice(0, 20);
  function choose(player: Player) {
    last.current = player.id;
    setQuery(player.name);
    onChange(player.id);
    setOpen(false);
    setActive(-1);
  }
  return (
    <div
      className="player-picker"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <input
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={
          open && active >= 0 ? `${id}-${active}` : undefined
        }
        autoComplete="off"
        placeholder="Type a player’s name…"
        value={query}
        onFocus={() => {
          setOpen(true);
          setActive(-1);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
          if (value) {
            last.current = "";
            onChange("");
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            if (matches[active]) choose(matches[active]);
            else if (matches.length === 1) choose(matches[0]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul id={id} role="listbox" aria-label={`${label} suggestions`}>
          {matches.map((p, i) => (
            <li key={p.id} role="presentation">
              <button
                type="button"
                role="option"
                id={`${id}-${i}`}
                aria-selected={active === i}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(p)}
              >
                {p.name}
                {p.recent && <small>Used earlier</small>}
              </button>
            </li>
          ))}
          {!matches.length && (
            <li className="muted">
              No matching players. Add a new player below, or use More → Teams &
              players.
            </li>
          )}
        </ul>
      )}
      {query && !value && (
        <span className="muted" style={{ fontSize: 11 }}>
          {onCreate
            ? "Choose a suggestion, or add this name to a team below."
            : "Choose a saved player from the suggestions."}
        </span>
      )}
      {onCreate && teamNames && query.trim() && !value && (
        <div className="inline-player-create">
          <label>
            New player's team
            <select
              aria-label={`${label} new team`}
              value={side}
              disabled={saving}
              onChange={(e) => setSide(e.target.value as "home" | "away" | "")}
            >
              <option value="">Choose team</option>
              <option value="home">{teamNames.home}</option>
              <option value="away">{teamNames.away}</option>
            </select>
          </label>
          <button
            type="button"
            className="secondary"
            disabled={!side || saving || query.trim().length > 100}
            onClick={async () => {
              if (!side) return;
              setSaving(true);
              setOpen(false);
              setError("");
              try {
                await onCreate(query.trim(), side);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not save player. Please try again.",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving player…" : "Add player to team"}
          </button>
          {error && (
            <p role="alert" className="notice">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
