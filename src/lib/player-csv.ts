import Papa from "papaparse";
export type CsvPlayer = { name: string; team: string; notes: string };
export type TeamOption = { id: string; name: string };
export type ExistingPlayer = { name: string; team_id?: string | null };
export const normalise = (s: string) =>
  s.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB");
export function parsePlayersCsv(text: string): CsvPlayer[] {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t"],
  });
  if (parsed.errors.length)
    throw new Error(
      "Could not read this CSV. Check its quotes and separators, then save as CSV again.",
    );
  const [raw, ...data] = parsed.data;
  if (!raw) throw new Error("This CSV is empty.");
  const headers = raw.map(normalise);
  const name = headers.findIndex((h) =>
    ["name", "player", "player name"].includes(h),
  );
  const team = headers.findIndex((h) => ["team", "team name"].includes(h));
  const notes = headers.indexOf("notes");
  if (name < 0 || team < 0 || new Set(headers).size !== headers.length)
    throw new Error(
      "Use one name column and one team column, with optional notes.",
    );
  if (!data.length || data.length > 500)
    throw new Error("Upload between 1 and 500 players at a time.");
  if (data.some((row) => row.length !== raw.length))
    throw new Error(
      "Every row must have the same number of columns as the heading.",
    );
  return data.map((row) => ({
    name: row[name].trim(),
    team: row[team].trim(),
    notes: notes < 0 ? "" : row[notes].trim().slice(0, 500),
  }));
}
export function assessPlayers(
  rows: CsvPlayer[],
  teams: TeamOption[],
  existing: ExistingPlayer[],
) {
  const seen = new Set(
    existing.map((p) => `${p.team_id}\0${normalise(p.name)}`),
  );
  return rows.map((row) => {
    const candidates = teams.filter(
      (t) => normalise(t.name) === normalise(row.team),
    );
    const team = candidates.length === 1 ? candidates[0] : undefined;
    const error =
      !row.name || row.name.length > 100 || /[\x00-\x1f]/.test(row.name)
        ? "Enter a player name of 1–100 characters."
        : !team
          ? "Choose an existing team. Create missing teams first."
          : "";
    const key = `${team?.id}\0${normalise(row.name)}`;
    const duplicate = !error && seen.has(key);
    if (!error) seen.add(key);
    return {
      ...row,
      team_id: team?.id,
      status: error
        ? ("error" as const)
        : duplicate
          ? ("duplicate" as const)
          : ("new" as const),
      issue: error,
    };
  });
}
