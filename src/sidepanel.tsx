import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  CheckCircle2,
  Code2,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  getRecentSubmissions,
  getSubmissionStatistics,
} from "./database/submissions";
import type { SubmissionRecord } from "./database/db";
import "./sidepanel.css";

function App() {
  const [username, setUsername] = useState("");
  const [stats, setStats] = useState({
    totalSubmissions: 0,
    acceptedSubmissions: 0,
    rejectedSubmissions: 0,
    uniqueProblems: 0,
    acceptanceRate: 0,
  });
  const [recent, setRecent] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const stored = await chrome.storage.local.get("username");
      const user = stored.username || "";
      setUsername(user);

      if (!user) {
        setStats({
          totalSubmissions: 0,
          acceptedSubmissions: 0,
          rejectedSubmissions: 0,
          uniqueProblems: 0,
          acceptanceRate: 0,
        });
        setRecent([]);
        return;
      }

      const [statistics, submissions] = await Promise.all([
        getSubmissionStatistics(user),
        getRecentSubmissions(user, 10),
      ]);

      setStats(statistics);
      setRecent(submissions);
    } catch (err: any) {
      setError(err.message || "Could not load local data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Code2 size={20} /></div>
          <div>
            <div className="brand-name">MLSC <span>100 DAYS</span></div>
            <div className="brand-subtitle">One problem. Every day.</div>
          </div>
        </div>
        <button
          className="refresh-button"
          onClick={() => void loadDashboard()}
          disabled={loading}
          title="Refresh dashboard"
        >
          <RefreshCw size={17} className={loading ? "spinning" : ""} />
        </button>
      </header>

      <section className="welcome">
        <div className="section-label">YOUR PROGRESS</div>
        <h1>{username ? `Hey, ${username}` : "Welcome to MLSC"}</h1>
        <p>
          {username
            ? "Your LeetCode activity at a glance."
            : "Open LeetCode and sync your submissions to get started."}
        </p>
      </section>

      {error && <div className="error-message">{error}</div>}

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-heading">
            <Activity size={16} /> <span>Submissions</span>
          </div>
          <strong>{loading ? "—" : stats.totalSubmissions}</strong>
          <small>All recorded attempts</small>
        </article>

        <article className="stat-card">
          <div className="stat-heading">
            <CheckCircle2 size={16} /> <span>Accepted</span>
          </div>
          <strong>{loading ? "—" : stats.acceptedSubmissions}</strong>
          <small>Successful submissions</small>
        </article>

        <article className="stat-card">
          <div className="stat-heading">
            <Target size={16} /> <span>Problems</span>
          </div>
          <strong>{loading ? "—" : stats.uniqueProblems}</strong>
          <small>Unique problems attempted</small>
        </article>

        <article className="stat-card">
          <div className="stat-heading">
            <TrendingUp size={16} /> <span>Acceptance</span>
          </div>
          <strong>{loading ? "—" : `${stats.acceptanceRate}%`}</strong>
          <small>Accepted / total submissions</small>
        </article>
      </section>

      <section className="activity-section">
        <div className="section-heading">
          <div>
            <div className="section-label">ACTIVITY</div>
            <h2>Recent submissions</h2>
          </div>
          <span className="record-count">{recent.length} shown</span>
        </div>

        {loading ? (
          <div className="empty-state">Loading your activity…</div>
        ) : recent.length === 0 ? (
          <div className="empty-state">
            <Code2 size={24} />
            <strong>No submissions yet</strong>
            <span>Sync from the extension popup while on LeetCode.</span>
          </div>
        ) : (
          <div className="submission-list">
            {recent.map((submission) => {
              const accepted =
                submission.status.toLowerCase() === "accepted";

              return (
                <article className="submission-row" key={submission.id}>
                  <div className={`result-dot ${accepted ? "accepted" : ""}`}>
                    {accepted ? <CheckCircle2 size={15} /> : <Activity size={15} />}
                  </div>
                  <div className="submission-info">
                    <strong>{submission.problemTitle}</strong>
                    <span>
                      {submission.language || "Unknown language"} ·{" "}
                      {new Date(submission.timestampMs).toLocaleDateString()}
                    </span>
                  </div>
                  <span className={`submission-status ${accepted ? "accepted" : ""}`}>
                    {submission.status}
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="dashboard-footer">
        Stored locally in your browser · MLSC 100 Days
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
