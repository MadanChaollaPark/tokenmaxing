import type { DailyUsage, UsageSample, UserSession } from "@/lib/types";

const openAiApiBase = "https://api.openai.com/v1";

interface OpenAiUsageResponse {
  data?: Array<{
    start_time?: number;
    results?: Array<{
      input_tokens?: number;
      output_tokens?: number;
      input_cached_tokens?: number;
      model?: string | null;
    }>;
  }>;
}

interface OpenAiCostsResponse {
  data?: Array<{
    start_time?: number;
    results?: Array<{
      amount?: {
        value?: number;
      };
    }>;
  }>;
}

export async function fetchOpenAiUsageSample({
  apiKey,
  days,
  identity
}: {
  apiKey: string;
  days: number;
  identity: UserSession;
}): Promise<UsageSample> {
  const startTime = Math.floor(startOfTodayMinus(days - 1).getTime() / 1000);
  const endTime = Math.floor(endOfToday().getTime() / 1000);
  const usageParams = new URLSearchParams({
    start_time: String(startTime),
    end_time: String(endTime),
    bucket_width: "1d",
    limit: String(Math.min(Math.max(days, 1), 180))
  });
  usageParams.append("group_by", "model");

  const [usage, costs] = await Promise.all([
    openAiGet<OpenAiUsageResponse>(`/organization/usage/completions?${usageParams.toString()}`, apiKey),
    openAiGet<OpenAiCostsResponse>(
      `/organization/costs?${new URLSearchParams({
        start_time: String(startTime),
        end_time: String(endTime),
        bucket_width: "1d",
        limit: String(Math.min(Math.max(days, 1), 180))
      }).toString()}`,
      apiKey
    ).catch(() => ({ data: [] }))
  ]);

  const costsByDay = new Map(
    (costs.data || []).map((bucket) => [
      dayKeyFromSeconds(bucket.start_time),
      (bucket.results || []).reduce((sum, result) => sum + number(result.amount?.value), 0)
    ])
  );

  const daily = (usage.data || [])
    .map((bucket): DailyUsage => {
      const date = dayKeyFromSeconds(bucket.start_time);
      const models = (bucket.results || []).map((result) => {
        const inputTokens = number(result.input_tokens);
        const outputTokens = number(result.output_tokens);
        return {
          provider: "openai" as const,
          modelName: result.model || "unknown",
          totalTokens: Math.round(inputTokens + outputTokens),
          totalCost: 0
        };
      });
      const inputTokens = models.reduce((sum, _model, index) => {
        const result = bucket.results?.[index];
        return sum + number(result?.input_tokens);
      }, 0);
      const outputTokens = models.reduce((sum, _model, index) => {
        const result = bucket.results?.[index];
        return sum + number(result?.output_tokens);
      }, 0);
      const cacheReadTokens = (bucket.results || []).reduce((sum, result) => sum + number(result.input_cached_tokens), 0);

      return {
        date,
        provider: "openai",
        inputTokens: Math.round(inputTokens),
        outputTokens: Math.round(outputTokens),
        cacheReadTokens: Math.round(cacheReadTokens),
        cacheCreationTokens: 0,
        totalTokens: Math.round(inputTokens + outputTokens),
        totalCost: Number((costsByDay.get(date) || 0).toFixed(6)),
        models
      };
    })
    .filter((day) => day.totalTokens > 0 || day.totalCost > 0);

  const totalTokens = daily.reduce((sum, day) => sum + day.totalTokens, 0);
  if (!totalTokens) {
    throw new Error("OpenAI returned no usage for the selected window.");
  }

  return {
    userId: identity.userId,
    displayName: identity.displayName,
    team: identity.team,
    role: identity.role,
    region: identity.region,
    provider: "openai",
    source: "openai-admin-api",
    updatedAt: new Date().toISOString(),
    totals: {
      inputTokens: daily.reduce((sum, day) => sum + day.inputTokens, 0),
      outputTokens: daily.reduce((sum, day) => sum + day.outputTokens, 0),
      cacheReadTokens: daily.reduce((sum, day) => sum + day.cacheReadTokens, 0),
      cacheCreationTokens: 0,
      totalTokens,
      totalCost: Number(daily.reduce((sum, day) => sum + day.totalCost, 0).toFixed(6))
    },
    daily
  };
}

async function openAiGet<T>(path: string, apiKey: string): Promise<T> {
  const response = await fetch(`${openAiApiBase}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI usage sync failed (${response.status}): ${body.slice(0, 180)}`);
  }
  return (await response.json()) as T;
}

function startOfTodayMinus(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - Math.max(days, 0));
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function dayKeyFromSeconds(value: number | undefined) {
  const date = new Date((value || 0) * 1000);
  return Number.isNaN(date.getTime()) ? dayKey(new Date()) : dayKey(date);
}

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function number(value: unknown) {
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
}
