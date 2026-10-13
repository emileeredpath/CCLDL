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
} from "lucide-react";
import { toPng } from "html-to-image";
import ManualGameEntry from "@/components/manual-game-entry";
import { gameComplete } from "@/lib/manual-entry";
import { supabase } from "@/lib/supabase";
import { demoFixtures, demoResults, demoPlayers } from "@/lib/demo";
import { gameTypes, standings, type Result } from "@/lib/standings";
const client = supabase();
const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
type Screen =
  | "Home"
  | "Fixtures"
  | "Add Result"
  | "Tables"
  | "Stats"
  | "Archive"
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
type Stat = { name: string; d1: number; score: number; checkout: number };
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
}: {
  results: Result[];
  competition: "league" | "cup";
  cutoff: string;
  season: string;
}) {
  const rows = standings(results, competition, cutoff, season);
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>For</th>
              <th>Against</th>
              {competition === "league" && <th>Points</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team}>
                <td style={{ fontWeight: 600 }}>{r.team}</td>
                <td>{r.played}</td>
                <td>{r.won}</td>
                <td>{r.drawn}</td>
                <td>{r.lost}</td>
                <td>{r.gamesFor}</td>
                <td>{r.gamesAgainst}</td>
                {competition === "league" && (
                  <td style={{ color: "var(--pink)", fontWeight: 700 }}>
                    {r.gamesFor}
                  </td>
                )}
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
        Alphabetical display ·{" "}
        {competition === "league"
          ? "Points = games won. Ranking and tie-break rules await confirmation."
          : "Game totals only. Cup points and ranking await confirmation."}
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
  const [results, setResults] = useState<Result[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [seasons, setSeasons] = useState<Option[]>([]);
  const [teams, setTeams] = useState<Option[]>([]);
  const [players, setPlayers] = useState<Option[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [season, setSeason] = useState("2026/27");
  const [competition, setCompetition] = useState<"league" | "cup">("league");
  const [week, setWeek] = useState(new Date().toISOString().slice(0, 10));
  const [teamFilter, setTeamFilter] = useState("");
  const [archiveDate, setArchiveDate] = useState("");
  const [fixtureId, setFixtureId] = useState("");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [games, setGames] = useState<Game[]>([]);
  const [review, setReview] = useState(false);
  const [archivePreview, setArchivePreview] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const weeklyRef = useRef<HTMLDivElement>(null);
  const nav: { name: Screen; icon: typeof Home }[] = [
    { name: "Home", icon: Home },
    { name: "Fixtures", icon: CalendarDays },
    { name: "Add Result", icon: Plus },
    { name: "Tables", icon: Trophy },
    { name: "Stats", icon: BarChart3 },
    { name: "Archive", icon: ImageIcon },
    { name: "Weekly Overview", icon: Download },
  ];
  const selected = fixtures.find((f) => f.id === fixtureId);
  async function load() {
    if (!client) return;
    const responses = await Promise.all([
      client.from("seasons").select("id,name"),
      client.from("teams").select("id,name"),
      client.from("players").select("id,name,team_id"),
      client.from("fixtures").select("*"),
      client.from("results").select("*, games(*,game_players(*))"),
      client.from("result_sheets").select("*"),
    ]);
    const failure = responses.find((r) => r.error);
    if (failure?.error) {
      setMessage(failure.error.message);
      return;
    }
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
    setResults(
      (responses[4].data ?? []).map((r) => {
        const f = fs.find((f) => f.id === r.fixture_id)!;
        return {
          id: r.id,
          season: f?.season ?? "",
          competition: f?.competition as "league" | "cup",
          date: f?.date ?? "",
          home: f?.home ?? "",
          away: f?.away ?? "",
          homeWins: r.games.filter(
            (g: { winner: string }) => g.winner === "home",
          ).length,
          awayWins: r.games.filter(
            (g: { winner: string }) => g.winner === "away",
          ).length,
          approved: r.status === "approved",
        };
      }),
    );
    setSheets(responses[5].data ?? []);
    const totals = new Map<string, Stat>();
    for (const r of responses[4].data ?? []) {
      const f = fs.find((f) => f.id === r.fixture_id);
      if (
        r.status !== "approved" ||
        f?.season !== season ||
        f.competition !== competition ||
        f.date > week
      )
        continue;
      for (const g of r.games)
        for (const p of g.game_players) {
          const row = totals.get(p.player_id) ?? {
            name:
              ps.find((x) => x.id === p.player_id)?.name ?? "Unknown player",
            d1: 0,
            score: 0,
            checkout: 0,
          };
          row.d1 += p.double_ones;
          row.score = Math.max(row.score, p.highest_score ?? 0);
          row.checkout = Math.max(row.checkout, p.highest_checkout ?? 0);
          totals.set(p.player_id, row);
        }
    }
    setStats([...totals.values()]);
  }
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (demo) {
      setResults(demoResults);
      setFixtures(demoFixtures);
      setPlayers(demoPlayers);
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
    setFixtureId(id);
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
  async function upload() {
    if (!client || !file || !selected) return;
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
      if (uploaded.error) throw uploaded.error;
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
        "Original photograph securely archived. Select the players and winners below, then review.",
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!client || !selected) return;
    setBusy(true);
    try {
      const { error } = await client.rpc("save_result", {
        p_fixture: selected.id,
        p_sheet: sheetId,
        p_games: games,
        p_approve: true,
      });
      if (error) throw error;
      setMessage("Result approved. Tables and statistics have been refreshed.");
      setReview(false);
      await load();
      setScreen("Tables");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
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
        "fixture_id,sheet_id,games(number,kind,winner,game_players(player_id,side,double_ones,highest_score,highest_checkout))",
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
    setGames(
      r.data.games
        .sort((a, b) => a.number - b.number)
        .map((g) => ({
          number: g.number,
          kind: g.kind,
          winner: g.winner,
          players: g.game_players as PlayerEntry[],
        })),
    );
    setScreen("Add Result");
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
  const upcoming = fixtures
    .filter(
      (f) =>
        (demo || f.season === season) &&
        f.date >= new Date().toISOString().slice(0, 10),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
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
  const formComplete = games.length === 12 && games.every(gameComplete);
  const navigate = (name: Screen) => {
    setScreen(name);
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
  const statPanel = (key: "d1" | "checkout" | "score", title: string) => (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <Target size={19} color="#be426d" />
      </div>
      {stats.length ? (
        [...stats]
          .sort((a, b) => b[key] - a[key])
          .slice(0, 5)
          .map((s) => (
            <div className="result-row" key={s.name}>
              <span>{s.name}</span>
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
                ? "A little competition. A lot of community."
                : screen === "Add Result"
                  ? "Upload the original, enter the games, then check and approve."
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
            {["Tables", "Stats", "Archive", "Fixtures"].includes(screen) && (
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
            <div className="summary">
              {[
                [CalendarDays, "Upcoming fixtures", upcoming.length],
                [Trophy, "Approved results", scoped.length],
                [ImageIcon, "Archived sheets", sheets.length],
              ].map(([Icon, label, value]) => {
                const I = Icon as typeof Home;
                return (
                  <div className="card" key={String(label)}>
                    <I size={20} color="#be426d" />
                    <div className="metric">{String(value)}</div>
                    <div className="muted">{String(label)}</div>
                  </div>
                );
              })}
            </div>
            <div className="grid">
              <div>
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
                    results={results}
                    competition="league"
                    cutoff={week}
                    season={season}
                  />
                </div>
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
                <div className="card">
                  <h2>Cup table</h2>
                  <Table
                    results={results}
                    competition="cup"
                    cutoff={week}
                    season={season}
                  />
                </div>
              </div>
              <div>
                <div className="card">
                  <div className="card-head">
                    <h2>Next at the oche</h2>
                    <CalendarDays size={19} color="#be426d" />
                  </div>
                  {upcoming.length ? (
                    upcoming.slice(0, 3).map((f) => (
                      <div key={f.id} className="result-row">
                        <div>
                          <span className="eyebrow">{dateLabel(f.date)}</span>
                          <h3>
                            {f.home} <span className="muted">vs</span> {f.away}
                          </h3>
                          <span className="badge">{f.competition}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty">
                      No upcoming fixtures. Add the season schedule to get
                      started.
                    </div>
                  )}
                </div>
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
              <h2>{competition === "league" ? "League" : "Cup"} standings</h2>
              <button
                className="secondary"
                disabled={!scoped.length}
                onClick={() =>
                  downloadCSV(
                    `${competition}-${season.replace("/", "-")}.csv`,
                    standings(results, competition, week, season),
                  )
                }
              >
                <Download size={16} /> CSV / Excel
              </button>
            </div>
            <Table
              results={results}
              competition={competition}
              cutoff={week}
              season={season}
            />
          </div>
        )}
        {screen === "Stats" && (
          <>
            <p className="muted">
              Approved {competition} results only · through {dateLabel(week)}
            </p>
            <div className="grid">
              {statPanel("d1", "Most Double 1 finishes")}
              {statPanel("checkout", "Highest checkout")}
              {statPanel("score", "Highest score")}
            </div>
            <button
              className="secondary"
              disabled={!stats.length}
              onClick={() => downloadCSV("player-statistics.csv", stats)}
            >
              <Download size={16} /> Export CSV for Excel
            </button>
          </>
        )}
        {screen === "Fixtures" && (
          <>
            <div className="card">
              <div className="card-head">
                <h2>Fixtures & results</h2>
                <span className="badge">{competition}</span>
              </div>
              {fixtures
                .filter(
                  (f) =>
                    (demo || f.season === season) &&
                    f.competition === competition,
                )
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((f) => {
                  const r = results.find(
                    (r) =>
                      r.home === f.home &&
                      r.away === f.away &&
                      r.date === f.date &&
                      r.competition === f.competition,
                  );
                  return (
                    <div className="result-row" key={f.id}>
                      <div>
                        <span className="eyebrow">{dateLabel(f.date)}</span>
                        <h3>
                          {f.home} vs {f.away}
                        </h3>
                        <p className="muted">
                          {r
                            ? r.approved
                              ? "Approved"
                              : "Draft"
                            : "Awaiting result"}
                        </p>
                      </div>
                      <div>
                        {r && (
                          <span className="score">
                            {r.homeWins} – {r.awayWins}
                          </span>
                        )}
                        <button
                          className="secondary"
                          disabled={demo || busy}
                          onClick={() => {
                            if (r) void editResult(r.id);
                            else {
                              chooseFixture(f.id);
                              setScreen("Add Result");
                            }
                          }}
                          style={{ marginLeft: 8 }}
                        >
                          {r ? "Edit" : "Add result"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              {!fixtures.length && (
                <div className="empty">
                  No fixtures yet. Register teams and players, then add a
                  fixture below.
                </div>
              )}
            </div>
            <SetupForms
              clientReady={Boolean(client) && !demo}
              teams={teams}
              seasons={seasons}
              reload={load}
              notify={setMessage}
            />
          </>
        )}
        {screen === "Add Result" && (
          <>
            <div className="card">
              <h2>1. Select the fixture</h2>
              <label style={{ marginTop: 18 }}>
                Fixture
                <select
                  value={fixtureId}
                  onChange={(e) => chooseFixture(e.target.value)}
                >
                  <option value="">Choose a fixture</option>
                  {fixtures
                    .filter((f) => demo || f.season === season)
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
                    Keep the original photograph here, then select the players
                    and tap each winning team below. No scanning is needed.
                  </p>
                  <label>
                    Original photograph (JPEG, PNG or WebP, up to 10 MB)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
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
                        : "Archive photograph"}
                    </button>
                    {sheetId && (
                      <span className="badge">Original archived</span>
                    )}
                  </div>
                </div>
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
                        Check against the original sheet before approving. Home{" "}
                        {games.filter((g) => g.winner === "home").length} – Away{" "}
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
                              {players.find((x) => x.id === p.player_id)?.name}{" "}
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
                          onClick={() => setReview(false)}
                        >
                          Make corrections
                        </button>
                        <button
                          className="primary"
                          disabled={demo || busy || !formComplete || !sheetId}
                          onClick={approve}
                        >
                          Approve & save result
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="notice" role="status">
                        {games.filter(gameComplete).length} of 12 games complete
                        · {selected.home}{" "}
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
                          key={g.number}
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
              </>
            )}
          </>
        )}
        {screen === "Archive" && (
          <>
            <div className="card">
              <h2>Original result sheets</h2>
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
              {sheets
                .filter((s) => {
                  const f = fixtures.find((f) => f.id === s.fixture_id);
                  return (
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
                          {dateLabel(f.date)} · {f.competition}
                        </p>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => openSheet(s)}
                      >
                        View original
                      </button>
                    </div>
                  );
                })}
              {!sheets.length && (
                <div className="empty">
                  <ImageIcon style={{ margin: "0 auto 12px" }} />
                  Original photographs will appear here after secure upload.
                  Corrections retain every original.
                </div>
              )}
            </div>
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
                <button
                  className="secondary"
                  onClick={() => setArchivePreview("")}
                >
                  Close
                </button>
              </div>
            )}
          </>
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
                <div style={{ alignSelf: "end" }}>
                  <button
                    className="primary"
                    onClick={async () => {
                      if (!weeklyRef.current) return;
                      setBusy(true);
                      try {
                        const url = await toPng(weeklyRef.current, {
                          pixelRatio: 2,
                          backgroundColor: "#fff8fb",
                        });
                        const a = document.createElement("a");
                        a.download = `CCLDL-${week}${demo ? "-DEMO" : ""}.png`;
                        a.href = url;
                        a.click();
                      } catch {
                        setMessage("PNG generation failed. Please try again.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                  >
                    <Download size={16} /> Download PNG
                  </button>
                </div>
              </div>
              <p className="muted">
                Cutoff is inclusive. Historical views use currently approved,
                corrected records; frozen historical publication snapshots are
                planned for Phase 2.
              </p>
            </div>
            <div ref={weeklyRef} className="week">
              <span className="eyebrow">
                Chelmsford City Ladies Darts League
              </span>
              <h1>Weekly overview</h1>
              <p className="muted">
                {season} · Through {dateLabel(week)}
                {demo ? " · FICTIONAL DEMONSTRATION" : ""}
              </p>
              <div className="notice">
                {incomplete.length
                  ? `Incomplete: ${incomplete.length} scheduled fixtures through this date await approved results.`
                  : "All recorded fixtures through this date have approved results. Schedule completeness has not been independently confirmed."}
              </div>
              <div className="card">
                <h2>League table</h2>
                <Table
                  results={results}
                  competition="league"
                  cutoff={week}
                  season={season}
                />
              </div>
              <div className="card">
                <h2>Cup table</h2>
                <Table
                  results={results}
                  competition="cup"
                  cutoff={week}
                  season={season}
                />
              </div>
              <p className="muted">
                Player statistics · {competition} only (select competition in
                Stats)
              </p>
              {statPanel("d1", "Most Double 1s")}
              {statPanel("checkout", "Highest checkout")}
              {statPanel("score", "Highest score")}
              <p className="eyebrow">CCLDL · Every game counts</p>
            </div>
          </>
        )}
        {screen === "More" && (
          <>
            <div className="card">
              {nav
                .filter((n) =>
                  ["Tables", "Archive", "Weekly Overview"].includes(n.name),
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
          { name: "Stats", icon: BarChart3 },
          { name: "More", icon: Menu },
        ].map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={
              screen === name ||
              (name === "More" &&
                ["Tables", "Archive", "Weekly Overview"].includes(screen))
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
  clientReady,
  teams,
  seasons,
  reload,
  notify,
}: {
  clientReady: boolean;
  teams: Option[];
  seasons: Option[];
  reload: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
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
    <div className="card">
      <h2>Season administration</h2>
      <p className="muted">
        The committee account can manage teams, players, seasons and fixtures.
      </p>
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
