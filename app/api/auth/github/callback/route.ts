import { NextRequest, NextResponse } from "next/server";
import { createSession, oauthStateCookieName, sessionCookieName, sessionCookieOptions, signSession } from "@/lib/auth";

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(oauthStateCookieName)?.value;
  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/?auth_error=github_state", request.url));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?auth_error=github_not_configured", request.url));
  }

  const redirectUri = new URL("/api/auth/github/callback", request.url).toString();
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    }),
    cache: "no-store"
  });
  const token = (await tokenResponse.json()) as GitHubTokenResponse;
  if (!token.access_token) {
    return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(token.error || "github_token")}`, request.url));
  }

  const profileResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      Accept: "application/vnd.github+json"
    },
    cache: "no-store"
  });
  if (!profileResponse.ok) {
    return NextResponse.redirect(new URL("/?auth_error=github_profile", request.url));
  }
  const profile = (await profileResponse.json()) as GitHubUser;
  const session = createSession({
    userId: `github:${profile.id}`,
    displayName: profile.name || profile.login,
    team: "Unassigned",
    role: "Builder",
    region: "Remote",
    avatarUrl: profile.avatar_url,
    authProvider: "github"
  });

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(sessionCookieName, signSession(session), sessionCookieOptions());
  response.cookies.set(oauthStateCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
