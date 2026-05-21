import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { allowLocalLogin, allowLocalSubmit } from "@/lib/config";
import { hasDatabase } from "@/lib/db";
import { listProviderConnections } from "@/lib/provider-connections";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({
      authenticated: false,
      githubOAuth: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      localLogin: allowLocalLogin(),
      localSubmit: allowLocalSubmit(),
      database: hasDatabase(),
      session: null,
      connections: []
    });
  }

  return NextResponse.json({
    authenticated: true,
    githubOAuth: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    localLogin: allowLocalLogin(),
    localSubmit: allowLocalSubmit(),
    database: hasDatabase(),
    session,
    connections: await listProviderConnections(session.userId)
  });
}
