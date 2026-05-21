import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { PayloadTooLargeError, readJsonBody } from "@/lib/request";
import { appendUsageSamples, parseIngestPayload } from "@/lib/store";

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request, "usage-ingest", { limit: 30, windowMs: 60_000 });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate limited", retryAfter: rate.retryAfter }, { status: 429 });
  }

  const configuredToken = process.env.TOKENMAXING_INGEST_TOKEN;
  if (configuredToken) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${configuredToken}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const payload = await readJsonBody(request, 512 * 1024);
    const samples = await parseIngestPayload(payload);
    if (samples.length > 25) {
      return NextResponse.json({ error: "too many samples" }, { status: 413 });
    }
    await appendUsageSamples(samples);
    return NextResponse.json({
      accepted: samples.length,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "invalid payload", issues: error.issues }, { status: 400 });
    }
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
