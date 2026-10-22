import type { EntryPlayer } from "./manual-entry";
export type Summary = {
  ocr_review?: { text: string; reviewed_at: string };
  counts: Record<string, number | null>;
  achievements: EntryPlayer[];
  notes?: string;
  pending_achievements?: (Omit<EntryPlayer, "player_id"> & {
    name: string;
    note: string;
  })[];
};
export const categories = (cup: boolean) =>
  cup
    ? ([["Singles", 12]] as const)
    : ([
        ["Pairs", 3],
        ["Trebles", 2],
        ["Captains & vice", 1],
        ["Singles", 6],
      ] as const);
export const emptySummary = (cup: boolean): Summary => ({
  counts: Object.fromEntries(categories(cup).map(([k]) => [k, null])),
  achievements: [],
});
export function summaryValid(s: Summary, cup: boolean) {
  return (
    !s.pending_achievements?.length &&
    categories(cup).every(
      ([k, max]) =>
        Number.isInteger(s.counts[k]) &&
        s.counts[k]! >= 0 &&
        s.counts[k]! <= max,
    ) &&
    new Set(s.achievements.map((p) => p.player_id)).size ===
      s.achievements.length &&
    s.achievements.every(
      (p) =>
        p.player_id &&
        ["home", "away"].includes(p.side) &&
        Number.isInteger(p.double_ones) &&
        p.double_ones >= 0 &&
        p.double_ones <= 999 &&
        [p.highest_score, p.highest_checkout].every(
          (n, i) =>
            n === null ||
            (Number.isInteger(n) && n > 0 && n <= (i === 0 ? 180 : 170)),
        ) &&
        [p.recorded_scores, p.recorded_checkouts].every(
          (values, i) =>
            values === undefined ||
            (Array.isArray(values) &&
              values.every(
                (n) =>
                  Number.isInteger(n) && n > 0 && n <= (i === 0 ? 180 : 170),
              )),
        ) &&
        (p.double_ones > 0 ||
          p.highest_score !== null ||
          p.highest_checkout !== null),
    )
  );
}

export function categoryStandings(
  results: import("./standings").Result[],
  kind: string,
  season: string,
  cutoff: string,
) {
  const totals = new Map<string, number>();
  const maximum = categories(false).find(([k]) => k === kind)?.[1];
  if (maximum === undefined) return [];
  for (const r of results.filter(
    (r) =>
      r.approved &&
      r.season === season &&
      r.competition === "league" &&
      r.date <= cutoff &&
      r.breakdown,
  )) {
    const home = r.breakdown![kind];
    if (!Number.isInteger(home) || home < 0 || home > maximum) continue;
    totals.set(r.home, (totals.get(r.home) ?? 0) + home);
    totals.set(r.away, (totals.get(r.away) ?? 0) + maximum - home);
  }
  return [...totals]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

export function resolvePending(
  summary: Summary,
  index: number,
  playerId: string,
  side: "home" | "away",
): Summary {
  const pending = summary.pending_achievements?.[index];
  if (!pending || !playerId || pending.side !== side)
    throw new Error("Choose a player from the recorded team.");
  const existing = summary.achievements.find((p) => p.player_id === playerId);
  const entry: EntryPlayer = {
    player_id: playerId,
    side,
    double_ones: (existing?.double_ones ?? 0) + pending.double_ones,
    highest_score:
      Math.max(existing?.highest_score ?? 0, pending.highest_score ?? 0) ||
      null,
    highest_checkout:
      Math.max(
        existing?.highest_checkout ?? 0,
        pending.highest_checkout ?? 0,
      ) || null,
  };
  return {
    ...summary,
    achievements: [
      ...summary.achievements.filter((p) => p.player_id !== playerId),
      entry,
    ],
    pending_achievements: summary.pending_achievements!.filter(
      (_, i) => i !== index,
    ),
  };
}
