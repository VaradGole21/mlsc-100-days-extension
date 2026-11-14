import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, Check, CheckCircle2, ChevronRight, Code2, Flame,
  RefreshCw, Settings2, Target, Trophy, UserRound, Zap
} from "lucide-react";
import { importLeetCodeSubmissions } from "./database/import";
import {
  getAllSubmissions,
  getSubmissionStatistics
} from "./database/submissions";
import { db, type SubmissionRecord } from "./database/db";
import "./style.css";
type Tab = "control" | "records" | "days";
type Theme = "violet" | "green" | "blue" | "amber" | "mono";
const themes: Record<Theme, { accent: string; soft: string; on: string }> = {
  violet: { accent: "#b794ff", soft: "rgba(183,148,255,.13)", on: "#171020" },
  green: { accent: "#a3e635", soft: "rgba(163,230,53,.13)", on: "#141b0c" },
  blue: { accent: "#7db8ff", soft: "rgba(125,184,255,.13)", on: "#101a29" },
  amber: { accent: "#fbbf65", soft: "rgba(251,191,101,.13)", on: "#21170b" },
  mono: { accent: "#d1d5db", soft: "rgba(209,213,219,.12)", on: "#17191d" }
};
const emptyStats = {
  totalSubmissions: 0,
  acceptedSubmissions: 0,
  rejectedSubmissions: 0,
  uniqueProblems: 0,
  acceptanceRate: 0
};
function App() {
  const [tab, setTab] = useState<Tab>("control");
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("Open LeetCode to connect your account.");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(emptyStats);
  const [recent, setRecent] = useState<SubmissionRecord[]>([]);
  const [recordSearch, setRecordSearch] = useState("");
  const [problemLookup, setProblemLookup] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [languageFilter, setLanguageFilter] = useState("All");
  const [completedDays, setCompletedDays] = useState(0);
  const [challengeCount, setChallengeCount] = useState(100);
  const [selectedDay, setSelectedDay] = useState(1);
  const [dayProgress, setDayProgress] = useState<Record<number, { status: "unlocked" | "attempted" | "completed"; problemSlug: string; notes: string }>>({});
  const [autoSync, setAutoSync] = useState(true);
  const [theme, setTheme] = useState<Theme>("violet");
  const [loaded, setLoaded] = useState(false);
  async function loadData() {
    try {
      const stored = await chrome.storage.local.get([
        "username", "autoSyncEnabled", "mlscTheme"
      ]);
      const user = stored.username || "";
      setUsername(user);
      setAutoSync(stored.autoSyncEnabled !== false);
      const selectedTheme = (stored.mlscTheme || "violet") as Theme;
      setTheme(themes[selectedTheme] ? selectedTheme : "violet");
      const [days, progress] = await Promise.all([
        db.challengeDays.toArray(),
        db.progress.toArray()
      ]);
      setChallengeCount(100);
      const progressMap: Record<number, { status: "unlocked" | "attempted" | "completed"; problemSlug: string; notes: string }> = {};
      for (const item of progress) {
        if (item.dayNumber >= 1 && item.dayNumber <= 100) {
          progressMap[item.dayNumber] = {
            status: item.status === "completed" || item.status === "attempted" ? item.status : "unlocked",
            problemSlug: item.problemSlug || "",
            notes: item.notes || ""
          };
        }
      }
      setDayProgress(progressMap);
      setCompletedDays(progress.filter(p => p.status === "completed").length);
      if (user) {
        const [statistics, submissions] = await Promise.all([
          getSubmissionStatistics(user),
          getAllSubmissions(user)
        ]);
        setStats(statistics);
        setRecent(submissions);
      } else {
        setStats(emptyStats);
        setRecent([]);
      }
    } catch (error) {
      console.error("[MLSC] Could not load popup data:", error);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    void loadData();
  }, []);
  useEffect(() => {
    const palette = themes[theme];
    document.documentElement.style.setProperty("--accent", palette.accent);
    document.documentElement.style.setProperty("--accent-soft", palette.soft);
    document.documentElement.style.setProperty("--accent-on", palette.on);
  }, [theme]);
  async function detect() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const active = tabs[0];
      if (!active?.id || !active.url?.startsWith("https://leetcode.com/")) {
        throw new Error("Open LeetCode in the active tab first.");
      }
      const result: any = await chrome.tabs.sendMessage(active.id, {
        type: "MLSC_GET_PROFILE"
      });
      if (!result?.username) {
        throw new Error("Username not detected. Visit your LeetCode profile.");
      }
      await chrome.storage.local.set({ username: result.username });
      setUsername(result.username);
      setStatus(`Connected as ${result.username}`);
      await loadData();
    } catch (error: any) {
      setStatus(error.message || "Could not detect your account.");
    }
  }
  async function sync() {
    setBusy(true);
    setStatus("Checking your LeetCode session...");
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const active = tabs[0];
      if (!active?.id || !active.url?.startsWith("https://leetcode.com/")) {
        throw new Error("Open leetcode.com in the active tab first.");
      }
      const profile: any = await chrome.tabs.sendMessage(active.id, {
        type: "MLSC_GET_PROFILE"
      });
      if (!profile?.username) throw new Error("Could not detect your LeetCode username.");
      const user = profile.username;
      setUsername(user);
      await chrome.storage.local.set({ username: user });
      const stored = await chrome.storage.local.get("syncCheckpoints");
      const checkpoints = stored.syncCheckpoints || {};
      const result: any = await chrome.tabs.sendMessage(active.id, {
        type: "MLSC_SYNC",
        maxPages: 5,
        stopAtSubmissionId: checkpoints[user] || null
      });
      if (!result?.ok) throw new Error(result?.error || "Could not read LeetCode data.");
      const saved = await importLeetCodeSubmissions(user, result.submissions || []);
      if (result.submissions?.length) {
        checkpoints[user] = result.submissions[0].submission_id;
        await chrome.storage.local.set({ syncCheckpoints: checkpoints });
      }
      setStatus(`Sync complete · ${saved.inserted} new submissions saved`);
      await loadData();
    } catch (error: any) {
      setStatus(error.message || "Sync failed. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function updateChallengeDay(
dayNumber: number,
updates: Partial<{ status: "unlocked" | "attempted" | "completed"; problemSlug: string; notes: string }>
  ) {
    const current = dayProgress[dayNumber] || {
      status: "unlocked" as const,
      problemSlug: "",
      notes: ""
    };
    const next = { ...current, ...updates };
    const completedAtMs = next.status === "completed" ? Date.now() : undefined;
    await db.progress.put({
      dayNumber,
      status: next.status,
      attempts: next.status === "attempted" ? 1 : 0,
      completedAtMs,
      problemSlug: next.problemSlug,
      notes: next.notes,
      updatedAtMs: Date.now()
    });
    setDayProgress(previous => ({ ...previous, [dayNumber]: next }));
    setCompletedDays(Object.values({ ...dayProgress, [dayNumber]: next })
      .filter(item => item.status === "completed").length);
  }
  async function syncAllHistory() {
    if (busy) return;
    setBusy(true);
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const active = tabs[0];
      if (!active?.id || !active.url?.startsWith("https://leetcode.com/")) {
        throw new Error("Open LeetCode in the active tab first.");
      }
      const profile: any = await chrome.tabs.sendMessage(active.id, {
        type: "MLSC_GET_PROFILE"
      });
      if (!profile?.username) throw new Error("Could not detect your LeetCode username.");
      const user = profile.username;
      setUsername(user);
      await chrome.storage.local.set({ username: user });
      const savedState = await chrome.storage.local.get("fullHistorySync");
      const previous = savedState.fullHistorySync;
      let nextPage = previous?.username === user ? Number(previous.nextPage || 0) : 0;
      let totalSaved = 0;
      let totalFetched = 0;
      setStatus(nextPage ? `Resuming full history from page ${nextPage + 1}...` : "Starting full history sync...");
      while (true) {
        const result: any = await chrome.tabs.sendMessage(active.id, {
          type: "MLSC_SYNC",
          startPage: nextPage,
          maxPages: 5
        });
        if (!result?.ok) throw new Error(result?.error || "Full history sync failed.");
        const batch = result.submissions || [];
        const saved = await importLeetCodeSubmissions(user, batch);
        totalSaved += saved.inserted;
        totalFetched += batch.length;
        nextPage = Number(result.nextPage ?? nextPage + 5);
        await chrome.storage.local.set({
          fullHistorySync: { username: user, nextPage, updatedAtMs: Date.now() }
        });
        setStatus(`Full sync · ${totalFetched} fetched · ${totalSaved} new saved · page ${nextPage}`);
        if (!result.hasMore || result.pagesFetched === 0) {
          await chrome.storage.local.remove("fullHistorySync");
          setStatus(`Full history sync complete · ${totalSaved} new submissions saved`);
          await loadData();
          break;
        }
      }
    } catch (error: any) {
      setStatus(`${error.message || "Full history sync interrupted."} Progress saved; try again to resume.`);
    } finally {
      setBusy(false);
    }
  }
  async function toggleAutoSync() {
    const next = !autoSync;
    setAutoSync(next);
    await chrome.storage.local.set({ autoSyncEnabled: next });
  }
  async function chooseTheme(next: Theme) {
    setTheme(next);
    await chrome.storage.local.set({ mlscTheme: next });
  }
  const accepted = (value: string) => value.toLowerCase() === "accepted";
  const languages = [...new Set(recent.map(item => item.language || "Unknown"))].sort();
  const statuses = [...new Set(recent.map(item => item.status))].sort();
  const filteredRecords = recent.filter(item => {
    const matchesSearch = `${item.problemTitle} ${item.problemSlug}`.toLowerCase().includes(recordSearch.toLowerCase());
    const matchesStatus = statusFilter === "All" || item.status === statusFilter;
    const matchesLanguage = languageFilter === "All" || (item.language || "Unknown") === languageFilter;
    return matchesSearch && matchesStatus && matchesLanguage;
  });

  // Search the complete locally synced submission history by LeetCode URL or slug.
  const lookupInput = problemLookup.trim();
  const lookupSlug = (
    lookupInput.match(/leetcode\.com\/problems\/([^/?#]+)/i)?.[1]
    || lookupInput.replace(/^\/+|\/+$/g, "")
  ).toLowerCase();
  const lookupMatches = lookupSlug
    ? recent.filter(item => item.problemSlug.trim().toLowerCase() === lookupSlug)
    : [];
  const lookupAccepted = lookupMatches.some(item => accepted(item.status));
  const lookupStatus = !lookupInput
    ? null
    : !lookupSlug
      ? "invalid"
      : !loaded
        ? "loading"
        : lookupMatches.length === 0
          ? "not-found"
          : lookupAccepted
            ? "solved"
            : "attempted";
  const lookupTitle = lookupMatches[0]?.problemTitle || lookupSlug;
  const activityByDate = new Map<string, number>();
  for (const item of recent) {
    const date = new Date(item.timestampMs);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    activityByDate.set(key, (activityByDate.get(key) || 0) + 1);
  }
  const today = new Date();
  const heatmapDays = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 27 + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { key, date, count: activityByDate.get(key) || 0 };
  });
  const weeklyDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 6 + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return {
      label: date.toLocaleDateString("en", { weekday: "short" }),
      count: activityByDate.get(key) || 0
    };
  });
  const weeklyMax = Math.max(1, ...weeklyDays.map(day => day.count));
  const languageCounts = Object.entries(
    recent.reduce<Record<string, number>>((acc, item) => {
      const language = item.language || "Unknown";
      acc[language] = (acc[language] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const acceptedCount = recent.filter(item => accepted(item.status)).length;
  const otherCount = recent.length - acceptedCount;
  const acceptedRecords = recent.filter(item => accepted(item.status));
  const solvedProblems = new Set(acceptedRecords.map(item => item.problemSlug));
  const solvedByDate = new Map<string, Set<string>>();
  for (const item of acceptedRecords) {
    const date = new Date(item.timestampMs);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (!solvedByDate.has(key)) solvedByDate.set(key, new Set());
    solvedByDate.get(key)!.add(item.problemSlug);
  }
  const solvedDates = [...solvedByDate.keys()].sort();
  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate: Date | null = null;
  for (const key of solvedDates) {
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const consecutive = previousDate !== null &&
      Math.round((date.getTime() - previousDate.getTime()) / 86400000) === 1;
    runningStreak = consecutive ? runningStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
    previousDate = date;
  }
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  let currentStreak = 0;
  if (solvedByDate.has(todayKey) || solvedByDate.has(yesterdayKey)) {
    currentStreak = 1;
    let cursor = new Date(solvedByDate.has(todayKey) ? today : yesterday);
    while (true) {
      cursor.setDate(cursor.getDate() - 1);
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      if (!solvedByDate.has(key)) break;
      currentStreak++;
    }
  }
  const todaySolved = solvedByDate.get(todayKey)?.size || 0;
  return (
    <div className="app">
      <header className="hdr">
        <div className="brand">
          <div className="logo"><Code2 size={19} /></div>
          <div className="brand-txt">
            <div className="brand-title">MLSC <span>100 DAYS</span></div>
            <div className="brand-sub">One problem. Every day.</div>
          </div>
        </div>
        <div className="header-meta">
          <span className={`sync-pill ${username ? "online" : ""}`}>
            <i />{username ? "Connected" : "Local"}
          </span>
          <span className="version">v0.1.0</span>
        </div>
      </header>
      <nav className="tabs">
        {(["control", "records", "days"] as Tab[]).map(item => (
          <button
            key={item}
            className={`tab ${tab === item ? "active" : ""}`}
            onClick={() => setTab(item)}
          >
            {item === "control" ? "Control Center" : item === "records" ? "Records" : "100 Days"}
          </button>
        ))}
      </nav>
      <main className="main">
        {tab === "control" && (
          <section className="panel">
            <div className="panel-intro">
              <div><div className="eyebrow">PREFERENCES</div><h1>Control Center</h1></div>
              <small>Changes apply immediately.</small>
            </div>
            <section className="card">
              <div className="card-heading"><span>LeetCode account</span><small>connection</small></div>
              <div className="account-row">
                <div className="feature-icon"><UserRound size={16} /></div>
                <div className="row-copy">
                  <b>{username || "Not connected"}</b>
                  <small>{username ? "Account detected in this browser" : "Open LeetCode while logged in"}</small>
                </div>
                <div className="control-action">
                  <button className="small-button" onClick={detect}>Detect</button>
                  <details className="info-hint">
                    <summary aria-label="About account detection">i</summary>
                    <span>Checks your active LeetCode tab and saves the detected username locally.</span>
                  </details>
                </div>
              </div>
            </section>
            <section className="card">
              <div className="card-heading"><span>Data & sync</span><small>local-first</small></div>
              <div className="account-row">
                <div className="feature-icon"><RefreshCw size={16} /></div>
                <div className="row-copy">
                  <b>Submission sync</b>
                  <small>Fetch up to 5 pages per manual sync</small>
                </div>
                <div className="control-action">
                  <button className="small-button" onClick={sync} disabled={busy}>
                    {busy ? <RefreshCw size={13} className="spin" /> : "Sync now"}
                  </button>
                  <details className="info-hint">
                    <summary aria-label="About manual sync">i</summary>
                    <span>Fetches recent submissions from your logged-in LeetCode account and saves them in this browser.</span>
                  </details>
                </div>
              </div>
              <div className="setting-row full-sync-row">
                <div className="feature-icon"><Activity size={16} /></div>
                <div className="row-copy">
                  <b>Full history sync</b>
                  <small>Import older submissions in batches</small>
                </div>
                <button className="small-button" onClick={syncAllHistory} disabled={busy}>
                  {busy ? "Working..." : "Sync all"}
                </button>
              </div>
              <div className="setting-row">
                <div className="feature-icon"><Zap size={16} /></div>
                <div className="row-copy">
                  <b>Automatic sync</b>
                  <small>Check for new submissions every 5 minutes</small>
                </div>
                <button
                  role="switch"
                  aria-checked={autoSync}
                  className={`switch ${autoSync ? "on" : ""}`}
                  onClick={toggleAutoSync}
                ><span /></button>
                <details className="info-hint">
                  <summary aria-label="About automatic sync">i</summary>
                  <span>When enabled, MLSC checks an open LeetCode tab every five minutes for new submissions.</span>
                </details>
              </div>
              <div className="status-line"><span className="status-dot" />{status}</div>
            </section>
            <section className="card">
              <div className="card-heading"><span>Appearance</span><small>personalize</small></div>
              <div className="theme-label">
                <div className="theme-title">
                  <b>Accent theme</b>
                  <details className="info-hint">
                    <summary aria-label="About accent themes">i</summary>
                    <span>Changes the popup accent colour. Your selection is saved on this browser.</span>
                  </details>
                </div>
                <small>Choose your popup accent.</small>
              </div>
              <div className="swatches">
                {(Object.keys(themes) as Theme[]).map(name => (
                  <button
                    key={name}
                    title={name}
                    aria-label={`${name} theme`}
                    className={`swatch ${theme === name ? "selected" : ""}`}
                    style={{ background: themes[name].accent }}
                    onClick={() => chooseTheme(name)}
                  >
                    {theme === name && <Check size={13} color={themes[name].on} />}
                  </button>
                ))}
              </div>
            </section>
            <details className="card disclosure">
              <summary>
                <span><b>Privacy & storage</b><small>How your data is handled</small></span>
                <ChevronRight size={15} />
              </summary>
              <p>Submission metadata is stored in IndexedDB on this browser. Your LeetCode session remains in your browser. No password or session cookie is requested by MLSC.</p>
            </details>
          </section>
        )}
        {tab === "records" && (
          <section className="panel">
            <div className="panel-intro">
              <div><div className="eyebrow">FROM YOUR SOLVE HISTORY</div><h1>Records</h1></div>
              <small>Use your recent attempts to decide what to practise next.</small>
            </div>
            <section className="card" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div className="card-heading">
              <span>Problem status checker</span>
              <Code2 size={15} />
            </div>
            <p style={{ color: "var(--dim)", fontSize: 11, lineHeight: 1.5, margin: 0 }}>
              Check whether a problem has been solved or attempted in your synced history.
            </p>
            <input
              className="record-search"
              type="search"
              placeholder="Paste LeetCode URL or problem slug..."
              value={problemLookup}
              onChange={event => setProblemLookup(event.target.value)}
            />
            {!lookupInput ? (
              <p style={{ color: "var(--dim)", fontSize: 10, margin: 0 }}>
                Example: two-sum or leetcode.com/problems/two-sum/
              </p>
            ) : lookupStatus === "invalid" ? (
              <p style={{ color: "var(--dim)", fontSize: 11, margin: 0 }}>
                Enter a valid LeetCode problem URL or slug.
              </p>
            ) : lookupStatus === "loading" ? (
              <p style={{ color: "var(--dim)", fontSize: 11, margin: 0 }}>
                Loading submission history...
              </p>
            ) : lookupStatus === "not-found" ? (
              <div style={{ display: "flex", gap: 10, padding: 12, border: "1px solid var(--border)", borderRadius: 9 }}>
                <Code2 size={18} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <b style={{ fontSize: 12 }}>Not found in synced history</b>
                  <small style={{ color: "var(--dim)", fontSize: 10, lineHeight: 1.5 }}>
                    No submission for this problem exists in your locally stored records. This does not necessarily mean you have never attempted it.
                  </small>
                </div>
              </div>
            ) : lookupStatus === "solved" ? (
              <div style={{ display: "flex", gap: 10, padding: 12, border: "1px solid rgba(163,230,53,.3)", borderRadius: 9, color: "var(--ok)" }}>
                <CheckCircle2 size={18} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <b style={{ fontSize: 12 }}>Solved · Accepted</b>
                  <small style={{ color: "var(--dim)", fontSize: 10 }}>
                    {lookupTitle} · {lookupMatches.length} recorded attempt{lookupMatches.length === 1 ? "" : "s"}
                  </small>
                </div>
              </div>
            ) : lookupStatus === "attempted" ? (
              <div style={{ display: "flex", gap: 10, padding: 12, border: "1px solid rgba(251,191,101,.3)", borderRadius: 9, color: "#fbbf65" }}>
                <Activity size={18} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <b style={{ fontSize: 12 }}>Attempted · Not solved</b>
                  <small style={{ color: "var(--dim)", fontSize: 10 }}>
                    {lookupTitle} · {lookupMatches.length} recorded attempt{lookupMatches.length === 1 ? "" : "s"}
                  </small>
                </div>
              </div>
            ) : null}
            {lookupMatches.length > 0 && (
              <a
                className="day-problem-link"
                href={`https://leetcode.com/problems/${encodeURIComponent(lookupSlug)}/`}
                target="_blank"
                rel="noreferrer"
              >
                Open problem on LeetCode <ChevronRight size={13} />
              </a>
            )}
          </section>

          <section className="card highlight-card">
              <div className="card-heading"><span>Your activity</span><Activity size={15} /></div>
              <div className="metrics">
                <div><strong>{loaded ? solvedProblems.size : "—"}</strong><small>Solved</small></div>
                <div><strong>{loaded ? stats.acceptedSubmissions : "—"}</strong><small>Accepted</small></div>
                <div><strong>{loaded ? `${stats.acceptanceRate}%` : "—"}</strong><small>Acceptance</small></div>
              </div>
            </section>
            <section className="card">
              <div className="card-heading"><span>Solving consistency</span><small>accepted submissions only</small></div>
              <div className="streak-grid">
                <div><Flame size={16} /><strong>{currentStreak}</strong><small>Current streak</small></div>
                <div><Trophy size={16} /><strong>{longestStreak}</strong><small>Longest streak</small></div>
                <div><CheckCircle2 size={16} /><strong>{todaySolved}</strong><small>Solved today</small></div>
              </div>
              <div className="solved-summary">
                <span>{solvedProblems.size} unique problems solved</span>
                <span>{solvedByDate.size} active solve days</span>
              </div>
            </section>
            <section className="card activity-card">
              <div className="card-heading"><span>Activity · last 28 days</span><small>{heatmapDays.reduce((sum, day) => sum + (day.count > 0 ? 1 : 0), 0)} active days</small></div>
              <div className="heatmap-months"><span>{heatmapDays[0].date.toLocaleDateString("en", { month: "short" })}</span><span>{today.toLocaleDateString("en", { month: "short" })}</span></div>
              <div className="heatmap-grid">
                {heatmapDays.map(day => (
                  <div
                    key={day.key}
                    className={`heat-cell level-${day.count === 0 ? 0 : day.count === 1 ? 1 : day.count <= 3 ? 2 : day.count <= 6 ? 3 : 4}`}
                    title={`${day.key}: ${day.count} submission${day.count === 1 ? "" : "s"}`}
                  />
                ))}
              </div>
              <div className="heatmap-legend"><span>Less</span>{[0, 1, 2, 3, 4].map(level => <i key={level} className={`heat-cell level-${level}`} />)}<span>More</span></div>
            </section>
            <section className="card">
              <div className="card-heading"><span>Last 7 days</span><small>submissions per day</small></div>
              <div className="weekly-chart">
                {weeklyDays.map(day => (
                  <div className="weekly-column" key={day.label}>
                    <span className="weekly-value">{day.count || ""}</span>
                    <div className="weekly-bar-track"><div className="weekly-bar" style={{ height: `${day.count ? Math.max(5, day.count / weeklyMax * 100) : 0}%` }} /></div>
                    <span className="weekly-label">{day.label}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="card">
              <div className="card-heading"><span>Submission breakdown</span><small>{recent.length} total attempts</small></div>
              <div className="verdict-summary">
                <div><span className="verdict-dot accepted-dot" /><span>Accepted</span><strong>{acceptedCount}</strong></div>
                <div><span className="verdict-dot other-dot" /><span>Other verdicts</span><strong>{otherCount}</strong></div>
              </div>
              <div className="verdict-track">
                <div className="verdict-accepted" style={{ width: `${recent.length ? acceptedCount / recent.length * 100 : 0}%` }} />
              </div>
              <div className="card-heading language-heading"><span>Languages used</span><small>by submission count</small></div>
              {languageCounts.length ? languageCounts.map(([language, count]) => (
                <div className="language-row" key={language}>
                  <span>{language}</span>
                  <div className="language-track"><div style={{ width: `${count / Math.max(1, languageCounts[0][1]) * 100}%` }} /></div>
                  <strong>{count}</strong>
                </div>
              )) : <p className="analytics-empty">No language data yet. Sync your submissions first.</p>}
            </section>
            <section className="card">
              <div className="card-heading"><span>Submission history</span><small>{filteredRecords.length} / {recent.length}</small></div>
              <input
                className="record-search"
                type="search"
                placeholder="Search problem title or slug..."
                value={recordSearch}
                onChange={event => setRecordSearch(event.target.value)}
              />
              <div className="record-filters">
                <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                  <option value="All">All verdicts</option>
                  {statuses.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
                <select value={languageFilter} onChange={event => setLanguageFilter(event.target.value)}>
                  <option value="All">All languages</option>
                  {languages.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              {recent.length === 0 ? (
                <div className="empty">
                  <Code2 size={22} />
                  <b>No solve history yet</b>
                  <small>Connect LeetCode and sync your submissions to see your activity here.</small>
                  <button className="small-button" onClick={() => setTab("control")}>Connect account</button>
                </div>
              ) : (
                <div className="submission-list">
                  {filteredRecords.length === 0 ? (
                    <div className="empty"><b>No matching submissions</b><small>Try changing your search or filters.</small></div>
                  ) : filteredRecords.map(item => (
                    <a
                      className="submission-row"
                      key={item.id}
                      href={`https://leetcode.com/problems/${item.problemSlug}/`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className={`result-icon ${accepted(item.status) ? "accepted" : ""}`}>
                        {accepted(item.status) ? <CheckCircle2 size={15} /> : <Code2 size={15} />}
                      </span>
                      <span className="submission-copy">
                        <b>{item.problemTitle}</b>
                        <small>{item.language || "Unknown"} · {new Date(item.timestampMs).toLocaleDateString()}</small>
                      </span>
                      <span className={`result-label ${accepted(item.status) ? "accepted" : ""}`}>
                        {item.status}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </section>
            <p className="note">Showing your locally stored LeetCode submissions. Select any row to open its problem on LeetCode.</p>
          </section>
        )}
        {tab === "days" && (
          <section className="panel">
            <div className="panel-intro">
              <div><div className="eyebrow">THE 100-DAY CHALLENGE</div><h1>Your journey</h1></div>
              <small>One day at a time.</small>
            </div>
            <section className="card journey-card">
              <div className="journey-top">
                <div>
                  <div className="journey-kicker">OVERALL PROGRESS</div>
                  <div className="journey-total"><strong>{completedDays}</strong><span> / 100 days</span></div>
                </div>
                <div className="journey-percent">{completedDays}%</div>
              </div>
              <div className="progress-track"><div style={{ width: `${completedDays}%` }} /></div>
              <div className="journey-bottom">
                <span>{100 - completedDays} days remaining</span>
                <span>{Math.round(completedDays)}% completed</span>
              </div>
            </section>
            <div className="challenge-stats">
              <div className="mini-stat">
                <span className="mini-stat-icon"><CheckCircle2 size={14} /></span>
                <strong>{completedDays}</strong>
                <small>Completed</small>
              </div>
              <div className="mini-stat">
                <span className="mini-stat-icon"><Activity size={14} /></span>
                <strong>{Object.values(dayProgress).filter(item => item.status === "attempted").length}</strong>
                <small>Attempted</small>
              </div>
              <div className="mini-stat">
                <span className="mini-stat-icon"><Code2 size={14} /></span>
                <strong>{stats.uniqueProblems}</strong>
                <small>LeetCode solved</small>
              </div>
            </div>
            <section className="card roadmap-card">
              <div className="card-heading">
                <span>100-day roadmap</span>
                <small>{completedDays} of 100 complete</small>
              </div>
              <div className="roadmap-legend">
                <span><i className="legend-dot done" />Completed</span>
                <span><i className="legend-dot attempted" />Attempted</span>
                <span><i className="legend-dot pending" />Pending</span>
              </div>
              <div className="day-grid">
                {Array.from({ length: 100 }, (_, index) => index + 1).map(day => {
                  const item = dayProgress[day];
                  const dayStatus = item?.status || "unlocked";
                  return (
                    <button
                      key={day}
                      className={`day-cell ${dayStatus} ${selectedDay === day ? "selected" : ""}`}
                      title={`Day ${day} · ${dayStatus === "completed" ? "Completed" : dayStatus === "attempted" ? "Attempted" : "Pending"}`}
                      onClick={() => setSelectedDay(day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <div className="roadmap-foot">Select any day to view or update its details.</div>
            </section>
            <section className="card selected-day-card">
              <div className="selected-day-heading">
                <div>
                  <div className="eyebrow">DAY {String(selectedDay).padStart(2, "0")}</div>
                  <h2>Challenge details</h2>
                </div>
                <span className={`selected-status ${(dayProgress[selectedDay]?.status || "unlocked")}`}>
                  {(dayProgress[selectedDay]?.status || "unlocked") === "completed" ? "Completed" : (dayProgress[selectedDay]?.status || "unlocked") === "attempted" ? "Attempted" : "Pending"}
                </span>
              </div>
              <label className="day-field-label">Progress status</label>
              <select
                className="day-field"
                value={dayProgress[selectedDay]?.status || "unlocked"}
                onChange={event => void updateChallengeDay(selectedDay, { status: event.target.value as "unlocked" | "attempted" | "completed" })}
              >
                <option value="unlocked">Pending</option>
                <option value="attempted">Attempted</option>
                <option value="completed">Completed</option>
              </select>
              <label className="day-field-label">LeetCode problem slug <span>Optional</span></label>
              <input
                className="day-field"
                value={dayProgress[selectedDay]?.problemSlug || ""}
                placeholder="e.g. two-sum"
                onChange={event => void updateChallengeDay(selectedDay, { problemSlug: event.target.value.trim() })}
              />
              <label className="day-field-label">Personal notes <span>Optional</span></label>
              <textarea
                className="day-field day-notes"
                value={dayProgress[selectedDay]?.notes || ""}
                placeholder="Approach, complexity, what you learned..."
                rows={2}
                onChange={event => void updateChallengeDay(selectedDay, { notes: event.target.value })}
              />
              {dayProgress[selectedDay]?.problemSlug && (
                <a className="day-problem-link" href={`https://leetcode.com/problems/${encodeURIComponent(dayProgress[selectedDay].problemSlug)}/`} target="_blank" rel="noreferrer">
                  Open problem on LeetCode <ChevronRight size={13} />
                </a>
              )}
            </section>
            <p className="note">Progress is saved locally. Day completion is self-reported until official challenge verification is integrated.</p>
          </section>
        )}
      </main>
      <footer className="footer">
        <a href="https://github.com/" target="_blank" rel="noreferrer">GitHub</a>
        <span>Local-first · MLSC 100 Days</span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
