import { NextResponse } from "next/server";
import { clearCookieOptions, sessionCookieName } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(sessionCookieName, "", clearCookieOptions());
  return response;
}
