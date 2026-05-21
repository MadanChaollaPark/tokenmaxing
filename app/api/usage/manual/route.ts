import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionFromRequest } from "@/lib/auth";
import { connectionId, upsertProviderConnection } from "@/lib/provider-connections";
import { checkRateLimit } from "@/lib/rate-limit";
import { PayloadTooLargeError, readJsonBody } from "@/lib/request";
import { appendUsageSamples } from "@/lib/store";
import { usageProviders } from "@/lib/types";
import type { UsageSample } from "@/lib/types";

const manualSchema = z.object({
  provider: z.enum(usageProviders),
  date: z.string().min(10).optional(),
  modelName: z.string().min(1).max(80).default("manual"),
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  cacheReadTokens: z.number().int().nonnegative().default(0),
  cacheCreationTokens: z.number().int().nonnegative().default(0),
  totalCost: z.number().nonnegative().default(0)
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const rate = checkRateLimit(request, `usage-manual:${session.userId}`, { limit: 20, windowMs: 60_000 });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate limited", retryAfter: rate.retryAfter }, { status: 429 });
  }

  try {
    const body = manualSchema.parse(await readJsonBody(request, 16 * 1024));
    const date = (body.date || new Date().toISOString()).slice(0, 10);
    const totalTokens = body.inputTokens + body.outputTokens;
    if (!totalTokens) {
      return NextResponse.json({ error: "manual submit needs at least one token" }, { status: 400 });
    }
    const sample: UsageSample = {
      userId: session.userId,
      displayName: session.displayName,
      team: session.team,
      role: session.role,
      region: session.region,
      provider: body.provider,
      source: "manual",
      updatedAt: new Date().toISOString(),
      totals: {
        inputTokens: body.inputTokens,
        outputTokens: body.outputTokens,
        cacheReadTokens: body.cacheReadTokens,
        cacheCreationTokens: body.cacheCreationTokens,
        totalTokens,
        totalCost: body.totalCost
      },
      daily: [
        {
          date,
          provider: body.provider,
          inputTokens: body.inputTokens,
          outputTokens: body.outputTokens,
          cacheReadTokens: body.cacheReadTokens,
          cacheCreationTokens: body.cacheCreationTokens,
          totalTokens,
          totalCost: body.totalCost,
          models: [
            {
              provider: body.provider,
              modelName: body.modelName,
              totalTokens,
              totalCost: body.totalCost
            }
          ]
        }
      ]
    };
    await appendUsageSamples([sample]);
    await upsertProviderConnection({
      id: connectionId(session.userId, body.provider, "manual"),
      userId: session.userId,
      provider: body.provider,
      authMethod: "manual",
      label: "Manual submit",
      status: "connected",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncAt: sample.updatedAt
    });

    return NextResponse.json({
      accepted: 1,
      provider: body.provider,
      tokens: totalTokens,
      updatedAt: sample.updatedAt
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "invalid manual submit", issues: error.issues }, { status: 400 });
    }
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    return NextResponse.json({ error: "manual submit failed" }, { status: 400 });
  }
}
