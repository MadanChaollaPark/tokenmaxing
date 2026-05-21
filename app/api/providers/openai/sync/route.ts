import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionFromRequest } from "@/lib/auth";
import { connectionId, upsertProviderConnection } from "@/lib/provider-connections";
import { fetchOpenAiUsageSample } from "@/lib/providers/openai";
import { checkRateLimit } from "@/lib/rate-limit";
import { PayloadTooLargeError, readJsonBody } from "@/lib/request";
import { appendUsageSamples } from "@/lib/store";

const syncSchema = z.object({
  apiKey: z.string().min(12),
  days: z.number().int().min(1).max(180).default(30)
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const rate = checkRateLimit(request, `openai-sync:${session.userId}`, { limit: 8, windowMs: 60_000 });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate limited", retryAfter: rate.retryAfter }, { status: 429 });
  }

  try {
    const body = syncSchema.parse(await readJsonBody(request, 16 * 1024));
    const sample = await fetchOpenAiUsageSample({
      apiKey: body.apiKey,
      days: body.days,
      identity: session
    });
    await appendUsageSamples([sample]);
    await upsertProviderConnection({
      id: connectionId(session.userId, "openai", "api_key"),
      userId: session.userId,
      provider: "openai",
      authMethod: "api_key",
      label: "OpenAI Admin API",
      status: "connected",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncAt: sample.updatedAt,
      meta: {
        source: sample.source,
        days: body.days
      }
    });

    return NextResponse.json({
      accepted: 1,
      provider: "openai",
      tokens: sample.totals.totalTokens,
      updatedAt: sample.updatedAt
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "invalid OpenAI sync request", issues: error.issues }, { status: 400 });
    }
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    const message = error instanceof Error ? error.message : "OpenAI sync failed";
    await upsertProviderConnection({
      id: connectionId(session.userId, "openai", "api_key"),
      userId: session.userId,
      provider: "openai",
      authMethod: "api_key",
      label: "OpenAI Admin API",
      status: "error",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastError: message
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
