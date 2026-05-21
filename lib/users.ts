import { dbQuery, hasDatabase } from "@/lib/db";
import type { UserSession } from "@/lib/types";

export async function upsertUserFromSession(session: UserSession) {
  if (!hasDatabase()) return;

  await dbQuery(
    `INSERT INTO users (
       user_id, display_name, team, role, region, avatar_url, auth_provider, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       team = EXCLUDED.team,
       role = EXCLUDED.role,
       region = EXCLUDED.region,
       avatar_url = EXCLUDED.avatar_url,
       auth_provider = EXCLUDED.auth_provider,
       updated_at = NOW()`,
    [
      session.userId,
      session.displayName,
      session.team,
      session.role,
      session.region,
      session.avatarUrl ?? null,
      session.authProvider
    ]
  );
}

export async function deleteUserProfile(userId: string) {
  if (!hasDatabase()) return;
  await dbQuery("DELETE FROM users WHERE user_id = $1", [userId]);
}
