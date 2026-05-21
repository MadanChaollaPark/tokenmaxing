import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createSession, sessionCookieName, sessionCookieOptions, signSession, userIdFromDisplayName } from "@/lib/auth";

const loginSchema = z.object({
  displayName: z.string().min(1).max(80),
  team: z.string().min(1).max(80).default("Unassigned"),
  role: z.string().min(1).max(80).default("Builder"),
  region: z.string().min(1).max(80).default("Remote")
});

export async function POST(request: NextRequest) {
  try {
    const body = loginSchema.parse(await request.json());
    const session = createSession({
      userId: userIdFromDisplayName(body.displayName),
      displayName: body.displayName,
      team: body.team,
      role: body.role,
      region: body.region,
      authProvider: "local"
    });
    const response = NextResponse.json({ authenticated: true, session });
    response.cookies.set(sessionCookieName, signSession(session), sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "invalid login", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "login failed" }, { status: 400 });
  }
}
