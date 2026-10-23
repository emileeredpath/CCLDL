"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Home,
  CalendarDays,
  Plus,
  BarChart3,
  Menu,
  Target,
  Trophy,
  Image as ImageIcon,
  Download,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Users,
} from "lucide-react";
import {
  playerStatistics,
  rankedStats,
  type PlayerStat,
} from "@/lib/player-statistics";
import { toPng } from "html-to-image";
import { normalise } from "@/lib/player-csv";
import PlayerCsvImport from "@/components/player-csv-import";
import MatchSummary from "@/components/match-summary";
import PosterPreview from "@/components/poster-preview";
import WeeklyPoster from "@/components/weekly-poster";
import SheetScanner from "@/components/sheet-scanner";
import SummaryEntry from "@/components/summary-entry";
import {
  emptySummary,
  summaryValid,
  categories,
  categoryStandings,
  type Summary,
} from "@/lib/result-summary";
import ManualGameEntry from "@/components/manual-game-entry";
import { gameComplete } from "@/lib/manual-entry";
import { supabase } from "@/lib/supabase";
import { demoFixtures, demoResults, demoPlayers } from "@/lib/demo";
import { gameTypes, standings, type Result } from "@/lib/standings";
const client = supabase();
const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
type Screen =
  | "Match summary"
  | "Home"
  | "Fixtures"
  | "Add Result"
  | "Tables"
  | "Teams & players"
  | "Results"
  | "Weekly Overview"
  | "More";
type Fixture = {
  id: string;
  date: string;
  competition: string;
  home: string;
  away: string;
  season?: string;
  season_id?: string;
  home_team_id?: string;
  away_team_id?: string;
};
type Option = { id: string; name: string; team_id?: string };
type PlayerEntry = {
  player_id: string;
  side: "home" | "away";
  double_ones: number;
  highest_score: number | null;
  highest_checkout: number | null;
};
type Game = {
  number: number;
  kind: string;
  winner: string;
  players: PlayerEntry[];
};
type Sheet = {
  id: string;
  fixture_id: string;
  storage_path: string;
  created_at: string;
};
type Stat = PlayerStat;
function dateLabel(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function downloadCSV(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const blob = new Blob(
    [
      "\uFEFF" +
        [
          keys.map(cell).join(","),
          ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
        ].join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8;" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function Table({
  results,
  competition,
  cutoff,
  season,
  breakdown = false,
  full = false,
  teamNames = [],
}: {
  breakdown?: boolean;
  full?: boolean;
  teamNames?: string[];
  results: Result[];
  competition: "league" | "cup";
  cutoff: string;
  season: string;
}) {
  const rows = standings(results, competition, cutoff, season, teamNames);
  const kinds = ["Pairs", "Trebles", "Singles", "Captains & vice"];
  const totals = kinds.map(
    (kind) =>
      new Map(
        categoryStandings(results, kind, season, cutoff).map((r) => [
          r.name,
          r.value,
        ]),
      ),
  );
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Played</th>
              {full && (
                <>
                  <th>Won</th>
                  <th>Drawn</th>
                  <th>Lost</th>
                </>
              )}
              {competition === "cup" && (
                <>
                  <th>Won</th>
                  <th>Drawn</th>
                  <th>Lost</th>
                  <th>Legs for</th>
                  <th>Legs against</th>
                </>
              )}
              {!breakdown && competition === "league" && <th>Lost</th>}
              {breakdown && kinds.map((kind) => <th key={kind}>{kind}</th>)}
              <th>Total points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team}>
                <td style={{ fontWeight: 600 }}>{r.team}</td>
                <td>{r.played}</td>
                {full && (
                  <>
                    <td>{r.won}</td>
                    <td>{r.drawn}</td>
                    <td>{r.lost}</td>
                  </>
                )}
                {competition === "cup" && (
                  <>
                    <td>{r.won}</td>
                    <td>{r.drawn}</td>
                    <td>{r.lost}</td>
                    <td>{r.gamesFor}</td>
                    <td>{r.gamesAgainst}</td>
                  </>
                )}
                {!breakdown && competition === "league" && (
                  <td>{r.gamesAgainst}</td>
                )}
                {breakdown &&
                  kinds.map((kind, i) => (
                    <td key={kind}>{totals[i].get(r.team) ?? "—"}</td>
                  ))}
                <td style={{ color: "var(--pink)", fontWeight: 700 }}>
                  {r.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="empty">
          No approved {competition} results for this period.
        </div>
      )}
      <p className="muted" style={{ fontSize: 11 }}>
        {competition === "league"
          ? "Most points first · Equal points are tied · "
          : "Most points first · Equal points are tied · "}{" "}
        {competition === "league"
          ? "Points = Pairs + Trebles + Singles + Captains & vice."
          : "Cup: win 2 points · draw 1 · loss 0."}
      </p>
    </>
  );
}
export default function Workspace() {
  const [screen, setScreen] = useState<Screen>("Home");
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [seasons, setSeasons] = useState<Option[]>([]);
  const [teams, setTeams] = useState<Option[]>([]);
  const [players, setPlayers] = useState<Option[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const loadSequence = useRef(0);
  const [loadedScope, setLoadedScope] = useState("");
  const [stats, setStats] = useState<Stat[]>([]);
  const [season, setSeason] = useState("2026/27");
  const [competition, setCompetition] = useState<"league" | "cup">("league");
  const [week, setWeek] = useState(new Date().toISOString().slice(0, 10));
  const [fixtureCompetition, setFixtureCompetition] = useState("all");
  const [fixtureSearch, setFixtureSearch] = useState("");
  const [fixtureStatus, setFixtureStatus] = useState("all");
  const [statTab, setStatTab] = useState<"d1" | "score" | "checkout">("d1");
  const [teamFilter, setTeamFilter] = useState("");
  const [archiveDate, setArchiveDate] = useState("");
  const [viewedFixtureId, setViewedFixtureId] = useState("");
  const [resultFixtureSearch, setResultFixtureSearch] = useState("");
  const [fixtureId, setFixtureId] = useState("");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [summary, setSummary] = useState<Summary>(emptySummary(false));
  const [summaryReady, setSummaryReady] = useState(demo);
  const [detailed, setDetailed] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [review, setReview] = useState(false);
  const [archivePreview, setArchivePreview] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [posterPart, setPosterPart] = useState<"all" | "tables" | "players">(
    "all",
  );
  const weeklyRef = useRef<HTMLDivElement>(null);
  const nav: { name: Screen; icon: typeof Home }[] = [
    { name: "Home", icon: Home },
    { name: "Fixtures", icon: CalendarDays },
    { name: "Add Result", icon: Plus },
    { name: "Tables", icon: Trophy },

    { name: "Results", icon: ImageIcon },
    { name: "Weekly Overview", icon: Download },
    { name: "Teams & players", icon: Users },
  ];
  const seasonTeamNames = [
    ...new Set(
      fixtures
        .filter((f) => demo || f.season === season)
        .flatMap((f) => [f.home, f.away]),
    ),
  ];
  const selected = fixtures.find((f) => f.id === fixtureId);
  async function load() {
    if (!client) return;
    const request = ++loadSequence.current;
    const responses = await Promise.all([
      client.from("seasons").select("id,name"),
      client.from("teams").select("id,name"),
      client.from("players").select("id,name,team_id"),
      client.from("fixtures").select("*"),
      client.from("results").select("*, games(*,game_players(*))"),
      client.from("result_sheets").select("*"),
    ]);
    if (request !== loadSequence.current) return;
    const failure = responses.find((r) => r.error);
    if (failure?.error) {
      setMessage(failure.error.message);
      return;
    }
    const capability = await client.from("results").select("summary").limit(0);
    if (request !== loadSequence.current) return;
    setSummaryReady(!capability.error);
    const ss = responses[0].data ?? [];
    const ts = responses[1].data ?? [];
    const ps = responses[2].data ?? [];
    setSeasons(ss);
    setTeams(ts);
    setPlayers(ps);
    const fs: Fixture[] = (responses[3].data ?? []).map((f) => ({
      id: f.id,
      date: f.played_on,
      competition: f.competition,
      home: ts.find((t) => t.id === f.home_team_id)?.name ?? "Unknown team",
      away: ts.find((t) => t.id === f.away_team_id)?.name ?? "Unknown team",
      season: ss.find((s) => s.id === f.season_id)?.name,
      season_id: f.season_id,
      home_team_id: f.home_team_id,
      away_team_id: f.away_team_id,
    }));
    setFixtures(fs);
    const mappedResults: Result[] = (responses[4].data ?? []).map((r) => {
      const f = fs.find((f) => f.id === r.fixture_id)!;
      return {
        id: r.id,
        season: f?.season ?? "",
        competition: f?.competition as "league" | "cup",
        date: f?.date ?? "",
        home: f?.home ?? "",
        away: f?.away ?? "",
        summary: r.summary,
        achievements: Object.values(
          r.games
            .flatMap((g: { game_players: PlayerEntry[] }) => g.game_players)
            .reduce((acc: Record<string, PlayerEntry>, p: PlayerEntry) => {
              const old = acc[p.player_id];
              acc[p.player_id] = {
                ...p,
                double_ones: (old?.double_ones ?? 0) + p.double_ones,
                highest_score:
                  Math.max(old?.highest_score ?? 0, p.highest_score ?? 0) ||
                  null,
                highest_checkout:
                  Math.max(
                    old?.highest_checkout ?? 0,
                    p.highest_checkout ?? 0,
                  ) || null,
              };
              return acc;
            }, {}),
        ) as PlayerEntry[],
        fixtureId: r.fixture_id,
        breakdown:
          r.summary?.counts ??
          Object.fromEntries(
            categories(f?.competition === "cup").map(([kind]) => [
              kind,
              r.games.filter(
                (g: Game) => g.kind === kind && g.winner === "home",
              ).length,
            ]),
          ),
        homeWins: r.summary
          ? Object.values(r.summary.counts as Record<string, number>).reduce(
              (a, b) => a + b,
              0,
            )
          : r.games.filter((g: { winner: string }) => g.winner === "home")
              .length,
        awayWins: r.summary
          ? 12 -
            Object.values(r.summary.counts as Record<string, number>).reduce(
              (a, b) => a + b,
              0,
            )
          : r.games.filter((g: { winner: string }) => g.winner === "away")
              .length,
        approved: r.status === "approved",
      };
    });
    setResults(mappedResults);
    setSheets((responses[5].data ?? []).filter((s) => !s.removed_at));
    setStats(playerStatistics(mappedResults, ps, ts, season, week));
    setLoadedScope([season, competition, week].join(":"));
  }
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (demo) {
      setResults(demoResults);
      setFixtures(demoFixtures);
      setPlayers(demoPlayers);
      setTeams([
        { id: "demo-pink", name: "Pink Arrows" },
        { id: "demo-city", name: "City Belles" },
        { id: "demo-foxes", name: "The Foxes" },
        { id: "demo-rose", name: "Rose & Crown" },
      ]);
      setReady(true);
      return;
    }
    if (!client) {
      setReady(true);
      return;
    }
    const check = async () => {
      const { data, error } = await client!.auth.getUser();
      if (error || !data.user) {
        setAllowed(false);
        setReady(true);
        return;
      }
      const member = await client!
        .from("committee_members")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();
      setAllowed(Boolean(member.data));
      if (!member.data)
        setMessage("This account does not have committee access.");
      setReady(true);
    };
    void check();
    const { data: listener } = client.auth.onAuthStateChange(() => {
      void check();
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (allowed) void load();
  }, [allowed, season, competition, week]); // Refresh scoped aggregates from protected records.
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function login(e: FormEvent) {
    e.preventDefault();
    if (!client) return;
    setBusy(true);
    setMessage("");
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) setMessage("Sign-in failed. Check your email and password.");
    setPassword("");
    setBusy(false);
  }
  function chooseFixture(id: string) {
    setSaveError("");
    setFixtureId(id);
    setArchivePreview("");
    setDetailed(false);
    setSummary(
      emptySummary(fixtures.find((f) => f.id === id)?.competition === "cup"),
    );
    setFile(null);
    setSheetId(null);
    setReview(false);
    const f = fixtures.find((f) => f.id === id);
    setGames(
      gameTypes(f?.competition === "cup" ? "cup" : "league").map((kind, i) => ({
        number: i + 1,
        kind,
        winner: "",
        players: Array.from(
          { length: kind === "Trebles" ? 6 : kind === "Singles" ? 2 : 4 },
          (_, j) => ({
            player_id: "",
            side:
              j < (kind === "Trebles" ? 3 : kind === "Singles" ? 1 : 2)
                ? "home"
                : "away",
            double_ones: 0,
            highest_score: null,
            highest_checkout: null,
          }),
        ),
      })),
    );
  }
  async function useSavedPhoto() {
    if (!client || !sheetId || busy) return;
    const saved = sheets.find((s) => s.id === sheetId);
    if (!saved) return;
    setBusy(true);
    try {
      const signed = await client.storage
        .from("result-sheets")
        .createSignedUrl(saved.storage_path, 60);
      if (signed.error) throw new Error(signed.error.message);
      const response = await fetch(signed.data.signedUrl, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("Could not open the saved original. Please retry.");
      const blob = await response.blob();
      setFile(
        new File(
          [blob],
          saved.storage_path.split("/").pop() ?? "original.jpg",
          { type: blob.type },
        ),
      );
      setMessage(
        "Original loaded for local review. Rescanning reuses this archived photograph.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load original.");
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (!client || !file || !selected) return null;
    setBusy(true);
    setMessage("");
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 10485760
      )
        throw new Error(
          "Use JPEG, PNG or WebP up to 10 MB. Convert HEIC photos before uploading.",
        );
      const path = `${selected.id}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
      const uploaded = await client.storage
        .from("result-sheets")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploaded.error) throw new Error(uploaded.error.message);
      const row = await client
        .from("result_sheets")
        .insert({ fixture_id: selected.id, storage_path: path })
        .select("id")
        .single();
      if (row.error)
        throw new Error(
          "Photo stored, but archive registration failed: " + row.error.message,
        );
      setSheetId(row.data.id);
      setMessage(
        "Original photograph saved. Enter the totals and any player achievements, then review.",
      );
      await load();
      return row.data.id as string;
    } catch (e) {
      const reason =
        e instanceof Error
          ? e.message
          : "Photo upload failed. Please try again.";
      setMessage(reason);
      setSaveError(reason);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function createResultPlayer(name: string, side: "home" | "away") {
    if (!client || demo || !selected)
      throw new Error("Player saving is unavailable in the demonstration.");
    const teamId =
      side === "home" ? selected.home_team_id : selected.away_team_id;
    const clean = name.normalize("NFKC").trim().replace(/\s+/g, " ");
    if (!teamId || !clean || clean.length > 100 || /[\x00-\x1f]/.test(clean))
      throw new Error("Enter a valid player name and choose a match team.");
    setBusy(true);
    try {
      const current = await client
        .from("players")
        .select("id,name,team_id")
        .eq("team_id", teamId);
      if (current.error) throw new Error(current.error.message);
      const matches = (current.data ?? []).filter(
        (p) => normalise(p.name) === normalise(clean),
      );
      if (matches.length > 1)
        throw new Error(
          "More than one saved player has this name. Choose the correct existing player instead.",
        );
      let saved = matches[0];
      if (!saved) {
        const inserted = await client
          .from("players")
          .insert({ name: clean, team_id: teamId })
          .select("id,name,team_id")
          .single();
        if (inserted.error) throw new Error(inserted.error.message);
        saved = inserted.data;
      }
      setPlayers((ps) => [...ps.filter((p) => p.id !== saved.id), saved]);
      return { ...saved, side };
    } finally {
      setBusy(false);
    }
  }
  async function saveDraft() {
    if (!client || !selected || demo) return;
    setBusy(true);
    try {
      let savedSheet = sheetId;
      if (!savedSheet && file) {
        savedSheet = await upload();
        if (!savedSheet) return;
        setBusy(true);
      }
      const { error } = await client.rpc("save_summary_draft", {
        p_fixture: selected.id,
        p_sheet: savedSheet,
        p_summary: summary,
      });
      if (error)
        throw new Error(
          error.code === "PGRST202"
            ? "Draft saving needs the latest database update. Your entries are still here."
            : error.message,
        );
      await load();
      setMessage(
        "Draft saved to the league database. You can finish it from Fixtures later. It is not included in standings until approved.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Draft could not be saved. Your entries are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!client || !selected || busy) return;
    setSaveError("");
    if (!sheetId && !file) {
      setSaveError(
        "Choose the original photograph above before saving this result.",
      );
      return;
    }
    setBusy(true);
    try {
      let savedSheet = sheetId;
      if (!savedSheet && file) {
        savedSheet = await upload();
        if (!savedSheet) return;
        setBusy(true);
      }
      const { error } = await client.rpc(
        detailed ? "save_result" : "save_summary_result",
        detailed
          ? {
              p_fixture: selected.id,
              p_sheet: savedSheet,
              p_games: games,
              p_approve: true,
            }
          : { p_fixture: selected.id, p_sheet: savedSheet, p_summary: summary },
      );
      if (error) throw new Error(error.message);
      const verification = await client
        .from("results")
        .select("id,status")
        .eq("fixture_id", selected.id)
        .single();
      if (verification.error || verification.data?.status !== "approved") {
        const notice =
          "Your save was accepted, but we couldn't confirm it by reloading. Check Results before saving again.";
        setMessage(notice);
        setSaveError(notice);
        return;
      }
      setReview(false);
      await load();
      setMessage(
        "Saved successfully. Your result and player achievements are stored in the league database.",
      );
      setViewedFixtureId(selected.id);
      setScreen("Match summary");
    } catch (e) {
      const reason =
        e instanceof Error
          ? e.message
          : "The database could not save this result. Please try again.";
      setSaveError(reason);
      setMessage(reason);
    } finally {
      setBusy(false);
    }
  }
  async function editResult(id: string) {
    if (!client) return;
    setBusy(true);
    const r = await client
      .from("results")
      .select(
        "*,games(number,kind,winner,game_players(player_id,side,double_ones,highest_score,highest_checkout))",
      )
      .eq("id", id)
      .single();
    setBusy(false);
    if (r.error) {
      setMessage(r.error.message);
      return;
    }
    chooseFixture(r.data.fixture_id);
    setSheetId(r.data.sheet_id);
    setDetailed(!r.data.summary);
    if (r.data.summary) setSummary(r.data.summary);
    setGames(
      r.data.games
        .sort((a: Game, b: Game) => a.number - b.number)
        .map((g: Game & { game_players: PlayerEntry[] }) => ({
          number: g.number,
          kind: g.kind,
          winner: g.winner,
          players: g.game_players as PlayerEntry[],
        })),
    );
    setScreen("Add Result");
  }
  async function removeSheet(sheet: Sheet) {
    if (!client || busy || demo) return;
    if (
      !window.confirm(
        "Remove this extra photograph from the results list? The original file is retained securely for the edit history.",
      )
    )
      return;
    setBusy(true);
    const { error } = await client.rpc("remove_result_sheet", {
      p_sheet: sheet.id,
    });
    if (error) {
      window.alert(
        error.code === "PGRST202"
          ? "Photo removal needs the latest database update first."
          : error.message,
      );
    } else {
      setSheets((current) => current.filter((s) => s.id !== sheet.id));
      setArchivePreview("");
      setMessage(
        "Extra photograph removed from the results list. Your scores are unchanged.",
      );
    }
    setBusy(false);
  }
  function sheetButtons(s: Sheet, label: string) {
    return (
      <span className="sheet-actions" key={s.id}>
        <button className="secondary" onClick={() => openSheet(s)}>
          {label}
        </button>
        <button
          className="remove-sheet"
          disabled={demo || busy}
          aria-label={`Remove ${label}`}
          title="Remove extra photograph"
          onClick={() => removeSheet(s)}
        >
          ×
        </button>
      </span>
    );
  }
  async function openSheet(sheet: Sheet) {
    if (!client) return;
    const r = await client.storage
      .from("result-sheets")
      .createSignedUrl(sheet.storage_path, 60);
    if (r.error) {
      setMessage(r.error.message);
      return;
    }
    setArchivePreview(r.data.signedUrl);
    const logs = await client
      .from("audit_log")
      .select("created_at,action,table_name")
      .eq("record_id", sheet.fixture_id)
      .order("created_at", { ascending: false });
    const result = await client
      .from("results")
      .select("id")
      .eq("fixture_id", sheet.fixture_id)
      .maybeSingle();
    const changes = result.data
      ? await client
          .from("audit_log")
          .select("created_at,action,table_name")
          .eq("record_id", result.data.id)
          .order("created_at", { ascending: false })
      : null;
    setHistory(
      [...(logs.data ?? []), ...(changes?.data ?? [])].map(
        (x) =>
          `${new Date(x.created_at).toLocaleString("en-GB")} · ${x.action} · ${x.table_name}`,
      ),
    );
  }
  const scoped = results.filter((r) => r.season === season && r.approved);
  const incomplete = fixtures.filter(
    (f) =>
      (demo || f.season === season) &&
      f.date <= week &&
      !results.some(
        (r) =>
          r.approved &&
          r.competition === f.competition &&
          r.date === f.date &&
          r.home === f.home &&
          r.away === f.away,
      ),
  );
  const formComplete = detailed
    ? games.length === 12 && games.every(gameComplete)
    : summaryValid(summary, selected?.competition === "cup");
  const navigate = (name: Screen) => {
    setScreen(name);
    setArchivePreview("");
    setMessage("");
  };
  if (!ready)
    return (
      <main className="login">
        <p>Opening your committee workspace…</p>
      </main>
    );
  if (!demo && !allowed)
    return (
      <main className="login">
        <div className="brand-mark">
          <Target size={28} />
        </div>
        <h1>Welcome to CCLDL</h1>
        <p className="muted">Chelmsford City Ladies Darts League</p>
        <div className="card">
          <h2>Committee sign in</h2>
          <p className="muted">Sign in with the shared committee account.</p>
          {client ? (
            <form onSubmit={login}>
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  minLength={8}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Signing in…" : "Secure sign in"}
                <ShieldCheck size={17} />
              </button>
            </form>
          ) : (
            <div className="notice">
              Supabase has not been configured. Real league records remain
              unavailable. Follow the setup instructions to connect your private
              database and provision the shared committee account.
            </div>
          )}
          {message && (
            <p role="alert" className="notice">
              {message}
            </p>
          )}
          <p className="muted" style={{ fontSize: 12 }}>
            Public registration is unavailable. Contact the league administrator
            for account assistance.
          </p>
        </div>
      </main>
    );
  const statsReady =
    demo || loadedScope === [season, competition, week].join(":");
  const statPanel = (key: "d1" | "checkout" | "score", title: string) => (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <Target size={19} color="#be426d" />
      </div>
      {!statsReady ? (
        <p className="muted">Loading statistics…</p>
      ) : stats.some((s) => s[key] > 0) ? (
        rankedStats(stats, key).map((s) => (
          <div className="result-row" key={s.id}>
            <span>
              <strong>
                {s.joint ? "=" : ""}
                {s.rank}. {s.name}
              </strong>
              {s.team && <small className="player-team">{s.team}</small>}
            </span>
            <strong className="score">{s[key]}</strong>
          </div>
        ))
      ) : (
        <div className="empty">No approved player statistics yet.</div>
      )}
    </div>
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 36,
          }}
        >
          <div className="brand-mark">
            <Target />
          </div>
          <span className="brand">CCLDL</span>
        </div>
        <p className="eyebrow" style={{ paddingLeft: 14 }}>
          Committee workspace
        </p>
        {nav.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={`nav-item ${screen === name ? "active" : ""}`}
            onClick={() => navigate(name)}
          >
            <Icon size={19} />
            {name}
          </button>
        ))}
        <div className="sidebar-foot">
          <ShieldCheck size={16} /> Private league management
          <br />
          <br />
          Chelmsford City Ladies
          <br />
          Darts League
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">Chelmsford City Ladies Darts League</span>
            <div className="muted">Your league. Every game. Together.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="badge">{season}</span>
            <div className="avatar">
              <ShieldCheck size={18} />
            </div>
          </div>
        </header>
        {demo && (
          <div className="notice">
            <strong>Demonstration workspace</strong> · All teams and scores
            shown here are fictional. Uploads and saving are disabled. No actual
            league records are connected.
          </div>
        )}
        <section className="hero">
          <div>
            <span className="eyebrow">
              {screen === "Home" ? "Season at a glance" : "Committee workspace"}
            </span>
            <h1>{screen === "Home" ? "Welcome to your league" : screen}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {screen === "Home"
                ? "Chelmsford City Ladies Darts League"
                : screen === "Add Result"
                  ? "Add the photo, enter the totals and check your result."
                  : "Chelmsford City Ladies Darts League · " + season}
            </p>
          </div>
          {screen === "Home" && (
            <button className="primary" onClick={() => navigate("Add Result")}>
              <Plus size={18} /> Upload result sheet
            </button>
          )}
        </section>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {screen !== "Home" && (
          <div className="fields" style={{ maxWidth: 500, marginBottom: 20 }}>
            <label>
              Season
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              >
                {(seasons.length
                  ? seasons
                  : [{ id: "demo", name: "2026/27" }]
                ).map((s) => (
                  <option key={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            {["Tables", "Results", "Weekly Overview"].includes(screen) && (
              <label>
                Competition
                <select
                  value={competition}
                  onChange={(e) =>
                    setCompetition(e.target.value as "league" | "cup")
                  }
                >
                  <option value="league">League</option>
                  <option value="cup">Cup</option>
                </select>
              </label>
            )}
          </div>
        )}
        {screen === "Home" && (
          <>
            {results.some((r) => r.season === season && !r.approved) && (
              <div className="card review-queue">
                <div className="card-head">
                  <div>
                    <span className="eyebrow">Finish your results</span>
                    <h2>Saved drafts to check</h2>
                  </div>
                  <span className="badge">Not yet in tables</span>
                </div>
                {results
                  .filter((r) => r.season === season && !r.approved)
                  .map((r) => (
                    <button
                      className="draft-row"
                      key={r.id}
                      disabled={busy}
                      onClick={() => editResult(r.id)}
                    >
                      <span>
                        <strong>
                          {r.home} v {r.away}
                        </strong>
                        <small>{dateLabel(r.date)} · Check & approve</small>
                      </span>
                      <span className="score">
                        {r.homeWins} – {r.awayWins}
                      </span>
                    </button>
                  ))}
              </div>
            )}
            <div className="card">
              <div className="card-head">
                <h2>League table</h2>
                <button
                  className="secondary"
                  onClick={() => navigate("Tables")}
                >
                  View all <ArrowUpRight size={14} />
                </button>
              </div>
              <Table
                teamNames={seasonTeamNames}
                results={results}
                competition="league"
                breakdown
                cutoff={week}
                season={season}
              />
            </div>
            <div className="card">
              <h2>Cup table</h2>
              <Table
                teamNames={seasonTeamNames}
                results={results}
                competition="cup"
                cutoff={week}
                season={season}
              />
            </div>
            <div className="grid">
              <div>
                <div className="card">
                  <div className="card-head">
                    <h2>Latest results</h2>
                    <span className="badge">Approved</span>
                  </div>
                  {scoped.length ? (
                    scoped
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .slice(0, 4)
                      .map((r) => (
                        <div className="result-row" key={r.id}>
                          <div>
                            <strong>{r.home}</strong>
                            <div className="muted">
                              vs {r.away} · {r.competition} ·{" "}
                              {dateLabel(r.date)}
                            </div>
                          </div>
                          <span className="score">
                            {r.homeWins} – {r.awayWins}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="empty">
                      Your first approved result will appear here.
                    </div>
                  )}
                </div>
              </div>
              <div>
                {statPanel("d1", "Most Double 1s")}
                <div className="card" style={{ background: "#fae8ef" }}>
                  <span className="eyebrow">Share the week</span>
                  <h2 style={{ margin: "12px 0" }}>
                    One league. One overview.
                  </h2>
                  <p className="muted">
                    Tables and player achievements, ready for your weekly
                    update.
                  </p>
                  <button
                    className="primary"
                    onClick={() => navigate("Weekly Overview")}
                  >
                    Weekly overview <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        {screen === "Tables" && (
          <div className="card">
            <div className="card-head">
              <h2>
                {competition === "league"
                  ? "The Gail Wander Trophy"
                  : "Cup standings"}
              </h2>
              <button
                className="secondary"
                disabled={!scoped.length}
                onClick={() =>
                  downloadCSV(
                    `${competition}-${season.replace("/", "-")}.csv`,
                    standings(
                      results,
                      competition,
                      week,
                      season,
                      seasonTeamNames,
                    ),
                  )
                }
              >
                <Download size={16} /> CSV / Excel
              </button>
            </div>
            <Table
              teamNames={seasonTeamNames}
              results={results}
              competition={competition}
              full={competition === "league"}
              breakdown={competition === "league"}
              cutoff={week}
              season={season}
            />
          </div>
        )}
        {screen === "Tables" && (
          <>
            <label style={{ maxWidth: 300 }}>
              Results through
              <input
                type="date"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
              />
            </label>
            <p className="muted">
              Approved {competition} results only · through {dateLabel(week)}
            </p>
            {competition === "league" && (
              <div className="grid">
                {categories(false).map(([kind]) => (
                  <div className="card" key={kind}>
                    <h2>
                      {kind === "Captains & vice"
                        ? "Leigh Barnes Trophy · Captains & vice"
                        : kind}
                    </h2>
                    {categoryStandings(results, kind, season, week).map((r) => (
                      <div className="result-row" key={r.name}>
                        <span>{r.name}</span>
                        <strong className="score">{r.value}</strong>
                      </div>
                    ))}
                    {!categoryStandings(results, kind, season, week).length && (
                      <p className="muted">No category totals recorded.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <h2>Player statistics</h2>
            <p className="muted">
              Cumulative season totals · League and Cup combined · through{" "}
              {dateLabel(week)}
            </p>
            <div className="filter-pills" aria-label="Player statistic">
              {(
                [
                  ["d1", "Double 1s"],
                  ["score", "Highest score"],
                  ["checkout", "Highest checkout"],
                ] as const
              ).map(([key, label]) => (
                <button
                  className={statTab === key ? "selected" : ""}
                  aria-pressed={statTab === key}
                  key={key}
                  onClick={() => setStatTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {statPanel(
              statTab,
              statTab === "d1"
                ? "Double 1 finishes"
                : statTab === "score"
                  ? "Highest score"
                  : "Highest checkout",
            )}
            <button
              className="secondary"
              disabled={!statsReady || !stats.length}
              onClick={() => downloadCSV("player-statistics.csv", stats)}
            >
              <Download size={16} /> Export CSV for Excel
            </button>
          </>
        )}
        {screen === "Match summary" &&
          (() => {
            const f = fixtures.find((x) => x.id === viewedFixtureId);
            const r = results.find(
              (x) =>
                x.fixtureId === viewedFixtureId ||
                (f &&
                  x.home === f.home &&
                  x.away === f.away &&
                  x.date === f.date &&
                  x.competition === f.competition),
            );
            return f ? (
              <>
                <button
                  className="secondary"
                  onClick={() => navigate("Fixtures")}
                >
                  Back to fixtures
                </button>
                <MatchSummary
                  fixture={f}
                  result={r}
                  players={players}
                  disabled={demo || busy}
                  photos={sheets.filter((s) => s.fixture_id === f.id)}
                  onPhoto={(id) => {
                    const sheet = sheets.find((s) => s.id === id);
                    if (sheet) void openSheet(sheet);
                  }}
                  onEdit={() => {
                    if (r) void editResult(r.id);
                    else {
                      chooseFixture(f.id);
                      setScreen("Add Result");
                    }
                  }}
                />
                <button
                  className="secondary"
                  onClick={() => {
                    chooseFixture("");
                    navigate("Add Result");
                  }}
                >
                  Add another result
                </button>
              </>
            ) : (
              <p className="notice">
                Fixture unavailable. Return to Fixtures and refresh.
              </p>
            );
          })()}
        {screen === "Fixtures" && (
          <>
            <div className="card schedule-filters">
              <h2>Fixtures & results</h2>
              <label>
                Fixture competition
                <select
                  value={fixtureCompetition}
                  onChange={(e) => setFixtureCompetition(e.target.value)}
                >
                  <option value="all">League & Cup — all fixtures</option>
                  <option value="league">League</option>
                  <option value="cup">Cup</option>
                </select>
              </label>
              <label>
                Find a team
                <input
                  value={fixtureSearch}
                  onChange={(e) => setFixtureSearch(e.target.value)}
                  placeholder="Search fixtures"
                />
              </label>
              <div className="filter-pills" aria-label="Fixture status">
                {[
                  ["all", "All fixtures"],
                  ["approved", "Results"],
                  ["pending", "To enter"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={fixtureStatus === key ? "selected" : ""}
                    aria-pressed={fixtureStatus === key}
                    onClick={() => setFixtureStatus(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                className="secondary"
                onClick={() => navigate("Teams & players")}
              >
                Add a fixture
              </button>
            </div>
            {(() => {
              const visible = fixtures
                .filter(
                  (f) =>
                    (demo || f.season === season) &&
                    (fixtureCompetition === "all" ||
                      f.competition === fixtureCompetition) &&
                    `${f.home} ${f.away}`
                      .toLowerCase()
                      .includes(fixtureSearch.toLowerCase()) &&
                    (fixtureStatus === "all" ||
                      (results.some((r) => r.fixtureId === f.id && r.approved)
                        ? fixtureStatus === "approved"
                        : fixtureStatus === "pending")),
                )
                .sort((a, b) => a.date.localeCompare(b.date));
              return visible.length ? (
                [...new Set(visible.map((f) => f.date))].map((date) => (
                  <section className="card fixture-round" key={date}>
                    <div className="card-head">
                      <h2>{dateLabel(date)}</h2>
                      <span className="badge">
                        {visible.filter((f) => f.date === date).length} fixtures
                      </span>
                    </div>
                    {visible
                      .filter((f) => f.date === date)
                      .map((f) => {
                        const saved = results.find(
                          (r) =>
                            r.fixtureId === f.id ||
                            (r.home === f.home &&
                              r.away === f.away &&
                              r.date === f.date &&
                              r.competition === f.competition),
                        );
                        return (
                          <button
                            className="fixture-link result-row"
                            key={f.id}
                            onClick={() => {
                              setViewedFixtureId(f.id);
                              navigate("Match summary");
                            }}
                          >
                            <span>
                              <strong>
                                {f.home} vs {f.away}
                              </strong>
                              <small className="player-team">
                                {f.competition === "cup"
                                  ? "Cup · "
                                  : "League · "}
                                {saved
                                  ? saved.approved
                                    ? "View result & original sheet"
                                    : "Draft · finish entering result"
                                  : "View match / add result"}
                              </small>
                            </span>
                            <span className="score">
                              {saved
                                ? `${saved.homeWins} – ${saved.awayWins}`
                                : "View"}
                              <ChevronRight size={16} />
                            </span>
                          </button>
                        );
                      })}
                  </section>
                ))
              ) : (
                <p className="empty">No fixtures match these filters.</p>
              );
            })()}
          </>
        )}
        {screen === "Teams & players" && (
          <SetupForms
            clientReady={Boolean(client) && !demo}
            teams={teams}
            seasons={seasons}
            players={players}
            reload={load}
            notify={setMessage}
          />
        )}
        {screen === "Add Result" && (
          <>
            <div className="card">
              <h2>1. Select the fixture</h2>
              <label style={{ marginTop: 16 }}>
                Find fixture by team or date
                <input
                  type="search"
                  value={resultFixtureSearch}
                  onChange={(e) => setResultFixtureSearch(e.target.value)}
                  placeholder="Team name or 2026-10-20"
                  disabled={busy}
                />
              </label>
              <label style={{ marginTop: 18 }}>
                Fixture
                <select
                  disabled={busy}
                  value={fixtureId}
                  onChange={(e) => {
                    const existing = results.find(
                      (r) => r.fixtureId === e.target.value,
                    );
                    if (existing) void editResult(existing.id);
                    else chooseFixture(e.target.value);
                  }}
                >
                  <option value="">Choose a fixture</option>
                  {fixtures
                    .filter(
                      (f) =>
                        (demo || f.season === season) &&
                        (f.id === fixtureId ||
                          `${f.home} ${f.away} ${f.date} ${dateLabel(f.date)}`
                            .toLowerCase()
                            .includes(resultFixtureSearch.toLowerCase())),
                    )
                    .map((f) => (
                      <option value={f.id} key={f.id}>
                        {dateLabel(f.date)} · {f.home} vs {f.away} ·{" "}
                        {f.competition}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {selected && (
              <>
                <div className="card">
                  <h2>2. Keep the original sheet</h2>
                  <p className="muted">
                    Keep the original photograph with the result. No scanning is
                    needed.
                  </p>
                  <label>
                    Original photograph (JPEG, PNG or WebP, up to 10 MB)
                    <input
                      disabled={busy}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] ?? null);
                        setSheetId(null);
                        setReview(false);
                      }}
                    />
                  </label>
                  {preview && (
                    <img
                      className="sheet-preview"
                      src={preview}
                      alt="Selected result sheet for review"
                    />
                  )}
                  <div className="actions">
                    <button
                      className="primary"
                      disabled={demo || !file || busy}
                      onClick={upload}
                    >
                      {sheetId
                        ? "Upload an additional original"
                        : "Save photograph"}
                    </button>
                    {sheetId && (
                      <>
                        <span className="badge">Original archived</span>
                        {!file && (
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={useSavedPhoto}
                          >
                            Read saved original
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {!detailed && (
                  <details className="scanner-disclosure">
                    <summary>Read handwriting (free, experimental)</summary>
                    <SheetScanner
                      key={`${fixtureId}:${file?.name}:${file?.lastModified}`}
                      file={file}
                      fixture={fixtureId}
                      cup={selected.competition === "cup"}
                      home={selected.home}
                      away={selected.away}
                      date={selected.date}
                      current={summary}
                      players={players
                        .filter(
                          (p) =>
                            p.team_id === selected.home_team_id ||
                            p.team_id === selected.away_team_id,
                        )
                        .map((p) => ({
                          ...p,
                          side:
                            p.team_id === selected.home_team_id
                              ? "home"
                              : "away",
                        }))}
                      disabled={demo || busy}
                      onApply={(next) => {
                        setSummary(next);
                        setReview(false);
                        setSaveError("");
                      }}
                    />
                  </details>
                )}
                {!detailed && (
                  <div className="card">
                    {!summaryReady && (
                      <p className="notice">
                        Simplified saving is awaiting the one-time database
                        update. Please complete that update before entering a
                        new result.
                      </p>
                    )}
                    <h2>
                      {review
                        ? "3. Check your result"
                        : "3. Scores & achievements"}
                    </h2>
                    <SummaryEntry
                      key={fixtureId}
                      createPlayer={createResultPlayer}
                      value={summary}
                      onChange={setSummary}
                      cup={selected.competition === "cup"}
                      home={selected.home}
                      away={selected.away}
                      readOnly={review}
                      players={players
                        .filter(
                          (p) =>
                            p.team_id === selected.home_team_id ||
                            p.team_id === selected.away_team_id,
                        )
                        .map((p) => ({
                          ...p,
                          side:
                            p.team_id === selected.home_team_id
                              ? "home"
                              : "away",
                        }))}
                    />
                    <div className="save-feedback" aria-live="polite">
                      {saveError && (
                        <p className="notice save-error" role="alert">
                          {saveError} Your entries are still here.
                        </p>
                      )}
                      {!formComplete && (
                        <p className="notice">
                          Complete the scores and select a saved player for each
                          achievement. Confirm any pending players before
                          approval.
                        </p>
                      )}
                      {review && !sheetId && !file && (
                        <p className="notice">
                          One step left: choose the original photograph above to
                          enable approval.
                        </p>
                      )}
                      {review && formComplete && (sheetId || file) && (
                        <p className="muted">
                          Ready to save. Approval adds this result and its
                          achievements to the tables.
                        </p>
                      )}
                    </div>
                    <div className="actions result-actions">
                      {!review &&
                        !results.some(
                          (r) => r.fixtureId === fixtureId && r.approved,
                        ) && (
                          <button
                            className="secondary"
                            disabled={
                              demo ||
                              busy ||
                              !summaryValid(
                                { ...summary, pending_achievements: [] },
                                selected.competition === "cup",
                              )
                            }
                            onClick={saveDraft}
                          >
                            Save draft
                          </button>
                        )}
                      {review ? (
                        <>
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => setReview(false)}
                          >
                            Make corrections
                          </button>
                          <button
                            className="primary"
                            disabled={
                              demo ||
                              busy ||
                              !formComplete ||
                              (!sheetId && !file) ||
                              !summaryReady
                            }
                            onClick={approve}
                          >
                            {busy ? "Saving result…" : "Approve & save result"}
                          </button>
                        </>
                      ) : (
                        <button
                          className="primary"
                          disabled={!formComplete}
                          onClick={() => setReview(true)}
                        >
                          Review result
                        </button>
                      )}
                    </div>
                    {!sheetId && (
                      <p className="muted">
                        Choose the original photo above. It will be saved when
                        you approve.
                      </p>
                    )}
                  </div>
                )}
                {detailed && (
                  <div className="card">
                    <h2>
                      3.{" "}
                      {review
                        ? "Review all 12 games"
                        : "Enter games & player statistics"}
                    </h2>
                    <p className="muted">
                      {selected.competition === "league"
                        ? "3 pairs · 2 trebles · captains & vice · 6 singles"
                        : "12 singles"}
                      . Assign each player to a team before entering results.
                    </p>
                    {review ? (
                      <>
                        <div className="notice">
                          Check against the original sheet before approving.
                          Home {games.filter((g) => g.winner === "home").length}{" "}
                          – Away{" "}
                          {games.filter((g) => g.winner === "away").length}
                        </div>
                        {games.map((g) => (
                          <div className="game" key={g.number}>
                            <strong>
                              {g.number}. {g.kind} ·{" "}
                              {g.winner === "home"
                                ? selected.home
                                : selected.away}{" "}
                              won
                            </strong>
                            {g.players.map((p, i) => (
                              <p className="muted" key={i}>
                                {
                                  players.find((x) => x.id === p.player_id)
                                    ?.name
                                }{" "}
                                ({p.side}) · Double 1s: {p.double_ones} · Score:{" "}
                                {p.highest_score ?? "—"} · Checkout:{" "}
                                {p.highest_checkout ?? "—"}
                              </p>
                            ))}
                          </div>
                        ))}
                        <div className="actions">
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => setReview(false)}
                          >
                            Make corrections
                          </button>
                          <button
                            className="primary"
                            disabled={
                              demo ||
                              busy ||
                              !formComplete ||
                              (!sheetId && !file)
                            }
                            onClick={approve}
                          >
                            {busy ? "Saving result…" : "Approve & save result"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="notice" role="status">
                          {games.filter(gameComplete).length} of 12 games
                          complete · {selected.home}{" "}
                          {games.filter((g) => g.winner === "home").length} –{" "}
                          {games.filter((g) => g.winner === "away").length}{" "}
                          {selected.away}
                          <div>
                            Players used earlier appear first. Reuse an earlier
                            lineup when the same players return. Only open
                            statistics when there is something to record.
                          </div>
                        </div>
                        {games.map((g, index) => (
                          <ManualGameEntry
                            key={`${fixtureId}:${g.number}`}
                            game={g}
                            previous={games.slice(0, index)}
                            home={selected.home}
                            away={selected.away}
                            roster={players
                              .filter(
                                (p) =>
                                  p.team_id === selected.home_team_id ||
                                  p.team_id === selected.away_team_id,
                              )
                              .map((p) => ({
                                id: p.id,
                                name: p.name,
                                side:
                                  p.team_id === selected.home_team_id
                                    ? ("home" as const)
                                    : ("away" as const),
                              }))}
                            onChange={(next) =>
                              setGames((gs) =>
                                gs.map((entry, i) =>
                                  i === index ? next : entry,
                                ),
                              )
                            }
                          />
                        ))}
                        <div className="actions">
                          <button
                            className="primary"
                            disabled={!formComplete}
                            onClick={() => setReview(true)}
                          >
                            Review result
                          </button>
                        </div>
                        {!formComplete && (
                          <p className="muted">
                            Select every player and winner, and check that
                            statistics are valid, to review.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
        {screen === "Results" && (
          <>
            <div className="card">
              <h2>Result sheet archive</h2>
              <div className="fields" style={{ marginTop: 16 }}>
                <label>
                  Team
                  <input
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    placeholder="Search team name"
                  />
                </label>
                <label>
                  Match date
                  <input
                    type="date"
                    value={archiveDate}
                    onChange={(e) => setArchiveDate(e.target.value)}
                  />
                </label>
              </div>
              {results
                .filter(
                  (r) =>
                    r.season === season &&
                    r.competition === competition &&
                    (!archiveDate || r.date === archiveDate) &&
                    `${r.home} ${r.away}`
                      .toLowerCase()
                      .includes(teamFilter.toLowerCase()),
                )
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((r) => (
                  <div className="archive-match" key={r.id}>
                    <div>
                      <strong>
                        {r.home} {r.homeWins} – {r.awayWins} {r.away}
                      </strong>
                      <p className="muted">
                        {dateLabel(r.date)} ·{" "}
                        {r.approved ? "Approved" : "Draft"}
                      </p>
                    </div>
                    <div className="actions">
                      <button
                        className="secondary"
                        disabled={demo || busy}
                        onClick={() => {
                          if (r.fixtureId) {
                            setViewedFixtureId(r.fixtureId);
                            navigate("Match summary");
                          }
                        }}
                      >
                        View match summary
                      </button>
                      {sheets
                        .filter((s) => s.fixture_id === r.fixtureId)
                        .map((s, i) =>
                          sheetButtons(s, `Original photo ${i + 1}`),
                        )}
                    </div>
                  </div>
                ))}

              {sheets
                .filter((s) => {
                  const f = fixtures.find((f) => f.id === s.fixture_id);
                  return (
                    !results.some((r) => r.fixtureId === s.fixture_id) &&
                    f?.season === season &&
                    f.competition === competition &&
                    (!archiveDate || f.date === archiveDate) &&
                    `${f.home} ${f.away}`
                      .toLowerCase()
                      .includes(teamFilter.toLowerCase())
                  );
                })
                .map((s) => {
                  const f = fixtures.find((f) => f.id === s.fixture_id)!;
                  return (
                    <div className="result-row" key={s.id}>
                      <div>
                        <strong>
                          {f.home} vs {f.away}
                        </strong>
                        <p className="muted">
                          {dateLabel(f.date)} · {f.competition} · Result not yet
                          saved
                        </p>
                      </div>
                      {sheetButtons(s, "View original")}
                    </div>
                  );
                })}
              {!sheets.length &&
                !results.some(
                  (r) => r.season === season && r.competition === competition,
                ) && (
                  <div className="empty">
                    <ImageIcon style={{ margin: "0 auto 12px" }} />
                    Saved results and their original photographs will appear
                    here.
                  </div>
                )}
            </div>
          </>
        )}
        {archivePreview && (
          <div className="card">
            <h2>Original photograph</h2>
            <img
              className="sheet-preview"
              src={archivePreview}
              alt="Archived original result sheet"
            />
            <p className="muted">
              Private link expires after 60 seconds. Reopen the sheet to
              refresh.
            </p>
            <h3>Fixture & result edit history</h3>
            {history.length ? (
              history.map((h, i) => (
                <p className="muted" key={i}>
                  {h}
                </p>
              ))
            ) : (
              <p className="muted">
                No fixture or result corrections recorded.
              </p>
            )}
            <button className="secondary" onClick={() => setArchivePreview("")}>
              Close
            </button>
          </div>
        )}
        {screen === "Weekly Overview" && (
          <>
            <div className="card">
              <div className="fields">
                <label>
                  Include results through
                  <input
                    type="date"
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                  />
                </label>
                <label>
                  Image content
                  <select
                    value={posterPart}
                    onChange={(e) =>
                      setPosterPart(e.target.value as typeof posterPart)
                    }
                  >
                    <option value="all">Everything · one PNG</option>
                    <option value="tables">Tables only · image 1 of 2</option>
                    <option value="players">
                      Player leaders · image 2 of 2
                    </option>
                  </select>
                </label>
                <div style={{ alignSelf: "end" }}>
                  <button
                    className="primary"
                    onClick={async () => {
                      if (!weeklyRef.current) return;
                      setBusy(true);
                      try {
                        const url = await toPng(weeklyRef.current, {
                          pixelRatio: 2,
                          backgroundColor: "#ffffff",
                        });
                        const a = document.createElement("a");
                        a.download = `CCLDL-${week}-${posterPart}${demo ? "-DEMO" : ""}.png`;
                        a.href = url;
                        a.click();
                      } catch {
                        setMessage("PNG generation failed. Please try again.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy || !statsReady || !week}
                  >
                    <Download size={16} /> Download PNG
                  </button>
                </div>
              </div>
              <p className="muted">
                Download the image and attach it to your Facebook group post.
                The image keeps the same readable layout on every phone.
                Previous dates use the latest corrected results.
              </p>
            </div>
            <PosterPreview posterRef={weeklyRef}>
              <WeeklyPoster
                part={posterPart}
                teamNames={seasonTeamNames}
                results={results}
                stats={stats}
                season={season}
                week={week}
                competition={competition}
                incomplete={incomplete.length}
                demo={demo}
              />
            </PosterPreview>
          </>
        )}
        {screen === "More" && (
          <>
            <div className="card">
              <button
                className="nav-item"
                onClick={() => {
                  navigate("Teams & players");
                  window.setTimeout(
                    () =>
                      document
                        .getElementById("season-administration")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        }),
                    0,
                  );
                }}
              >
                <Users size={20} />
                Teams & players
                <ChevronRight size={17} style={{ marginLeft: "auto" }} />
              </button>
              {nav
                .filter((n) =>
                  ["Results", "Weekly Overview", "Teams & players"].includes(
                    n.name,
                  ),
                )
                .map(({ name, icon: Icon }) => (
                  <button
                    className="nav-item"
                    key={name}
                    onClick={() => navigate(name)}
                  >
                    <Icon size={20} />
                    {name}
                    <ChevronRight size={17} style={{ marginLeft: "auto" }} />
                  </button>
                ))}
            </div>
            <div className="card">
              <h2>Install CCLDL</h2>
              <p className="muted">
                iPhone: open in Safari, tap Share, then Add to Home Screen.
                Android: use Chrome’s menu and select Install app or Add to Home
                screen. Installation requires HTTPS.
              </p>
              <p className="muted">
                An internet connection is required for private league records.
                Photos and authenticated pages are never cached for offline use.
              </p>
              {!demo && (
                <button
                  className="secondary"
                  onClick={async () => {
                    await client?.auth.signOut();
                    setResults([]);
                    setFixtures([]);
                    setSheets([]);
                    setStats([]);
                    setAllowed(false);
                  }}
                >
                  <LogOut size={16} /> Sign out
                </button>
              )}
            </div>
          </>
        )}
      </main>
      <nav className="bottom" aria-label="Main navigation">
        {[
          { name: "Home", icon: Home },
          { name: "Fixtures", icon: CalendarDays },
          { name: "Add Result", icon: Plus },
          { name: "Tables", icon: BarChart3 },
          { name: "More", icon: Menu },
        ].map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={
              screen === name ||
              (name === "Fixtures" && screen === "Match summary") ||
              (name === "More" &&
                ["Results", "Weekly Overview", "Teams & players"].includes(
                  screen,
                ))
                ? "active"
                : ""
            }
            onClick={() => navigate(name as Screen)}
            aria-current={screen === name ? "page" : undefined}
          >
            <Icon size={21} />
            {name}
          </button>
        ))}
      </nav>
    </div>
  );
}
function SetupForms({
  players,
  clientReady,
  teams,
  seasons,
  reload,
  notify,
}: {
  clientReady: boolean;
  players: Option[];
  teams: Option[];
  seasons: Option[];
  reload: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  async function renamePlayer(e: FormEvent<HTMLFormElement>, player: Option) {
    e.preventDefault();
    if (!client || !clientReady || busy) return;
    const name = playerName.trim().replace(/\s+/g, " ");
    if (!name || name.length > 100) {
      notify("Enter a player name of 1–100 characters.");
      return;
    }
    if (
      players.some(
        (p) =>
          p.id !== player.id &&
          p.team_id === player.team_id &&
          p.name.trim().toLowerCase() === name.toLowerCase(),
      )
    ) {
      notify(
        "This team already has a player with that name. Check the existing player first.",
      );
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await client
        .from("players")
        .update({ name })
        .eq("id", player.id)
        .select("id")
        .single();
      if (error || !data)
        throw new Error(error?.message || "The name could not be saved.");
      await reload();
      setEditingPlayer(null);
      notify("Player name updated. Their results and statistics stay linked.");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not save the player name. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>, table: string) {
    e.preventDefault();
    if (!client || !clientReady) return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    const r = await client.from(table).insert(data);
    setBusy(false);
    notify(r.error ? r.error.message : "Saved successfully.");
    if (!r.error) {
      form.reset();
      await reload();
    }
  }
  return (
    <div className="card" id="season-administration">
      <h2>Season administration</h2>
      <p className="muted">
        The committee account can manage teams, players, seasons and fixtures.
      </p>
      <section aria-label="Team rosters" className="team-rosters">
        <h3>Players by team</h3>
        <p className="muted">
          Current team lists. Add players individually below, or use the
          optional CSV upload.
        </p>
        <label>
          Find a team or player
          <input
            type="search"
            value={rosterSearch}
            onChange={(e) => setRosterSearch(e.target.value)}
            placeholder="Type a team or player name"
          />
        </label>
        {teams
          .filter(
            (t) =>
              t.name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
              players.some(
                (p) =>
                  p.team_id === t.id &&
                  p.name.toLowerCase().includes(rosterSearch.toLowerCase()),
              ),
          )
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((t) => {
            const members = players
              .filter((p) => p.team_id === t.id)
              .sort((a, b) => a.name.localeCompare(b.name));
            return (
              <details key={t.id} open={Boolean(rosterSearch)}>
                <summary>
                  {t.name} · {members.length} players
                </summary>
                {members.length ? (
                  <ul aria-label={`${t.name} roster`}>
                    {members
                      .filter(
                        (p) =>
                          !rosterSearch ||
                          t.name
                            .toLowerCase()
                            .includes(rosterSearch.toLowerCase()) ||
                          p.name
                            .toLowerCase()
                            .includes(rosterSearch.toLowerCase()),
                      )
                      .map((p) => (
                        <li key={p.id} className="roster-player">
                          {editingPlayer === p.id ? (
                            <form onSubmit={(e) => renamePlayer(e, p)}>
                              <label>
                                Correct player name
                                <input
                                  value={playerName}
                                  onChange={(e) =>
                                    setPlayerName(e.target.value)
                                  }
                                  required
                                  maxLength={100}
                                  autoFocus
                                />
                              </label>
                              <div className="actions">
                                <button disabled={busy || !playerName.trim()}>
                                  Save name
                                </button>
                                <button
                                  type="button"
                                  className="secondary"
                                  disabled={busy}
                                  onClick={() => setEditingPlayer(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <span>{p.name}</span>
                              <button
                                type="button"
                                className="secondary"
                                aria-label={`Edit ${p.name}`}
                                disabled={!clientReady || busy}
                                onClick={() => {
                                  setEditingPlayer(p.id);
                                  setPlayerName(p.name);
                                }}
                              >
                                Edit name
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="muted">No players added yet.</p>
                )}
              </details>
            );
          })}
        {!teams.length && (
          <p className="muted">
            Add your first team below to start its player list.
          </p>
        )}
      </section>
      <div className="grid">
        <form onSubmit={(e) => submit(e, "teams")}>
          <h3>Add a team</h3>
          <label>
            Team name
            <input name="name" required maxLength={100} />
          </label>
          <button
            className="secondary"
            style={{ marginTop: 12 }}
            disabled={!clientReady || busy}
          >
            Save team
          </button>
        </form>
        <form onSubmit={(e) => submit(e, "players")}>
          <h3>Add a player</h3>
          <label>
            Player name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Team
            <select name="team_id" required>
              <option value="">Choose team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary"
            style={{ marginTop: 12 }}
            disabled={!clientReady || busy}
          >
            Save player
          </button>
        </form>
      </div>
      <PlayerCsvImport
        teams={teams}
        players={players}
        enabled={clientReady}
        reload={reload}
      />
      <form onSubmit={(e) => submit(e, "fixtures")}>
        <h3>Add a fixture</h3>
        <div className="fields">
          <label>
            Season
            <select name="season_id" required>
              <option value="">Choose season</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Competition
            <select name="competition">
              <option value="league">League</option>
              <option value="cup">Cup</option>
            </select>
          </label>
          <label>
            Home team
            <select name="home_team_id" required>
              <option value="">Choose team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Away team
            <select name="away_team_id" required>
              <option value="">Choose team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input name="played_on" type="date" required />
          </label>
        </div>
        <button
          className="primary"
          style={{ marginTop: 12 }}
          disabled={!clientReady || busy}
        >
          Save fixture
        </button>
      </form>
      <form onSubmit={(e) => submit(e, "seasons")}>
        <h3>Add a season</h3>
        <div className="fields">
          <label>
            Season name
            <input name="name" placeholder="2027/28" required />
          </label>
          <label>
            Starts on
            <input type="date" name="starts_on" required />
          </label>
          <label>
            Ends on
            <input type="date" name="ends_on" required />
          </label>
        </div>
        <button
          className="secondary"
          style={{ marginTop: 12 }}
          disabled={!clientReady || busy}
        >
          Save season
        </button>
      </form>
    </div>
  );
}
