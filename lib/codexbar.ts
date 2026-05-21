import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import type { UsageProvider, UsageSample, UserSession } from "@/lib/types";

const execFileAsync = promisify(execFile);

interface CodexBarCostEntry {
  provider?: string;
  source?: string;
  updatedAt?: string;
  totals?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    totalTokens?: number;
    totalCost?: number;
  };
  daily?: Array<{
    date?: string;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    totalTokens?: number;
    totalCost?: number;
    modelBreakdowns?: Array<{
      modelName?: string;
      totalTokens?: number;
      cost?: number;
    }>;
  }>;
  error?: unknown;
}

interface SubmitIdentity {
  displayName: string;
  region: string;
  role: string;
  team: string;
  userId: string;
}

export async function loadCodexBarSamples(session?: UserSession | null) {
  const codexbarBin = process.env.CODEXBAR_BIN || "codexbar";
  const identity = session ? sessionIdentity(session) : localSubmitIdentity();
  const { stdout } = await execFileAsync(
    codexbarBin,
    ["cost", "--provider", "both", "--format", "json"],
    { maxBuffer: 10 * 1024 * 1024 }
  );
  const payload = JSON.parse(stdout) as CodexBarCostEntry[];
  return codexbarCostEntriesToSamples(payload, identity);
}

function sessionIdentity(session: UserSession): SubmitIdentity {
  return {
    userId: session.userId,
    displayName: session.displayName,
    team: session.team,
    role: session.role,
    region: session.region
  };
}

export function codexbarCostEntriesToSamples(
  entries: CodexBarCostEntry[],
  identity: SubmitIdentity
): UsageSample[] {
  return entries.filter((entry) => !entry.error).map((entry) => toUsageSample(entry, identity));
}

function localSubmitIdentity(): SubmitIdentity {
  const fallbackUser = os.userInfo().username || "local";
  return {
    userId: process.env.TOKENMAXING_USER_ID || fallbackUser,
    displayName: process.env.TOKENMAXING_DISPLAY_NAME || fallbackUser,
    team: process.env.TOKENMAXING_TEAM || "Unassigned",
    role: process.env.TOKENMAXING_ROLE || "Builder",
    region: process.env.TOKENMAXING_REGION || "Local"
  };
}

function toUsageSample(entry: CodexBarCostEntry, identity: SubmitIdentity): UsageSample {
  const provider = normalizeProvider(entry.provider);
  const daily = (entry.daily || []).map((day) => ({
    date: String(day.date || "").slice(0, 10),
    provider,
    inputTokens: number(day.inputTokens),
    outputTokens: number(day.outputTokens),
    cacheReadTokens: number(day.cacheReadTokens),
    cacheCreationTokens: number(day.cacheCreationTokens),
    totalTokens: number(day.totalTokens),
    totalCost: number(day.totalCost),
    models: (day.modelBreakdowns || []).map((model) => ({
      provider,
      modelName: model.modelName || "unknown",
      totalTokens: number(model.totalTokens),
      totalCost: number(model.cost)
    }))
  }));
  const fallbackTotals = daily.reduce(
    (acc, day) => ({
      inputTokens: acc.inputTokens + day.inputTokens,
      outputTokens: acc.outputTokens + day.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + day.cacheReadTokens,
      cacheCreationTokens: acc.cacheCreationTokens + day.cacheCreationTokens,
      totalTokens: acc.totalTokens + day.totalTokens,
      totalCost: acc.totalCost + day.totalCost
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 0,
      totalCost: 0
    }
  );

  return {
    ...identity,
    provider,
    source: entry.source || "codexbar",
    updatedAt: entry.updatedAt || new Date().toISOString(),
    totals: entry.totals
      ? {
          inputTokens: number(entry.totals.inputTokens),
          outputTokens: number(entry.totals.outputTokens),
          cacheReadTokens: number(entry.totals.cacheReadTokens),
          cacheCreationTokens: number(entry.totals.cacheCreationTokens),
          totalTokens: number(entry.totals.totalTokens),
          totalCost: number(entry.totals.totalCost)
        }
      : fallbackTotals,
    daily
  };
}

function normalizeProvider(value: string | undefined): UsageProvider {
  if (value === "codex" || value === "claude") return value;
  return "other";
}

function number(value: unknown) {
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
}
