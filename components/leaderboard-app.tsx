"use client";

import {
  Activity,
  Code2,
  Database,
  Filter,
  Gauge,
  Github,
  KeyRound,
  Link2,
  LogIn,
  LogOut,
  PlugZap,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  Trophy,
  UploadCloud,
  Users,
  X,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usageProviders } from "@/lib/types";
import type {
  LeaderboardResponse,
  LeaderboardRow,
  ProviderConnection,
  ProviderKey,
  UsageProvider,
  UserSession,
  WindowKey
} from "@/lib/types";

interface LeaderboardAppProps {
  initialData: LeaderboardResponse;
}

const windows: { label: string; value: WindowKey }[] = [
  { label: "Today", value: "today" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "All", value: "all" }
];

const providerLabels: Record<UsageProvider, string> = {
  codex: "Codex",
  openai: "OpenAI",
  xai: "xAI",
  claude: "Claude",
  other: "Other"
};

const providerColors: Record<UsageProvider, string> = {
  codex: "#0f766e",
  openai: "#111827",
  xai: "#4f46e5",
  claude: "#b45309",
  other: "#64748b"
};

const providers: { label: string; value: ProviderKey }[] = [
  { label: "All", value: "all" },
  ...usageProviders.map((value) => ({ label: providerLabels[value], value }))
];

type AuthSnapshot = {
  authenticated: boolean;
  database: boolean;
  githubOAuth: boolean;
  localLogin: boolean;
  localSubmit: boolean;
  session: UserSession | null;
  connections: ProviderConnection[];
};

type ConnectTab = "codexbar" | "openai" | "xai" | "manual";

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
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectTab, setConnectTab] = useState<ConnectTab>("openai");
  const [auth, setAuth] = useState<AuthSnapshot>({
    authenticated: false,
    database: false,
    githubOAuth: false,
    localLogin: true,
    localSubmit: true,
    session: null,
    connections: []
  });
  const [loginForm, setLoginForm] = useState({
    displayName: "",
    team: "Unassigned",
    role: "Builder",
    region: "Remote"
  });
  const [openAiForm, setOpenAiForm] = useState({ apiKey: "", days: "30" });
  const [xAiForm, setXAiForm] = useState({ managementKey: "", teamId: "", days: "30" });
  const [manualForm, setManualForm] = useState({
    provider: "openai" as UsageProvider,
    modelName: "manual",
    inputTokens: "",
    outputTokens: "",
    totalCost: ""
  });
  const [connectionState, setConnectionState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [connectionMessage, setConnectionMessage] = useState("");

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

  useEffect(() => {
    loadSession();
  }, []);

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

  async function loadSession() {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const payload = (await response.json()) as AuthSnapshot;
    setAuth(payload);
    if (payload.session) {
      setLoginForm({
        displayName: payload.session.displayName,
        team: payload.session.team,
        role: payload.session.role,
        region: payload.session.region
      });
    }
  }

  async function loginLocal() {
    setConnectionState("submitting");
    setConnectionMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm)
      });
      if (!response.ok) throw new Error("Login failed");
      await loadSession();
      setConnectionState("success");
      setConnectionMessage("Signed in");
    } catch (error) {
      setConnectionState("error");
      setConnectionMessage(error instanceof Error ? error.message : "Login failed");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await loadSession();
  }

  async function deleteMyData() {
    setConnectionState("submitting");
    setConnectionMessage("");
    try {
      const response = await fetch("/api/users/me/delete", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Delete failed");
      await loadSession();
      setConnectionState("success");
      setConnectionMessage("Deleted your submitted data");
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setConnectionState("error");
      setConnectionMessage(error instanceof Error ? error.message : "Delete failed");
    }
  }

  async function syncOpenAi() {
    await syncProvider("/api/providers/openai/sync", {
      apiKey: openAiForm.apiKey,
      days: Number(openAiForm.days || 30)
    });
    setOpenAiForm((value) => ({ ...value, apiKey: "" }));
  }

  async function syncXai() {
    await syncProvider("/api/providers/xai/sync", {
      managementKey: xAiForm.managementKey,
      teamId: xAiForm.teamId,
      days: Number(xAiForm.days || 30)
    });
    setXAiForm((value) => ({ ...value, managementKey: "" }));
  }

  async function submitManualUsage() {
    await syncProvider("/api/usage/manual", {
      provider: manualForm.provider,
      modelName: manualForm.modelName,
      inputTokens: Number(manualForm.inputTokens || 0),
      outputTokens: Number(manualForm.outputTokens || 0),
      totalCost: Number(manualForm.totalCost || 0)
    });
    setManualForm((value) => ({ ...value, inputTokens: "", outputTokens: "", totalCost: "" }));
  }

  async function submitCodexBarFromDialog() {
    await syncProvider("/api/usage/submit-local", {});
  }

  async function syncProvider(endpoint: string, body: Record<string, unknown>) {
    setConnectionState("submitting");
    setConnectionMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        tokens?: number;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Sync failed");
      }
      setConnectionState("success");
      setConnectionMessage(payload.tokens ? `Synced ${formatTokens(payload.tokens)} tokens` : "Synced");
      await loadSession();
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setConnectionState("error");
      setConnectionMessage(error instanceof Error ? error.message : "Sync failed");
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
          {auth.session ? (
            <button className="user-pill" type="button" onClick={logout}>
              <LogOut size={15} aria-hidden="true" />
              {auth.session.displayName}
            </button>
          ) : (
            <button className="repo-button" type="button" onClick={() => setConnectOpen(true)}>
              <LogIn size={16} aria-hidden="true" />
              Login
            </button>
          )}
          <button
            className="submit-button"
            type="button"
            onClick={submitLocalUsage}
            disabled={submitState === "submitting" || !auth.localSubmit}
          >
            <UploadCloud size={16} aria-hidden="true" />
            {submitState === "submitting" ? "Submitting" : "Submit usage"}
          </button>
          <button className="connect-button" type="button" onClick={() => setConnectOpen(true)}>
            <PlugZap size={16} aria-hidden="true" />
            Connect
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

      {connectOpen ? (
        <ConnectDialog
          auth={auth}
          connectTab={connectTab}
          connectionMessage={connectionMessage}
          connectionState={connectionState}
          loginForm={loginForm}
          manualForm={manualForm}
          openAiForm={openAiForm}
          xAiForm={xAiForm}
          onClose={() => setConnectOpen(false)}
          onLogin={loginLocal}
          onManualFormChange={setManualForm}
          onOpenAiFormChange={setOpenAiForm}
          onSetConnectTab={setConnectTab}
          onSubmitCodexBar={submitCodexBarFromDialog}
          onSubmitManual={submitManualUsage}
          onSyncOpenAi={syncOpenAi}
          onSyncXai={syncXai}
          onDeleteData={deleteMyData}
          onLoginFormChange={setLoginForm}
          onXAiFormChange={setXAiForm}
        />
      ) : null}

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

function ConnectDialog({
  auth,
  connectTab,
  connectionMessage,
  connectionState,
  loginForm,
  manualForm,
  onClose,
  onDeleteData,
  onLogin,
  onLoginFormChange,
  onManualFormChange,
  onOpenAiFormChange,
  onSetConnectTab,
  onSubmitCodexBar,
  onSubmitManual,
  onSyncOpenAi,
  onSyncXai,
  onXAiFormChange,
  openAiForm,
  xAiForm
}: {
  auth: AuthSnapshot;
  connectTab: ConnectTab;
  connectionMessage: string;
  connectionState: "idle" | "submitting" | "success" | "error";
  loginForm: { displayName: string; team: string; role: string; region: string };
  manualForm: {
    provider: UsageProvider;
    modelName: string;
    inputTokens: string;
    outputTokens: string;
    totalCost: string;
  };
  openAiForm: { apiKey: string; days: string };
  xAiForm: { managementKey: string; teamId: string; days: string };
  onClose: () => void;
  onDeleteData: () => void;
  onLogin: () => void;
  onLoginFormChange: (value: { displayName: string; team: string; role: string; region: string }) => void;
  onManualFormChange: (value: {
    provider: UsageProvider;
    modelName: string;
    inputTokens: string;
    outputTokens: string;
    totalCost: string;
  }) => void;
  onOpenAiFormChange: (value: { apiKey: string; days: string }) => void;
  onSetConnectTab: (value: ConnectTab) => void;
  onSubmitCodexBar: () => void;
  onSubmitManual: () => void;
  onSyncOpenAi: () => void;
  onSyncXai: () => void;
  onXAiFormChange: (value: { managementKey: string; teamId: string; days: string }) => void;
}) {
  const busy = connectionState === "submitting";

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="connect-dialog" role="dialog" aria-modal="true" aria-labelledby="connect-title">
        <div className="dialog-heading">
          <div>
            <h2 id="connect-title">Connect Usage</h2>
            <p>{auth.session ? auth.session.displayName : "Sign in to publish provider usage"}</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        {!auth.session && auth.localLogin ? (
          <div className="login-grid">
            <label className="stacked-field">
              <span>Name</span>
              <input
                value={loginForm.displayName}
                onChange={(event) => onLoginFormChange({ ...loginForm, displayName: event.target.value })}
                placeholder="Madan"
              />
            </label>
            <label className="stacked-field">
              <span>Team</span>
              <input
                value={loginForm.team}
                onChange={(event) => onLoginFormChange({ ...loginForm, team: event.target.value })}
              />
            </label>
            <label className="stacked-field">
              <span>Role</span>
              <input
                value={loginForm.role}
                onChange={(event) => onLoginFormChange({ ...loginForm, role: event.target.value })}
              />
            </label>
            <label className="stacked-field">
              <span>Region</span>
              <input
                value={loginForm.region}
                onChange={(event) => onLoginFormChange({ ...loginForm, region: event.target.value })}
              />
            </label>
            <div className="dialog-actions">
              <button className="submit-button" type="button" onClick={onLogin} disabled={busy || !loginForm.displayName}>
                <LogIn size={16} aria-hidden="true" />
                Continue
              </button>
              <a className={auth.githubOAuth ? "repo-button" : "repo-button disabled"} href="/api/auth/github/start">
                <Github size={16} aria-hidden="true" />
                GitHub
              </a>
            </div>
          </div>
        ) : !auth.session ? (
          <div className="github-only-panel">
            <a className={auth.githubOAuth ? "submit-button" : "submit-button disabled"} href="/api/auth/github/start">
              <Github size={16} aria-hidden="true" />
              Continue with GitHub
            </a>
            {!auth.githubOAuth ? <span>GitHub OAuth is not configured yet.</span> : null}
          </div>
        ) : (
          <>
            <div className="connection-tabs" role="tablist" aria-label="Usage source">
              {[
                ["openai", "OpenAI"],
                ["xai", "xAI"],
                ["codexbar", "CodexBar"],
                ["manual", "Manual"]
              ].map(([value, label]) => (
                <button
                  className={connectTab === value ? "active" : ""}
                  key={value}
                  type="button"
                  onClick={() => onSetConnectTab(value as ConnectTab)}
                >
                  {label}
                </button>
              ))}
            </div>

            {connectTab === "openai" ? (
              <div className="provider-form">
                <label className="stacked-field">
                  <span>Admin API key</span>
                  <input
                    type="password"
                    value={openAiForm.apiKey}
                    onChange={(event) => onOpenAiFormChange({ ...openAiForm, apiKey: event.target.value })}
                    placeholder="sk-..."
                  />
                </label>
                <label className="stacked-field short">
                  <span>Days</span>
                  <input
                    inputMode="numeric"
                    value={openAiForm.days}
                    onChange={(event) => onOpenAiFormChange({ ...openAiForm, days: event.target.value })}
                  />
                </label>
                <button className="submit-button" type="button" onClick={onSyncOpenAi} disabled={busy || !openAiForm.apiKey}>
                  <KeyRound size={16} aria-hidden="true" />
                  Sync OpenAI
                </button>
              </div>
            ) : null}

            {connectTab === "xai" ? (
              <div className="provider-form">
                <label className="stacked-field">
                  <span>Management key</span>
                  <input
                    type="password"
                    value={xAiForm.managementKey}
                    onChange={(event) => onXAiFormChange({ ...xAiForm, managementKey: event.target.value })}
                  />
                </label>
                <label className="stacked-field">
                  <span>Team ID</span>
                  <input
                    value={xAiForm.teamId}
                    onChange={(event) => onXAiFormChange({ ...xAiForm, teamId: event.target.value })}
                  />
                </label>
                <label className="stacked-field short">
                  <span>Days</span>
                  <input
                    inputMode="numeric"
                    value={xAiForm.days}
                    onChange={(event) => onXAiFormChange({ ...xAiForm, days: event.target.value })}
                  />
                </label>
                <button
                  className="submit-button"
                  type="button"
                  onClick={onSyncXai}
                  disabled={busy || !xAiForm.managementKey || !xAiForm.teamId}
                >
                  <KeyRound size={16} aria-hidden="true" />
                  Sync xAI
                </button>
              </div>
            ) : null}

            {connectTab === "codexbar" ? (
              <div className="provider-form single">
                <button className="submit-button" type="button" onClick={onSubmitCodexBar} disabled={busy}>
                  <UploadCloud size={16} aria-hidden="true" />
                  Submit CodexBar
                </button>
              </div>
            ) : null}

            {connectTab === "manual" ? (
              <div className="provider-form manual-grid">
                <label className="stacked-field">
                  <span>Provider</span>
                  <select
                    value={manualForm.provider}
                    onChange={(event) =>
                      onManualFormChange({ ...manualForm, provider: event.target.value as UsageProvider })
                    }
                  >
                    {usageProviders.map((item) => (
                      <option key={item} value={item}>
                        {providerLabels[item]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="stacked-field">
                  <span>Model</span>
                  <input
                    value={manualForm.modelName}
                    onChange={(event) => onManualFormChange({ ...manualForm, modelName: event.target.value })}
                  />
                </label>
                <label className="stacked-field">
                  <span>Input tokens</span>
                  <input
                    inputMode="numeric"
                    value={manualForm.inputTokens}
                    onChange={(event) => onManualFormChange({ ...manualForm, inputTokens: event.target.value })}
                  />
                </label>
                <label className="stacked-field">
                  <span>Output tokens</span>
                  <input
                    inputMode="numeric"
                    value={manualForm.outputTokens}
                    onChange={(event) => onManualFormChange({ ...manualForm, outputTokens: event.target.value })}
                  />
                </label>
                <label className="stacked-field">
                  <span>Spend</span>
                  <input
                    inputMode="decimal"
                    value={manualForm.totalCost}
                    onChange={(event) => onManualFormChange({ ...manualForm, totalCost: event.target.value })}
                  />
                </label>
                <button className="submit-button" type="button" onClick={onSubmitManual} disabled={busy}>
                  <Link2 size={16} aria-hidden="true" />
                  Submit Manual
                </button>
              </div>
            ) : null}

            <div className="connection-list">
              {auth.connections.map((connection) => (
                <span className={`connection-chip ${connection.status}`} key={connection.id}>
                  {providerLabels[connection.provider]} · {connection.authMethod}
                </span>
              ))}
            </div>
            <div className="danger-zone">
              <a href="/privacy">Privacy</a>
              <button className="danger-button" type="button" onClick={onDeleteData} disabled={busy}>
                Delete my data
              </button>
            </div>
          </>
        )}

        {connectionMessage ? (
          <span className={`dialog-message ${connectionState}`} role="status">
            {connectionMessage}
          </span>
        ) : null}
      </section>
    </div>
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
  const total = Math.max(1, usageProviders.reduce((sum, item) => sum + row.providers[item], 0));
  const segments = usageProviders
    .map((item) => ({
      provider: item,
      label: providerLabels[item],
      tokens: row.providers[item],
      percent: (row.providers[item] / total) * 100
    }))
    .filter((item) => item.tokens > 0);

  return (
    <div className={large ? "provider-mix large" : "provider-mix"}>
      <div className="mix-track" aria-hidden="true">
        {segments.length ? (
          segments.map((segment) => (
            <span
              key={segment.provider}
              style={{
                width: `${segment.percent}%`,
                background: providerColors[segment.provider]
              }}
            />
          ))
        ) : (
          <span style={{ width: "100%", background: providerColors.other }} />
        )}
      </div>
      <div className="mix-labels">
        {(segments.length ? segments : [{ label: "Other", percent: 100, provider: "other" as const, tokens: 0 }])
          .slice(0, 3)
          .map((segment) => (
            <span key={segment.provider}>
              {segment.label} {Math.round(segment.percent)}%
            </span>
          ))}
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
