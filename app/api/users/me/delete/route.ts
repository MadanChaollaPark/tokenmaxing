import { NextRequest, NextResponse } from "next/server";
import { clearCookieOptions, getSessionFromRequest, sessionCookieName } from "@/lib/auth";
import { deleteProviderConnectionsForUser } from "@/lib/provider-connections";
import { checkRateLimit } from "@/lib/rate-limit";
import { deleteUsageSamplesForUser } from "@/lib/store";
import { deleteUserProfile } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const rate = checkRateLimit(request, `delete-user:${session.userId}`, { limit: 3, windowMs: 60_000 });
  if (!rate.ok) {
    return NextResponse.json({ error: "rate limited", retryAfter: rate.retryAfter }, { status: 429 });
  }

  await deleteProviderConnectionsForUser(session.userId);
  await deleteUsageSamplesForUser(session.userId);
  await deleteUserProfile(session.userId);

  const response = NextResponse.json({ deleted: true });
  response.cookies.set(sessionCookieName, "", clearCookieOptions());
  return response;
}
