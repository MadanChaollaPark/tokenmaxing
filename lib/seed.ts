import type { DailyUsage, UsageProvider, UsageSample } from "@/lib/types";

const seedUsers = [
  {
    userId: "ari",
    displayName: "Ari Chen",
    handle: "@ari",
    team: "Inference",
    role: "Staff Engineer",
    region: "SFO",
    base: 9200000
  },
  {
    userId: "noor",
    displayName: "Noor Patel",
    handle: "@noor",
    team: "Agents",
    role: "ML Engineer",
    region: "NYC",
    base: 7800000
  },
  {
    userId: "mika",
    displayName: "Mika Stone",
    handle: "@mika",
    team: "Infra",
    role: "Platform Engineer",
    region: "LDN",
    base: 6600000
  },
  {
    userId: "jules",
    displayName: "Jules Rivera",
    handle: "@jules",
    team: "Product",
    role: "Builder",
    region: "BER",
    base: 5200000
  },
  {
    userId: "sam",
    displayName: "Sam Okafor",
    handle: "@sam",
    team: "Research",
    role: "Research Engineer",
    region: "AMS",
    base: 4700000
  },
  {
    userId: "lena",
    displayName: "Lena Hart",
    handle: "@lena",
    team: "DevEx",
    role: "Developer Advocate",
    region: "SEA",
    base: 3600000
  },
  {
    userId: "ren",
    displayName: "Ren Walsh",
    handle: "@ren",
    team: "Security",
    role: "Security Engineer",
    region: "DUB",
    base: 2900000
  },
  {
    userId: "talia",
    displayName: "Talia Brooks",
    handle: "@talia",
    team: "Mobile",
    role: "iOS Engineer",
    region: "LAX",
    base: 2100000
  }
];

const providerMix: UsageProvider[] = ["codex", "claude"];
const codexModels = ["gpt-5.3-codex-spark", "gpt-5.2-codex", "gpt-5.3-codex"];
const claudeModels = ["claude-sonnet-4-6", "claude-opus-4-1", "claude-haiku-4-5"];

export function seededSamples(now = new Date()): UsageSample[] {
  return seedUsers.flatMap((user, userIndex) =>
    providerMix.map((provider, providerIndex) => {
      const providerWeight = provider === "codex" ? 0.58 : 0.42;
      const daily = buildDailyUsage(now, provider, user.base * providerWeight, userIndex, providerIndex);
      const totals = daily.reduce(
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
        userId: user.userId,
        displayName: user.displayName,
        handle: user.handle,
        team: user.team,
        role: user.role,
        region: user.region,
        provider,
        source: "seed",
        updatedAt: new Date(now.getTime() - (userIndex + providerIndex) * 17 * 60 * 1000).toISOString(),
        totals,
        daily
      };
    })
  );
}

function buildDailyUsage(
  now: Date,
  provider: UsageProvider,
  baseTokens: number,
  userIndex: number,
  providerIndex: number
): DailyUsage[] {
  const days: DailyUsage[] = [];
  const modelNames = provider === "codex" ? codexModels : claudeModels;

  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);

    const wave = 0.72 + Math.sin((offset + userIndex * 1.7 + providerIndex) / 3.2) * 0.18;
    const weekdayBoost = [0, 6].includes(day.getDay()) ? 0.74 : 1;
    const growth = 1 + (29 - offset) * (0.006 + userIndex * 0.0007);
    const totalTokens = Math.max(42000, Math.round((baseTokens / 30) * wave * weekdayBoost * growth));
    const inputTokens = Math.round(totalTokens * (provider === "codex" ? 0.48 : 0.38));
    const outputTokens = Math.round(totalTokens * (provider === "codex" ? 0.16 : 0.2));
    const cacheReadTokens = Math.round(totalTokens * (provider === "codex" ? 0.27 : 0.28));
    const cacheCreationTokens = Math.max(0, totalTokens - inputTokens - outputTokens - cacheReadTokens);
    const rate = provider === "codex" ? 0.0000068 : 0.0000089;
    const totalCost = Number((totalTokens * rate).toFixed(2));
    const primaryModel = modelNames[(offset + userIndex) % modelNames.length];
    const secondaryModel = modelNames[(offset + userIndex + 1) % modelNames.length];

    days.push({
      date: localDayKey(day),
      provider,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      totalTokens,
      totalCost,
      models: [
        {
          provider,
          modelName: primaryModel,
          totalTokens: Math.round(totalTokens * 0.72),
          totalCost: Number((totalCost * 0.72).toFixed(2))
        },
        {
          provider,
          modelName: secondaryModel,
          totalTokens: Math.round(totalTokens * 0.28),
          totalCost: Number((totalCost * 0.28).toFixed(2))
        }
      ]
    });
  }

  return days;
}

function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
