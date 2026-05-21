import { LeaderboardApp } from "@/components/leaderboard-app";
import { getLeaderboard } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialData = await getLeaderboard({
    provider: "all",
    query: "",
    team: "all",
    window: "30d"
  });

  return <LeaderboardApp initialData={initialData} />;
}
