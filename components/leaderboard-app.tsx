"use client";

import {
  Activity,
  Code2,
  Database,
  Filter,
  Gauge,
  Github,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  Trophy,
  UploadCloud,
  Users,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LeaderboardResponse, LeaderboardRow, ProviderKey, WindowKey } from "@/lib/types";

interface LeaderboardAppProps {
  initialData: LeaderboardResponse;
}

const windows: { label: string; value: WindowKey }[] = [
  { label: "Today", value: "today" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "All", value: "all" }
];

const providers: { label: string; value: ProviderKey }[] = [
  { label: "All", value: "all" },
  { label: "Codex", value: "codex" },
  { label: "Claude", value: "claude" }
];

const repoUrl = process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/MadanChaollaPark/tokenmaxing";

export function LeaderboardApp({ initialData }: LeaderboardAppProps) {
  const [data, setData] = useState(initialData);
  const [windowKey, setWindowKey] = useState<WindowKey>(initialData.filters.window);
  const [provider, setProvider] = useState<ProviderKey>(initialData.filters.provider);
  const [team, setTeam] = useState(initialData.filters.team);
  const [query, setQuery] = useState(initialData.filters.query);
  const [selectedUserId, setSelectedUserId] = useState(initialData.rows[0]?.userId ?? "");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({
      window: windowKey,
      provider,
      team,
      query
    });
    const controller = new AbortController();
    setIsRefreshing(true);
    fetch(`/api/leaderboard?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((nextData: LeaderboardResponse) => {
        setData(nextData);
        if (!nextData.rows.some((row) => row.userId === selectedUserId)) {
          setSelectedUserId(nextData.rows[0]?.userId ?? "");
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error(error);
        }
      })
      .finally(() => setIsRefreshing(false));
    return () => controller.abort();
  }, [provider, query, refreshNonce, selectedUserId, team, windowKey]);

  const selected = useMemo(
    () => data.rows.find((row) => row.userId === selectedUserId) ?? data.rows[0],
    [data.rows, selectedUserId]
  );

  async function submitLocalUsage() {
    setSubmitState("submitting");
    setSubmitMessage("");
    try {
      const response = await fetch("/api/usage/submit-local", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        accepted?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Submit failed");
      }
      setSubmitState("success");
      setSubmitMessage(`Submitted ${payload.accepted ?? 0}`);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage(error instanceof Error ? error.message : "Submit failed");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">
            <Zap size={20} aria-hidden="true" />
          </div>
          <div>
            <h1>TokenMaxing</h1>
            <p>AI token usage leaderboard</p>
          </div>
        </div>
        <div className="status-cluster">
          <span className="sync-pill">
            <ShieldCheck size={15} aria-hidden="true" />
            Local aggregates
          </span>
          <button
            className="submit-button"
            type="button"
            onClick={submitLocalUsage}
            disabled={submitState === "submitting"}
          >
            <UploadCloud size={16} aria-hidden="true" />
            {submitState === "submitting" ? "Submitting" : "Submit usage"}
          </button>
          <a className="repo-button" href={repoUrl} target="_blank" rel="noreferrer">
            <Github size={16} aria-hidden="true" />
            Improve it
          </a>
          <button
            className="icon-button"
            type="button"
            aria-label="Refresh leaderboard"
            onClick={() => setRefreshNonce((value) => value + 1)}
          >
            <RefreshCw size={17} className={isRefreshing ? "spin" : ""} aria-hidden="true" />
          </button>
          {submitMessage ? (
            <span className={`submit-message ${submitState}`} role="status">
              {submitMessage}
            </span>
          ) : null}
        </div>
      </header>

      <section className="toolbar" aria-label="Leaderboard filters">
        <SegmentedControl
          ariaLabel="Window"
          value={windowKey}
          items={windows}
          onChange={(value) => setWindowKey(value as WindowKey)}
        />
        <SegmentedControl
          ariaLabel="Provider"
          value={provider}
          items={providers}
          onChange={(value) => setProvider(value as ProviderKey)}
        />
        <label className="field-control">
          <Filter size={16} aria-hidden="true" />
          <select value={team} onChange={(event) => setTeam(event.target.value)} aria-label="Team filter">
            <option value="all">All teams</option>
            {data.teams.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="search-control">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users"
            aria-label="Search users"
          />
        </label>
      </section>

      <section className="metrics-strip" aria-label="Summary metrics">
        <Metric label="Tokens" value={formatTokens(data.summary.totalTokens)} icon={<Gauge size={18} />} />
        <Metric label="Spend" value={formatCurrency(data.summary.estimatedCost)} icon={<Activity size={18} />} />
        <Metric label="Users" value={String(data.summary.activeUsers)} icon={<Users size={18} />} />
        <Metric label="Avg / user" value={formatTokens(data.summary.avgTokensPerUser)} icon={<Database size={18} />} />
      </section>

      <section className="workspace-grid">
        <div className="leaderboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Leaderboard</h2>
              <p>{capitalize(windowKey)} ranking by total tokens</p>
            </div>
            <span className="timestamp">Updated {relativeTime(data.summary.lastSyncAt)}</span>
          </div>

          <div className="table-wrap">
            <table className="leaderboard-table" data-testid="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>User</th>
                  <th>Tokens</th>
                  <th>Spend</th>
                  <th>Provider Mix</th>
                  <th>Trend</th>
                  <th>Badges</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.userId}
                    className={row.userId === selected?.userId ? "selected-row" : ""}
                    onClick={() => setSelectedUserId(row.userId)}
                  >
                    <td>
                      <span className="rank-cell">
                        {row.rank === 1 ? <Trophy size={17} aria-hidden="true" /> : null}
                        #{row.rank}
                      </span>
                    </td>
                    <td>
                      <div className="user-cell">
                        <span className="avatar">{initials(row.displayName)}</span>
                        <div>
                          <strong>{row.displayName}</strong>
                          <span>
                            {row.team} · {row.role}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>{formatTokens(row.tokens)}</strong>
                      <span className="sub-value">+{formatTokens(row.delta24h)} 24h</span>
                    </td>
                    <td>{formatCurrency(row.estimatedCost)}</td>
                    <td>
                      <ProviderBar row={row} />
                    </td>
                    <td>
                      <Sparkline values={row.trend} />
                    </td>
                    <td>
                      <div className="badge-row">
                        {row.badges.map((badge) => (
                          <span className="badge" key={badge}>
                            {badge}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="detail-panel" aria-label="Selected user detail">
          {selected ? (
            <>
              <div className="detail-header">
                <span className="avatar large">{initials(selected.displayName)}</span>
                <div>
                  <h2>{selected.displayName}</h2>
                  <p>
                    {selected.team} · {selected.region}
                  </p>
                </div>
              </div>
              <div className="detail-stats">
                <Metric label="Tokens" value={formatTokens(selected.tokens)} icon={<Gauge size={17} />} compact />
                <Metric label="Cache" value={formatTokens(selected.cacheTokens)} icon={<Database size={17} />} compact />
              </div>
              <div className="split-section">
                <h3>Provider Split</h3>
                <ProviderBar row={selected} large />
              </div>
              <div className="model-section">
                <h3>Top Models</h3>
                {selected.topModels.map((model) => (
                  <div className="model-row" key={`${model.provider}-${model.modelName}`}>
                    <div>
                      <Code2 size={15} aria-hidden="true" />
                      <span>{model.modelName}</span>
                    </div>
                    <strong>{formatTokens(model.totalTokens)}</strong>
                  </div>
                ))}
              </div>
              <div className="collector-panel">
                <div>
                  <Terminal size={17} aria-hidden="true" />
                  <span>Collector</span>
                </div>
                <code>npm run collect:codexbar</code>
              </div>
            </>
          ) : (
            <div className="empty-state">No matching users</div>
          )}
        </aside>
      </section>
    </main>
  );
}

function SegmentedControl({
  ariaLabel,
  items,
  onChange,
  value
}: {
  ariaLabel: string;
  items: { label: string; value: string }[];
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="segmented-control" role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={item.value === value ? "active" : ""}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Metric({
  compact = false,
  icon,
  label,
  value
}: {
  compact?: boolean;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className={compact ? "metric compact" : "metric"}>
      <span className="metric-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function ProviderBar({ large = false, row }: { large?: boolean; row: LeaderboardRow }) {
  const total = Math.max(1, row.providers.codex + row.providers.claude + row.providers.other);
  const codex = (row.providers.codex / total) * 100;
  const claude = (row.providers.claude / total) * 100;
  const other = Math.max(0, 100 - codex - claude);

  return (
    <div className={large ? "provider-mix large" : "provider-mix"}>
      <div className="mix-track" aria-hidden="true">
        <span className="codex" style={{ width: `${codex}%` }} />
        <span className="claude" style={{ width: `${claude}%` }} />
        <span className="other" style={{ width: `${other}%` }} />
      </div>
      <div className="mix-labels">
        <span>Codex {Math.round(codex)}%</span>
        <span>Claude {Math.round(claude)}%</span>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * 118;
      const y = 34 - (value / max) * 30;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox="0 0 120 38" role="img" aria-label="Token trend">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function formatTokens(value: number) {
  if (value >= 1_000_000_000) return `${trim(value / 1_000_000_000)}B`;
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trim(value / 1_000)}K`;
  return String(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
    style: "currency"
  }).format(value);
}

function relativeTime(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return "just now";
  const minutes = Math.max(0, Math.round(diff / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function trim(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(value >= 100 ? 0 : 1);
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function capitalize(value: string) {
  if (value === "7d" || value === "30d") return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
