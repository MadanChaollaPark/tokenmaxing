import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionFromRequest } from "@/lib/auth";
import { connectionId, upsertProviderConnection } from "@/lib/provider-connections";
import { fetchXaiUsageSample } from "@/lib/providers/xai";
import { checkRateLimit } from "@/lib/rate-limit";
import { PayloadTooLargeError, readJsonBody } from "@/lib/request";
import { appendUsageSamples } from "@/lib/store";

const syncSchema = z.object({
  managementKey: z.string().min(12),
  teamId: z.string().min(1),
  days: z.number().int().min(1).max(180).default(30)
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const rate = checkRateLimit(request, `xai-sync:${session.userId}`, { limit: 8, windowMs: 60_000 });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate limited", retryAfter: rate.retryAfter }, { status: 429 });
  }

  try {
    const body = syncSchema.parse(await readJsonBody(request, 16 * 1024));
    const sample = await fetchXaiUsageSample({
      managementKey: body.managementKey,
      teamId: body.teamId,
      days: body.days,
      identity: session
    });
    await appendUsageSamples([sample]);
    await upsertProviderConnection({
      id: connectionId(session.userId, "xai", "api_key"),
      userId: session.userId,
      provider: "xai",
      authMethod: "api_key",
      label: "xAI Management API",
      status: "connected",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncAt: sample.updatedAt,
      meta: {
        source: sample.source,
        days: body.days,
        teamId: body.teamId
      }
    });

    return NextResponse.json({
      accepted: 1,
      provider: "xai",
      tokens: sample.totals.totalTokens,
      updatedAt: sample.updatedAt
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "invalid xAI sync request", issues: error.issues }, { status: 400 });
    }
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    const message = error instanceof Error ? error.message : "xAI sync failed";
    await upsertProviderConnection({
      id: connectionId(session.userId, "xai", "api_key"),
      userId: session.userId,
      provider: "xai",
      authMethod: "api_key",
      label: "xAI Management API",
      status: "error",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastError: message
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
