# TokenMaxing

Provider-agnostic AI token leaderboard inspired by internal token usage rankings.

Repository: <https://github.com/MadanChaollaPark/tokenmaxing>

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Storage

Local development works without setup and stores submissions in `data/*.jsonl`.

Production should set `DATABASE_URL`. When that is present, TokenMaxing uses Postgres and creates the small schema from [db/schema.sql](db/schema.sql) automatically.

## Ingest CodexBar Usage

Use **Submit usage** in the app header when running locally, or run the collector manually.
Both paths shell out to CodexBar and post aggregate usage only.

```bash
TOKENMAXING_USER_ID=madan \
TOKENMAXING_DISPLAY_NAME="Madan" \
TOKENMAXING_TEAM="Research" \
npm run collect:codexbar
```

Optional settings:

```bash
TOKENMAXING_ENDPOINT=http://127.0.0.1:3000/api/usage/ingest
TOKENMAXING_INGEST_TOKEN=shared-secret
CODEXBAR_BIN=/path/to/codexbar
```

If `TOKENMAXING_INGEST_TOKEN` is set on the server, the collector sends it as a bearer token.

## API

- `GET /api/leaderboard?window=today|7d|30d|all&provider=all|codex|openai|xai|claude|other&team=all&query=`
- `GET /api/health`
- `POST /api/usage/ingest`
- `POST /api/usage/manual`
- `POST /api/providers/openai/sync`
- `POST /api/providers/xai/sync`
- `GET /api/auth/session`
- `POST /api/auth/login`
- `POST /api/users/me/delete`
- `GET /api/users/me`

Repeated submissions replace the latest snapshot for that user/provider so refreshes do not double-count. The app also includes seeded demo rows so the leaderboard is usable before the first real collector sync.

## Sign In And Provider Sync

The app now has a **Connect** flow for users who do not have CodexBar.

- Local profile login works without external config.
- GitHub OAuth login is enabled when `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set.
- OpenAI sync uses the official organization usage and costs APIs with an Admin API key.
- xAI sync uses the xAI Management billing invoice API with a management key and team ID.
- Manual submit is available for providers that expose usage in dashboards but not yet in a supported API shape.

Provider keys are used for the sync request and are not written to `data/`.

Optional auth settings:

```bash
TOKENMAXING_SESSION_SECRET=long-random-string
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

## Production

Use Vercel for the hobby deploy. See [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md) and [docs/PRODUCTION.md](docs/PRODUCTION.md).
