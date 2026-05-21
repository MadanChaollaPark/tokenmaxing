import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { listProviderConnections } from "@/lib/provider-connections";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ connections: [] });
  }
  return NextResponse.json({ connections: await listProviderConnections(session.userId) });
}
