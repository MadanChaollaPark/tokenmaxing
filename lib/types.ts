export type ProviderKey = "all" | "codex" | "claude";
export type UsageProvider = "codex" | "claude" | "other";
export type WindowKey = "today" | "7d" | "30d" | "all";

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  totalCost: number;
}

export interface ModelUsage {
  provider: UsageProvider;
  modelName: string;
  totalTokens: number;
  totalCost: number;
}

export interface DailyUsage {
  date: string;
  provider: UsageProvider;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  totalCost: number;
  models: ModelUsage[];
}

export interface UsageSample {
  userId: string;
  displayName: string;
  handle?: string;
  team?: string;
  role?: string;
  region?: string;
  provider: UsageProvider;
  source: string;
  updatedAt: string;
  totals: UsageTotals;
  daily: DailyUsage[];
}

export interface LeaderboardFilters {
  window: WindowKey;
  provider: ProviderKey;
  team: string;
  query: string;
}

export interface ProviderSplit {
  codex: number;
  claude: number;
  other: number;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string;
  handle?: string;
  team: string;
  role: string;
  region: string;
  tokens: number;
  estimatedCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  providers: ProviderSplit;
  trend: number[];
  topModel: string;
  topModels: ModelUsage[];
  badges: string[];
  lastSyncAt: string;
  delta24h: number;
}

export interface LeaderboardSummary {
  totalTokens: number;
  estimatedCost: number;
  activeUsers: number;
  avgTokensPerUser: number;
  topProvider: UsageProvider;
  lastSyncAt: string;
}

export interface LeaderboardResponse {
  filters: LeaderboardFilters;
  summary: LeaderboardSummary;
  rows: LeaderboardRow[];
  teams: string[];
  generatedAt: string;
}
