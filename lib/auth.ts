import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import type { UserSession } from "@/lib/types";

export const sessionCookieName = "tokenmaxing_session";
export const oauthStateCookieName = "tokenmaxing_oauth_state";

const defaultTtlMs = 30 * 24 * 60 * 60 * 1000;

export function createSession(input: Omit<UserSession, "expiresAt">, ttlMs = defaultTtlMs): UserSession {
  return {
    ...input,
    expiresAt: new Date(Date.now() + ttlMs).toISOString()
  };
}

export function signSession(session: UserSession) {
  const payload = base64Url(JSON.stringify(session));
  const signature = hmac(payload);
  return `${payload}.${signature}`;
}

export function parseSessionToken(token: string | undefined): UserSession | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, hmac(payload))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UserSession;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest) {
  return parseSessionToken(request.cookies.get(sessionCookieName)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(defaultTtlMs / 1000)
  };
}

export function clearCookieOptions() {
  return {
    ...sessionCookieOptions(),
    maxAge: 0
  };
}

export function userIdFromDisplayName(displayName: string) {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return slug || crypto.randomUUID();
}

export function newOauthState() {
  return crypto.randomBytes(24).toString("base64url");
}

function hmac(payload: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function sessionSecret() {
  return process.env.TOKENMAXING_SESSION_SECRET || "tokenmaxing-dev-session-secret";
}

function base64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
