# Deploy On Vercel

This is the simplest production path for the hobby version.

## 1. Create Postgres

Use Neon, Supabase, or Vercel Postgres. Copy the pooled connection string into `DATABASE_URL`.

The app creates the small schema automatically on first DB access. The same schema is also in `db/schema.sql` if you prefer running it manually.

## 2. Configure GitHub OAuth

Create a GitHub OAuth app with:

- Homepage URL: `https://tokenmaxing.xyz`
- Authorization callback URL: `https://tokenmaxing.xyz/api/auth/github/callback`

Save the client ID and secret for Vercel env vars.

## 3. Import The Repo

In Vercel:

- Import `https://github.com/MadanChaollaPark/tokenmaxing`
- Framework preset: Next.js
- Build command: `npm run build`
- Install command: `npm ci`

## 4. Set Env Vars

Required:

```bash
DATABASE_URL=...
TOKENMAXING_SESSION_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
NEXT_PUBLIC_REPO_URL=https://github.com/MadanChaollaPark/tokenmaxing
TOKENMAXING_ALLOW_LOCAL_LOGIN=false
TOKENMAXING_ALLOW_LOCAL_SUBMIT=false
```

Optional:

```bash
TOKENMAXING_INGEST_TOKEN=...
DATABASE_SSL=true
```

## 5. Point Domain

Add `tokenmaxing.xyz` in Vercel, then update DNS with the records Vercel gives you.

## 6. Verify

- `https://tokenmaxing.xyz/api/health` returns `{ "ok": true }`
- GitHub login completes
- Manual submit works
- OpenAI sync works with an Admin API key
- `/api/usage/submit-local` returns 403 in production
