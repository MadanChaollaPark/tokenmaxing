import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

const globalForPg = globalThis as typeof globalThis & {
  tokenmaxingPool?: Pool;
  tokenmaxingSchemaReady?: Promise<void>;
};

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  await ensureSchema();
  return getPool().query<T>(text, params);
}

export async function dbTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureSchema() {
  if (!hasDatabase()) return;
  globalForPg.tokenmaxingSchemaReady ||= getPool().query(schemaSql).then(() => undefined);
  await globalForPg.tokenmaxingSchemaReady;
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  globalForPg.tokenmaxingPool ||= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    ssl: shouldUseSsl() ? { rejectUnauthorized: false } : undefined
  });

  return globalForPg.tokenmaxingPool;
}

function shouldUseSsl() {
  if (process.env.DATABASE_SSL === "true") return true;
  if (process.env.DATABASE_SSL === "false") return false;
  return process.env.DATABASE_URL?.includes("sslmode=require") ?? false;
}

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  team TEXT NOT NULL DEFAULT 'Unassigned',
  role TEXT NOT NULL DEFAULT 'Builder',
  region TEXT NOT NULL DEFAULT 'Remote',
  avatar_url TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'local',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  auth_method TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS provider_connections_user_idx ON provider_connections (user_id);

CREATE TABLE IF NOT EXISTS usage_samples (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  source TEXT NOT NULL,
  display_name TEXT NOT NULL,
  handle TEXT,
  team TEXT NOT NULL DEFAULT 'Unassigned',
  role TEXT NOT NULL DEFAULT 'Builder',
  region TEXT NOT NULL DEFAULT 'Remote',
  totals JSONB NOT NULL,
  sample JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);

CREATE INDEX IF NOT EXISTS usage_samples_updated_idx ON usage_samples (updated_at DESC);

CREATE TABLE IF NOT EXISTS daily_usage (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  usage_date DATE NOT NULL,
  source TEXT NOT NULL,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  cache_read_tokens BIGINT NOT NULL DEFAULT 0,
  cache_creation_tokens BIGINT NOT NULL DEFAULT 0,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  total_cost NUMERIC(18, 8) NOT NULL DEFAULT 0,
  models JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, provider, usage_date)
);

CREATE INDEX IF NOT EXISTS daily_usage_provider_date_idx ON daily_usage (provider, usage_date DESC);
`;
