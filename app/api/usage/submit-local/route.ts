import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { loadCodexBarSamples } from "@/lib/codexbar";
import { connectionId, upsertProviderConnection } from "@/lib/provider-connections";
import { appendUsageSamples } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    const samples = await loadCodexBarSamples(session);
    if (!samples.length) {
      return NextResponse.json(
        { error: "CodexBar returned no usable usage samples." },
        { status: 422 }
      );
    }
    await appendUsageSamples(samples);
    if (session) {
      await Promise.all(
        Array.from(new Set(samples.map((sample) => sample.provider))).map((provider) =>
          upsertProviderConnection({
            id: connectionId(session.userId, provider, "codexbar"),
            userId: session.userId,
            provider,
            authMethod: "codexbar",
            label: "CodexBar",
            status: "connected",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastSyncAt: new Date().toISOString()
          })
        )
      );
    }
    return NextResponse.json({
      accepted: samples.length,
      providers: samples.map((sample) => sample.provider),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit local usage.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
