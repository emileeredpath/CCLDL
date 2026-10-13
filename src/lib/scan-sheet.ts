/** Conservative extraction for the GAME / NAME / RES / NAME / RES paper layout.
 * OCR is untrusted. Do not infer missing scores from totals or guess fuzzy names.
 */
export type ScanWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};
export type ScanPlayer = { id: string; name: string; side: "home" | "away" };
export type ScanSuggestion = {
  number: number;
  winner?: "home" | "away";
  homePlayers: string[];
  awayPlayers: string[];
};
export type SheetScan = {
  text: string;
  suggestions: ScanSuggestion[];
  warnings: string[];
};
const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const cx = (w: ScanWord) => (w.bbox.x0 + w.bbox.x1) / 2;
const cy = (w: ScanWord) => (w.bbox.y0 + w.bbox.y1) / 2;
export function extractSheet(
  words: ScanWord[],
  text: string,
  roster: ScanPlayer[],
  counts: number[],
): SheetScan {
  const result: SheetScan = {
    text,
    suggestions: [],
    warnings: [
      "Check every suggestion against the original. Handwriting can be wrong even when OCR is confident. Double 1s, highest scores and checkouts must be entered manually.",
    ],
  };
  const headers = words.filter((w) => clean(w.text) === "game");
  let layout: ScanWord[] | undefined;
  for (const game of headers) {
    const height = game.bbox.y1 - game.bbox.y0;
    const row = words
      .filter(
        (w) =>
          Math.abs(cy(w) - cy(game)) < height * 1.5 &&
          cx(w) >= cx(game) &&
          ["game", "name", "res"].includes(clean(w.text)),
      )
      .sort((a, b) => cx(a) - cx(b));
    if (row.map((w) => clean(w.text)).join(",") === "game,name,res,name,res") {
      layout = row;
      break;
    }
  }
  if (!layout) {
    result.warnings.push(
      "Table headings could not be recognised. No games were filled. Use the text below as a reference or enter the sheet manually.",
    );
    return result;
  }
  const [gameHeader, , homeRes, , awayRes] = layout;
  const gameWidth = gameHeader.bbox.x1 - gameHeader.bbox.x0;
  const anchors = words
    .filter(
      (w) =>
        /^([1-9]|1[0-2])$/.test(w.text.trim()) &&
        w.confidence >= 60 &&
        cy(w) > cy(gameHeader) &&
        Math.abs(cx(w) - cx(gameHeader)) < gameWidth * 0.7,
    )
    .sort((a, b) => cy(a) - cy(b));
  // Require a complete ordered set: partial detection must never shift game numbers.
  if (
    anchors.length !== 12 ||
    anchors.some((w, i) => Number(w.text) !== i + 1)
  ) {
    result.warnings.push(
      "All 12 game numbers could not be located in order. No game suggestions were made; try a straight, well-lit photo showing the whole table.",
    );
    return result;
  }
  const hWidth = Math.max(12, (homeRes.bbox.x1 - homeRes.bbox.x0) * 0.8);
  const aWidth = Math.max(12, (awayRes.bbox.x1 - awayRes.bbox.x0) * 0.8);
  const findPlayers = (
    row: ScanWord[],
    side: "home" | "away",
    expected: number,
  ) => {
    const zone = row.filter((w) =>
      side === "home"
        ? cx(w) > cx(gameHeader) + gameWidth && cx(w) < cx(homeRes) - hWidth
        : cx(w) > cx(homeRes) + hWidth && cx(w) < cx(awayRes) - aWidth,
    );
    const lines: ScanWord[][] = [];
    for (const word of zone.sort((a, b) => cy(a) - cy(b) || cx(a) - cx(b))) {
      const line = lines.find(
        (l) =>
          Math.abs(cy(l[0]) - cy(word)) <
          Math.max(5, (word.bbox.y1 - word.bbox.y0) * 0.6),
      );
      if (line) line.push(word);
      else lines.push([word]);
    }
    const ids: string[] = [];
    for (const line of lines) {
      if (line.some((w) => w.confidence < 60)) continue;
      const name = clean(
        line
          .sort((a, b) => cx(a) - cx(b))
          .map((w) => w.text)
          .join(" "),
      ).replace(/^\d+ /, "");
      const matches = roster.filter(
        (p) => p.side === side && clean(p.name) === name,
      );
      if (matches.length === 1 && !ids.includes(matches[0].id))
        ids.push(matches[0].id);
    }
    return ids.length === expected ? ids : [];
  };
  for (let i = 0; i < 12; i++) {
    const top =
      anchors[i].bbox.y0 - (anchors[i].bbox.y1 - anchors[i].bbox.y0) * 0.4;
    const bottom =
      i < 11
        ? anchors[i + 1].bbox.y0 -
          (anchors[i + 1].bbox.y1 - anchors[i + 1].bbox.y0) * 0.4
        : anchors[i].bbox.y1 + (anchors[i].bbox.y1 - anchors[i].bbox.y0) * 0.7;
    const row = words.filter((w) => cy(w) >= top && cy(w) < bottom);
    const readScore = (header: ScanWord, width: number) => {
      const cells = row.filter((w) => Math.abs(cx(w) - cx(header)) < width);
      return cells.length === 1 &&
        cells[0].confidence >= 75 &&
        /^[01]$/.test(cells[0].text.trim())
        ? Number(cells[0].text)
        : null;
    };
    const home = readScore(homeRes, hWidth),
      away = readScore(awayRes, aWidth);
    const suggestion: ScanSuggestion = {
      number: i + 1,
      homePlayers: findPlayers(row, "home", counts[i]),
      awayPlayers: findPlayers(row, "away", counts[i]),
    };
    if (home !== null && away !== null && home + away === 1)
      suggestion.winner = home === 1 ? "home" : "away";
    if (
      suggestion.winner ||
      suggestion.homePlayers.length ||
      suggestion.awayPlayers.length
    )
      result.suggestions.push(suggestion);
  }
  if (!result.suggestions.length)
    result.warnings.push(
      "No reliable game fields were recognised. Your existing entries have been kept.",
    );
  return result;
}
export type EditableGame = {
  number: number;
  winner: string;
  players: { player_id: string; side: "home" | "away" }[];
};
export function fillEmptyGames<T extends EditableGame>(
  games: T[],
  suggestions: ScanSuggestion[],
): T[] {
  return games.map((game) => {
    const suggestion = suggestions.find((s) => s.number === game.number);
    if (!suggestion) return game;
    // Keep any partially entered side intact to avoid shifting or duplicating players.
    const available = (side: "home" | "away") =>
      game.players.filter((p) => p.side === side).every((p) => !p.player_id);
    let h = 0,
      a = 0;
    return {
      ...game,
      winner: game.winner || suggestion.winner || "",
      players: game.players.map((p) => {
        const id =
          p.side === "home"
            ? suggestion.homePlayers[h++]
            : suggestion.awayPlayers[a++];
        return { ...p, player_id: available(p.side) && id ? id : p.player_id };
      }),
    };
  });
}
