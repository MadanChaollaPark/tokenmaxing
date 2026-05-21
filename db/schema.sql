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
