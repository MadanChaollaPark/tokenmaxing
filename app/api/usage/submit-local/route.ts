import { NextResponse } from "next/server";
import { loadCodexBarSamples } from "@/lib/codexbar";
import { appendUsageSamples } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const samples = await loadCodexBarSamples();
    if (!samples.length) {
      return NextResponse.json(
        { error: "CodexBar returned no usable usage samples." },
        { status: 422 }
      );
    }
    await appendUsageSamples(samples);
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
