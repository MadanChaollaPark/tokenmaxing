# Production Readiness

TokenMaxing is currently a local-first MVP. This checklist is what needs to change before running it as a public service.

## Data Model

- Replace `data/usage-samples.jsonl` with Postgres.
- Upsert usage by `(user_id, provider, source_snapshot_id)` or by `(user_id, provider)` for latest snapshots.
- Store daily rollups separately from raw submitted snapshots.
- Add migrations with Prisma, Drizzle, or plain SQL.

## Auth

- Add GitHub OAuth or magic links.
- Issue each user a collector token.
- Require bearer tokens for `/api/usage/ingest`.
- Scope users to organizations or teams.
- Add private/public profile controls.

## Ingestion

- Keep `/api/usage/submit-local` for local development only.
- For hosted production, users cannot run `codexbar` from the website. They need a local collector or desktop helper.
- Build a signed collector install command that posts to `/api/usage/ingest`.
- Validate payload size, dates, providers, and impossible jumps.
- Rate-limit submissions per user.

## Privacy

- Make the ingestion contract explicit: aggregate tokens, cost estimates, provider/model/day only.
- Never upload prompts, file paths, session logs, cookies, API keys, or local usernames without explicit opt-in.
- Add terms, privacy policy, and a data deletion/export flow.
- Add an audit view showing exactly what a collector will submit.

## Security

- Disable or protect local shell execution in deployed environments.
- Add CSRF protection for browser-authenticated mutation routes.
- Add rate limiting and abuse detection for public APIs.
- Set security headers.
- Keep CORS closed unless there is a specific collector need.
- Store secrets only in environment variables or a secrets manager.

## Product

- Separate raw token ranking from estimated spend ranking.
- Keep provider-specific boards because token units are not comparable across providers.
- Add org/team leaderboards, invite links, and opt-in profile visibility.
- Add badge definitions and anti-gaming notes in the UI.
- Add a "last submitted" state for each user.

## Operations

- Deploy on Vercel, Fly.io, or Render with managed Postgres.
- Add CI for `npm run build`, `npm run lint`, and `npm audit`.
- Add structured logs and request IDs.
- Add uptime checks for `/api/leaderboard`.
- Add backup/restore for the database.

## Domain

- Point `tokenmaxing.xyz` to the deployment.
- Set `NEXT_PUBLIC_REPO_URL=https://github.com/MadanChaollaPark/tokenmaxing`.
- Add social preview metadata and a favicon.
