import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    database: hasDatabase() ? "configured" : "local"
  });
}
