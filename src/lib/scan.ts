import { categories, type Summary } from "./result-summary";
export type ScanPlayer = { id: string; name: string; side: "home" | "away" };
export type Reading = {
  source?: string;
  text: string;
  playerId: string;
  kind: "double_ones" | "highest_score" | "highest_checkout";
  value: number | null;
};
const norm = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export function identifySheet(text: string) {
  const upper = text.toUpperCase();
  const type = /\bCUP\b/.test(upper)
    ? "cup"
    : /TREBLES|CAPTAINS/.test(upper)
      ? "league"
      : null;
  const date = text.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](20\d{2})\b/);
  return {
    type,
    date: date
      ? `${date[3]}-${date[2].padStart(2, "0")}-${date[1].padStart(2, "0")}`
      : null,
  };
}
export function suggestReadings(
  text: string,
  players: ScanPlayer[],
  kind: Reading["kind"],
): Reading[] {
  const rows: Reading[] = [];
  for (const line of text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (
      /DOUBLE\s*1\s*FINISH|HIGHEST\s*(SCORE|OUT|CHECKOUT)|PLAYER.?S?\s*NAME/i.test(
        line,
      )
    )
      continue;
    const normal = norm(line);
    const hits = players.flatMap((p) => {
      const name = norm(p.name);
      if (!name) return [];
      const count = (normal.match(new RegExp("\\b" + name + "\\b", "g")) ?? [])
        .length;
      return count ? [{ p, count }] : [];
    });
    const unique = hits.length === 1;
    const count = kind === "double_ones" && unique ? hits[0].count : 1;
    const nums = line.match(/\b\d{1,3}\b/g)?.map(Number) ?? [];
    for (let i = 0; i < count; i++)
      rows.push({
        text: line,
        playerId: unique ? hits[0].p.id : "",
        kind,
        value:
          kind === "double_ones"
            ? 1
            : nums.length === 1 &&
                nums[0] > 0 &&
                nums[0] <= (kind === "highest_score" ? 180 : 170)
              ? nums[0]
              : null,
      });
  }
  return rows;
}
export function readingsSummary(
  readings: Reading[],
  players: ScanPlayer[],
  current: Summary,
  rawText: string,
): Summary {
  const entries = new Map<string, Summary["achievements"][number]>();
  for (const row of readings) {
    const p = players.find((p) => p.id === row.playerId);
    const max =
      row.kind === "double_ones"
        ? 999
        : row.kind === "highest_score"
          ? 180
          : 170;
    if (
      !p ||
      !Number.isInteger(row.value) ||
      row.value! < 1 ||
      row.value! > max
    )
      throw new Error(
        "Choose a player and valid value for every reading, or remove incorrect rows.",
      );
    const e = entries.get(p.id) ?? {
      player_id: p.id,
      side: p.side,
      double_ones: 0,
      highest_score: null,
      highest_checkout: null,
    };
    if (row.kind === "double_ones") e.double_ones += row.value!;
    else if (row.kind === "highest_score") {
      e.recorded_scores = [...(e.recorded_scores ?? []), row.value!];
      e.highest_score = Math.max(e.highest_score ?? 0, row.value!);
    } else {
      e.recorded_checkouts = [...(e.recorded_checkouts ?? []), row.value!];
      e.highest_checkout = Math.max(e.highest_checkout ?? 0, row.value!);
    }
    if (e.double_ones > 999) throw new Error("Double 1 count is too large.");
    entries.set(p.id, e);
  }
  return {
    ...current,
    achievements: [...entries.values()],
    pending_achievements: [],
    ocr_review: {
      text: rawText.slice(0, 50000),
      reviewed_at: new Date().toISOString(),
    },
  };
}
export function suggestedCounts(text: string, cup: boolean): Summary["counts"] {
  return Object.fromEntries(
    categories(cup).map(([kind, max]) => {
      const line = text
        .split("\n")
        .find((l) => l.toLowerCase().startsWith(kind.toLowerCase()));
      const match = line?.match(/(\d+)\s*[-–:]\s*(\d+)/);
      return [
        kind,
        match && Number(match[1]) + Number(match[2]) === max
          ? Number(match[1])
          : null,
      ];
    }),
  );
}
