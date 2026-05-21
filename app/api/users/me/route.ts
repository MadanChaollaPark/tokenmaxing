import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (session) {
    return NextResponse.json({
      userId: session.userId,
      displayName: session.displayName,
      team: session.team,
      role: session.role,
      region: session.region,
      authProvider: session.authProvider
    });
  }

  return NextResponse.json({
    userId: process.env.TOKENMAXING_USER_ID || "local",
    displayName: process.env.TOKENMAXING_DISPLAY_NAME || "Local Collector",
    team: process.env.TOKENMAXING_TEAM || "Unassigned",
    role: process.env.TOKENMAXING_ROLE || "Builder",
    region: process.env.TOKENMAXING_REGION || "Local"
  });
}
