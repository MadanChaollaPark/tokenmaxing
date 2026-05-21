import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { appendUsageSamples, parseIngestPayload } from "@/lib/store";

export async function POST(request: NextRequest) {
  const configuredToken = process.env.TOKENMAXING_INGEST_TOKEN;
  if (configuredToken) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${configuredToken}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const payload = await request.json();
    const samples = await parseIngestPayload(payload);
    await appendUsageSamples(samples);
    return NextResponse.json({
      accepted: samples.length,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "invalid payload", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
