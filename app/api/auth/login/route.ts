import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createSession, sessionCookieName, sessionCookieOptions, signSession, userIdFromDisplayName } from "@/lib/auth";
import { allowLocalLogin } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { PayloadTooLargeError, readJsonBody } from "@/lib/request";
import { upsertUserFromSession } from "@/lib/users";

const loginSchema = z.object({
  displayName: z.string().min(1).max(80),
  team: z.string().min(1).max(80).default("Unassigned"),
  role: z.string().min(1).max(80).default("Builder"),
  region: z.string().min(1).max(80).default("Remote")
});

export async function POST(request: NextRequest) {
  if (!allowLocalLogin()) {
    return NextResponse.json({ error: "local login is disabled" }, { status: 403 });
  }

  const rate = checkRateLimit(request, "auth-login", { limit: 20, windowMs: 60_000 });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate limited", retryAfter: rate.retryAfter }, { status: 429 });
  }

  try {
    const body = loginSchema.parse(await readJsonBody(request, 8 * 1024));
    const session = createSession({
      userId: userIdFromDisplayName(body.displayName),
      displayName: body.displayName,
      team: body.team,
      role: body.role,
      region: body.region,
      authProvider: "local"
    });
    await upsertUserFromSession(session);
    const response = NextResponse.json({ authenticated: true, session });
    response.cookies.set(sessionCookieName, signSession(session), sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "invalid login", issues: error.issues }, { status: 400 });
    }
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    return NextResponse.json({ error: "login failed" }, { status: 400 });
  }
}
