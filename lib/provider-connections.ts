import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProviderConnection } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const connectionsFile = path.join(dataDir, "provider-connections.jsonl");

export async function listProviderConnections(userId: string): Promise<ProviderConnection[]> {
  return (await readConnections())
    .filter((connection) => connection.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function upsertProviderConnection(connection: ProviderConnection) {
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
