# TokenMaxing

Provider-agnostic AI token leaderboard inspired by internal token usage rankings.

Repository: <https://github.com/MadanChaollaPark/tokenmaxing>

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

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

- `GET /api/leaderboard?window=today|7d|30d|all&provider=all|codex|claude&team=all&query=`
- `POST /api/usage/ingest`
- `GET /api/users/me`

Local ingests are stored in `data/usage-samples.jsonl`. Repeated submissions replace the latest snapshot for that user/provider so refreshes do not double-count. The app also includes seeded demo rows so the leaderboard is usable before the first real collector sync.

## Production

See [docs/PRODUCTION.md](docs/PRODUCTION.md) for the production-readiness checklist.
