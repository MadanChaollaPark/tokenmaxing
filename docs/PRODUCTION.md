# Hobby Production Checklist

TokenMaxing is now set up for a small public hobby deploy.

## Required

- Set `DATABASE_URL` so usage and provider connections are stored in Postgres.
- Set `TOKENMAXING_SESSION_SECRET` to a long random value.
- Configure GitHub OAuth with callback `/api/auth/github/callback`.
- Keep `TOKENMAXING_ALLOW_LOCAL_LOGIN=false` in production.
- Keep `TOKENMAXING_ALLOW_LOCAL_SUBMIT=false` in production.
- Use the Connect modal for OpenAI, xAI, CodexBar collector, or manual usage.

## Already In The App

- Postgres storage with local JSONL fallback for development.
- Basic in-memory rate limits for login, ingest, manual submit, and provider sync.
- Request payload size limits.
- Production guard that disables browser-triggered local CodexBar shell execution.
- User data deletion endpoint and button.
- Privacy page describing stored data.
- `/api/health` for uptime checks.

## Still Later

- Replace in-memory rate limits with Upstash or another shared limiter if traffic grows.
- Add a proper email/support flow for data deletion requests.
- Add org/team invites.
- Add an admin moderation panel for obviously fake submissions.
