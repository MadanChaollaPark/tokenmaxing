import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dbQuery, dbTransaction, hasDatabase } from "@/lib/db";
import type { ProviderConnection } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const connectionsFile = path.join(dataDir, "provider-connections.jsonl");

export async function listProviderConnections(userId: string): Promise<ProviderConnection[]> {
  if (hasDatabase()) {
    const result = await dbQuery<{
      auth_method: ProviderConnection["authMethod"];
      created_at: Date;
      id: string;
      label: string;
      last_error: string | null;
      last_sync_at: Date | null;
      meta: ProviderConnection["meta"];
      provider: ProviderConnection["provider"];
      status: ProviderConnection["status"];
      updated_at: Date;
      user_id: string;
    }>(
      `SELECT id, user_id, provider, auth_method, label, status, last_sync_at, last_error, meta, created_at, updated_at
       FROM provider_connections
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      authMethod: row.auth_method,
      label: row.label,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      lastSyncAt: row.last_sync_at?.toISOString(),
      lastError: row.last_error ?? undefined,
      meta: row.meta
    }));
  }

  return (await readConnections())
    .filter((connection) => connection.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function upsertProviderConnection(connection: ProviderConnection) {
  if (hasDatabase()) {
    await dbQuery(
      `INSERT INTO provider_connections (
         id, user_id, provider, auth_method, label, status, last_sync_at, last_error, meta, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         provider = EXCLUDED.provider,
         auth_method = EXCLUDED.auth_method,
         label = EXCLUDED.label,
         status = EXCLUDED.status,
         last_sync_at = EXCLUDED.last_sync_at,
         last_error = EXCLUDED.last_error,
         meta = EXCLUDED.meta,
         updated_at = EXCLUDED.updated_at`,
      [
        connection.id,
        connection.userId,
        connection.provider,
        connection.authMethod,
        connection.label,
        connection.status,
        connection.lastSyncAt ?? null,
        connection.lastError ?? null,
        JSON.stringify(connection.meta ?? {}),
        connection.createdAt,
        connection.updatedAt
      ]
    );
    return;
  }

  await mkdir(dataDir, { recursive: true });
  const existing = await readConnections();
  const index = existing.findIndex((item) => item.id === connection.id);
  if (index >= 0) {
    existing[index] = connection;
  } else {
    existing.push(connection);
  }
  const lines = existing.map((item) => JSON.stringify(item)).join("\n");
  await writeFile(connectionsFile, lines ? `${lines}\n` : "");
}

export async function deleteProviderConnectionsForUser(userId: string) {
  if (hasDatabase()) {
    await dbTransaction(async (client) => {
      await client.query("DELETE FROM provider_connections WHERE user_id = $1", [userId]);
    });
    return;
  }

  await mkdir(dataDir, { recursive: true });
  const remaining = (await readConnections()).filter((connection) => connection.userId !== userId);
  const lines = remaining.map((item) => JSON.stringify(item)).join("\n");
  await writeFile(connectionsFile, lines ? `${lines}\n` : "");
}

export function connectionId(userId: string, provider: string, authMethod: string) {
  return `${userId}:${provider}:${authMethod}`;
}

async function readConnections(): Promise<ProviderConnection[]> {
  try {
    const raw = await readFile(connectionsFile, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as ProviderConnection];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}
