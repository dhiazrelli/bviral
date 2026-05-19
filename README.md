# BViral Control Center

A pnpm workspace for the BViral social-media scheduling platform: a React/Vite dashboard, a Fastify API with BullMQ workers, a Postgres/Drizzle data layer, and a vendored Next.js video editor.

## Quick start

```powershell
# 1. install
pnpm install

# 2. configure
copy .env.example .env   # then edit DATABASE_URL, SUPABASE_*, REDIS_URL, ADMIN_TOKEN

# 3. push schema
pnpm --filter @workspace/db run push

# 4. run dashboard
pnpm run dev
```

Dashboard: <http://localhost:5173> · API: <http://localhost:3001> · Editor: <http://localhost:3000/projects>

For full local development (API + worker + editor) see [Run everything](#run-everything).

## Requirements

- Node.js 20+
- pnpm 10 (pinned via `packageManager`)
- PostgreSQL (Supabase Session Pooler recommended)
- Redis (only required when running the publishing worker)

## Project structure

```text
artifacts/
  api-server/          Fastify API + BullMQ workers
  bviral-dashboard/    React/Vite dashboard (main app)
  mockup-sandbox/      Standalone UI sandbox
  openvideo/           Vendored Next.js video editor (BVIRAL Video Editor)

lib/
  api-client-react/    Generated TanStack Query client
  api-spec/            OpenAPI spec + codegen config
  api-zod/             Generated Zod schemas
  db/                  Drizzle schema + Postgres helpers

scripts/               Workspace utility scripts
```

The vendored editor in `artifacts/openvideo` is excluded from the workspace and managed with `pnpm -C artifacts/openvideo --ignore-workspace ...`.

## Environment variables

The API server auto-loads the first `.env` it finds in the current directory, `artifacts/api-server/`, or the workspace root.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. Use Supabase Session Pooler locally. |
| `SUPABASE_URL` | yes | Supabase project URL. |
| `SUPABASE_PUBLISHABLE_KEY` | yes | Anon/publishable key. |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | Needed for admin operations. |
| `REDIS_URL` | optional | Defaults to `redis://127.0.0.1:6379`. Required for the publishing worker. |
| `ADMIN_TOKEN` | optional (dev) | Lets the API attach a local admin user when the dashboard has no Supabase session. |
| `DASHBOARD_URL` | optional | OAuth callbacks redirect here. Defaults to `http://localhost:5173`. |
| `CORS_ORIGINS` | required in prod | Comma-separated allow list. |
| `YOUTUBE_*`, `TIKTOK_*`, `META_*` | optional | Per-provider OAuth. Missing creds return `503` rather than crashing. |
| `LTX_API_KEY` (a.k.a. `LTXV_API_KEY`) | optional | Enables AI video generation in the studio. |
| `VITE_BVIRAL_VIDEO_EDITOR_URL` | optional | Points AI Studio at the editor host. Defaults to `http://localhost:3000/projects`. |
| `VITE_API_PROXY_TARGET` | optional | Used by the Vite dev proxy when tunneling through HTTPS. |

A real Supabase bearer token is required in production. The `ADMIN_TOKEN` shortcut is dev-only.

## Run the dashboard

```powershell
pnpm run dev:dashboard          # or: pnpm run dev
```

Opens on <http://localhost:5173>. The dashboard talks to the API via the Vite dev proxy at `/api`.

## Run the API server

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
pnpm --filter @workspace/api-server run dev
```

- Listens on <http://localhost:3001>
- Health check: <http://localhost:3001/healthz>

## Run the publishing worker

The worker consumes the BullMQ queue and posts scheduled content. On boot it requeues any DB rows still marked `scheduled`, including ones that became overdue while the worker was off.

```powershell
pnpm run dev:worker:posts
```

Other workers (`worker:videos`, `worker:analytics`, `worker:ai`) follow the same pattern under `@workspace/api-server`.

## Run the BVIRAL Video Editor

A Next.js app at `artifacts/openvideo`, embedded in AI Studio. It is intentionally outside the pnpm workspace so its heavy timeline/canvas/export bundle stays isolated.

```powershell
pnpm -C artifacts/openvideo --ignore-workspace install   # first time only
pnpm run dev:video-editor
```

Opens on <http://localhost:3000/projects>. AI Studio embeds it at <http://localhost:5173/ai-video-studio>.

Notes:

- Projects and media are stored in the browser (localStorage/IndexedDB/OPFS). Keep source files until export completes.
- Optional AI features (transcription, voiceover, stock search) need keys from `artifacts/openvideo/.env.sample`. Timeline editing and export work without them.
- The editor is dual-licensed by its upstream project — see `artifacts/openvideo/LICENSE-AGPL3.md` before shipping commercially.

## Database

```powershell
pnpm --filter @workspace/db run generate   # generate migration
pnpm --filter @workspace/db run push       # push schema to DB
pnpm --filter @workspace/db run migrate    # apply migration
```

For Supabase, prefer the **Session Pooler** URL (Project → Connect → Session pooler) to avoid IPv6 issues on local IPv4 networks:

```text
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

The API rejects the direct `db.*.supabase.co:5432` host with a clear error.

## OAuth setup

The Accounts page connects YouTube, TikTok, and Meta (Facebook + Instagram). Configure only the providers you need — others return `503` until their env vars exist.

Local redirect URIs:

```text
YouTube: http://localhost:3001/api/v1/accounts/youtube/callback
TikTok:  http://localhost:3001/api/v1/accounts/tiktok/callback
Meta:    http://localhost:3001/api/v1/accounts/meta/callback
```

### TikTok (PKCE + tunnel)

TikTok rejects `localhost` redirect URIs and uses PKCE. The verifier lives in API memory per attempt — restart the API and retry if a callback complains it's missing or expired. For local dev, tunnel the dashboard and proxy the API through it:

```powershell
ngrok http 5173
```

```text
DASHBOARD_URL=https://YOUR-TUNNEL.ngrok-free.app
TIKTOK_REDIRECT_URI=https://YOUR-TUNNEL.ngrok-free.app/api/v1/accounts/tiktok/callback
VITE_API_PROXY_TARGET=http://localhost:3001
```

Register the same `TIKTOK_REDIRECT_URI` in TikTok's Login Kit.

### Meta / Instagram

```text
META_APP_ID=...
META_APP_SECRET=...
META_REDIRECT_URI=http://localhost:3001/api/v1/accounts/meta/callback
META_OAUTH_SCOPES=pages_show_list,pages_read_engagement
```

Start with the minimal scope set above. For Facebook or Instagram publishing, expand only after the Meta app passes review:

```text
META_OAUTH_SCOPES=pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish
```

The Instagram account must be a **professional** account linked to a Facebook Page accessible to the logged-in user.

## Run everything

Four terminals. Redis must be reachable at `REDIS_URL`.

```powershell
# 1. API
$env:DATABASE_URL = "postgresql://..."; pnpm --filter @workspace/api-server run dev

# 2. dashboard
pnpm run dev:dashboard

# 3. publishing worker
pnpm run dev:worker:posts

# 4. video editor
pnpm run dev:video-editor
```

## Build & typecheck

```powershell
pnpm run typecheck            # workspace typecheck (libs + artifacts + scripts)
pnpm run build                # typecheck + build every package
pnpm run build:video-editor   # build the vendored editor separately
```

## Useful filtered commands

```powershell
pnpm --filter @workspace/bviral-dashboard run dev
pnpm --filter @workspace/bviral-dashboard run build
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run worker:posts
pnpm --filter @workspace/db run push
pnpm -C artifacts/openvideo --ignore-workspace run dev
```

## Notes

- The dashboard and API are independent apps that share the same workspace. The dashboard can boot without a database — much of the UI runs on demo data — but scheduling, accounts, and publishing need the API.
- Keep Fastify as the API server; Supabase provides hosted Postgres only.
- Never commit `.env`. Real credentials stay local.
