import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { seededSamples } from "@/lib/seed";
import type {
  DailyUsage,
  LeaderboardFilters,
  LeaderboardResponse,
  LeaderboardRow,
  ModelUsage,
  ProviderKey,
  ProviderSplit,
  UsageProvider,
  UsageSample,
  WindowKey
} from "@/lib/types";
import { usageProviders } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const usageFile = path.join(dataDir, "usage-samples.jsonl");

const providerSchema = z.enum(usageProviders);

const modelUsageSchema = z.object({
  provider: providerSchema.default("other"),
  modelName: z.string().min(1),
  totalTokens: z.number().int().nonnegative().default(0),
  totalCost: z.number().nonnegative().default(0)
});

const dailyUsageSchema = z.object({
  date: z.string().min(10),
  provider: providerSchema,
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  cacheReadTokens: z.number().int().nonnegative().default(0),
  cacheCreationTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
  totalCost: z.number().nonnegative().default(0),
  models: z.array(modelUsageSchema).default([])
});

export const usageSampleSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  handle: z.string().optional(),
  team: z.string().optional(),
  role: z.string().optional(),
  region: z.string().optional(),
  provider: providerSchema,
  source: z.string().min(1).default("collector"),
  updatedAt: z.string().default(() => new Date().toISOString()),
  totals: z
    .object({
      inputTokens: z.number().int().nonnegative().default(0),
      outputTokens: z.number().int().nonnegative().default(0),
      cacheReadTokens: z.number().int().nonnegative().default(0),
      cacheCreationTokens: z.number().int().nonnegative().default(0),
      totalTokens: z.number().int().nonnegative().default(0),
      totalCost: z.number().nonnegative().default(0)
    })
    .optional(),
  daily: z.array(dailyUsageSchema).default([])
});

const ingestSchema = z.union([
  usageSampleSchema,
  z.object({ samples: z.array(usageSampleSchema).min(1) }),
  z.array(usageSampleSchema).min(1)
]);

type ParsedUsageSample = z.infer<typeof usageSampleSchema>;

export async function parseIngestPayload(input: unknown): Promise<UsageSample[]> {
  const parsed = ingestSchema.parse(input);
  const samples = Array.isArray(parsed) ? parsed : "samples" in parsed ? parsed.samples : [parsed];
  return samples.map(withComputedTotals);
}

export async function appendUsageSamples(samples: UsageSample[]) {
  await mkdir(dataDir, { recursive: true });
  const merged = latestSamplesByUserProvider([...(await readStoredUsageSamples()), ...samples]);
  const lines = merged.map((sample) => JSON.stringify(sample)).join("\n");
  await writeFile(usageFile, lines ? `${lines}\n` : "");
}

export async function getLeaderboard(filters: LeaderboardFilters): Promise<LeaderboardResponse> {
  const samples = [...seededSamples(), ...(await readUsageSamples())];
  const normalizedFilters = normalizeFilters(filters);
  const rows = aggregateRows(samples, normalizedFilters);
  const teams = Array.from(new Set(samples.map((sample) => sample.team || "Unassigned"))).sort();
  const summary = summarize(rows);

  return {
    filters: normalizedFilters,
    summary,
    rows,
    teams,
    generatedAt: new Date().toISOString()
  };
}

async function readUsageSamples(): Promise<UsageSample[]> {
  return latestSamplesByUserProvider(await readStoredUsageSamples());
}

async function readStoredUsageSamples(): Promise<UsageSample[]> {
  try {
    const raw = await readFile(usageFile, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [withComputedTotals(usageSampleSchema.parse(JSON.parse(line)))];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function latestSamplesByUserProvider(samples: UsageSample[]): UsageSample[] {
  const latest = new Map<string, UsageSample>();
  for (const sample of samples) {
    const key = `${sample.userId}:${sample.provider}`;
    const existing = latest.get(key);
    if (!existing || new Date(sample.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      latest.set(key, sample);
    }
  }
  return Array.from(latest.values());
}

function withComputedTotals(sample: ParsedUsageSample): UsageSample {
  const totalsFromDaily = sample.daily.reduce(
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
    ...sample,
    team: sample.team || "Unassigned",
    role: sample.role || "Builder",
    region: sample.region || "Remote",
    totals: sample.totals ?? totalsFromDaily,
    daily: sample.daily
  };
}

function normalizeFilters(filters: LeaderboardFilters): LeaderboardFilters {
  return {
    window: isWindowKey(filters.window) ? filters.window : "30d",
    provider: isProviderKey(filters.provider) ? filters.provider : "all",
    team: filters.team || "all",
    query: filters.query || ""
  };
}

function aggregateRows(samples: UsageSample[], filters: LeaderboardFilters): LeaderboardRow[] {
  const now = new Date();
  const cutoff = cutoffForWindow(filters.window, now);
  const grouped = new Map<string, UsageSample[]>();
  const query = filters.query.trim().toLowerCase();

  for (const sample of samples) {
    if (filters.provider !== "all" && sample.provider !== filters.provider) continue;
    if (filters.team !== "all" && (sample.team || "Unassigned") !== filters.team) continue;
    if (query) {
      const haystack = [sample.displayName, sample.handle, sample.team, sample.role, sample.region]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) continue;
    }
    const existing = grouped.get(sample.userId) ?? [];
    existing.push(sample);
    grouped.set(sample.userId, existing);
  }

  return Array.from(grouped.values())
    .map((userSamples) => aggregateUser(userSamples, cutoff, now))
    .filter((row) => row.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens || b.estimatedCost - a.estimatedCost)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      badges: badgesForRow({ ...row, rank: index + 1 })
    }));
}

function aggregateUser(samples: UsageSample[], cutoff: Date | null, now: Date): LeaderboardRow {
  const identity = samples.reduce((latest, sample) =>
    new Date(sample.updatedAt).getTime() > new Date(latest.updatedAt).getTime() ? sample : latest
  );
  const trendBuckets = makeTrendBuckets(cutoff, now);
  const modelMap = new Map<string, ModelUsage>();

  let tokens = 0;
  let estimatedCost = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheTokens = 0;
  let delta24h = 0;
  const providers = emptyProviderSplit();
  let lastSyncAt = identity.updatedAt;

  for (const sample of samples) {
    if (new Date(sample.updatedAt) > new Date(lastSyncAt)) {
      lastSyncAt = sample.updatedAt;
    }

    for (const day of sample.daily) {
      const dayDate = parseDay(day.date);
      if (cutoff && dayDate < cutoff) continue;
      tokens += day.totalTokens;
      estimatedCost += day.totalCost;
      inputTokens += day.inputTokens;
      outputTokens += day.outputTokens;
      cacheTokens += day.cacheReadTokens + day.cacheCreationTokens;
      providers[day.provider] += day.totalTokens;
      if (isWithinLastDay(dayDate, now)) {
        delta24h += day.totalTokens;
      }
      addToTrend(trendBuckets, dayDate, day.totalTokens);
      for (const model of day.models) {
        const key = `${model.provider}:${model.modelName}`;
        const current = modelMap.get(key) ?? {
          provider: model.provider,
          modelName: model.modelName,
          totalTokens: 0,
          totalCost: 0
        };
        current.totalTokens += model.totalTokens;
        current.totalCost += model.totalCost;
        modelMap.set(key, current);
      }
    }
  }

  const topModels = Array.from(modelMap.values()).sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 3);

  return {
    rank: 0,
    userId: identity.userId,
    displayName: identity.displayName,
    handle: identity.handle,
    team: identity.team || "Unassigned",
    role: identity.role || "Builder",
    region: identity.region || "Remote",
    tokens,
    estimatedCost: Number(estimatedCost.toFixed(2)),
    inputTokens,
    outputTokens,
    cacheTokens,
    providers,
    trend: trendBuckets.map((bucket) => bucket.tokens),
    topModel: topModels[0]?.modelName ?? "Mixed",
    topModels,
    badges: [],
    lastSyncAt,
    delta24h
  };
}

function summarize(rows: LeaderboardRow[]) {
  const totalTokens = rows.reduce((sum, row) => sum + row.tokens, 0);
  const estimatedCost = rows.reduce((sum, row) => sum + row.estimatedCost, 0);
  const providerTotals = rows.reduce((acc, row) => {
    for (const provider of usageProviders) {
      acc[provider] += row.providers[provider];
    }
    return acc;
  }, emptyProviderSplit());
  const lastSyncAt = rows
    .map((row) => row.lastSyncAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return {
    totalTokens,
    estimatedCost: Number(estimatedCost.toFixed(2)),
    activeUsers: rows.length,
    avgTokensPerUser: rows.length ? Math.round(totalTokens / rows.length) : 0,
    topProvider: Object.entries(providerTotals).sort((a, b) => b[1] - a[1])[0]?.[0] as UsageProvider,
    lastSyncAt: lastSyncAt ?? new Date().toISOString()
  };
}

function badgesForRow(row: LeaderboardRow): string[] {
  const badges: string[] = [];
  if (row.rank === 1) badges.push("Token Legend");
  if (row.rank <= 3) badges.push("Top 3");
  if (row.delta24h > 450000) badges.push("Burn Rate");
  if (row.cacheTokens / Math.max(row.tokens, 1) > 0.34) badges.push("Cache Wizard");
  if (row.topModels.length >= 3) badges.push("Model Maxxer");
  return badges.slice(0, 3);
}

function cutoffForWindow(window: WindowKey, now: Date) {
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  if (window === "today") return cutoff;
  if (window === "7d") {
    cutoff.setDate(cutoff.getDate() - 6);
    return cutoff;
  }
  if (window === "30d") {
    cutoff.setDate(cutoff.getDate() - 29);
    return cutoff;
  }
  return null;
}

function makeTrendBuckets(cutoff: Date | null, now: Date) {
  const bucketCount = cutoff ? Math.max(1, daysBetween(cutoff, now) + 1) : 30;
  return Array.from({ length: Math.min(bucketCount, 30) }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (Math.min(bucketCount, 30) - 1 - index));
    return { date: dayKey(date), tokens: 0 };
  });
}

function addToTrend(buckets: { date: string; tokens: number }[], date: Date, tokens: number) {
  const key = dayKey(date);
  const bucket = buckets.find((item) => item.date === key);
  if (bucket) bucket.tokens += tokens;
}

function isWithinLastDay(date: Date, now: Date) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 1);
  return date >= cutoff;
}

function parseDay(value: string) {
  const [year, month, day] = value
    .slice(0, 10)
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function isWindowKey(value: string): value is WindowKey {
  return ["today", "7d", "30d", "all"].includes(value);
}

function isProviderKey(value: string): value is ProviderKey {
  return value === "all" || usageProviders.includes(value as UsageProvider);
}

function emptyProviderSplit(): ProviderSplit {
  return {
    codex: 0,
    openai: 0,
    xai: 0,
    claude: 0,
    other: 0
  };
}
