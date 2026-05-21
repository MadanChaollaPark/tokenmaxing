import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    userId: process.env.TOKENMAXING_USER_ID || "local",
    displayName: process.env.TOKENMAXING_DISPLAY_NAME || "Local Collector",
    team: process.env.TOKENMAXING_TEAM || "Unassigned"
  });
}
