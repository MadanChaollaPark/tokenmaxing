import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/store";
import type { LeaderboardFilters } from "@/lib/types";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const filters: LeaderboardFilters = {
    window: (search.get("window") || "30d") as LeaderboardFilters["window"],
    provider: (search.get("provider") || "all") as LeaderboardFilters["provider"],
    team: search.get("team") || "all",
    query: search.get("query") || ""
  };

  return NextResponse.json(await getLeaderboard(filters));
}
