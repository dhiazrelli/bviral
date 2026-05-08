# BViral Control Center

BViral Control Center is a pnpm workspace for a BViral social media scheduling dashboard. The project includes a React/Vite dashboard, a Fastify API server, shared API/client packages, and a Drizzle/PostgreSQL database layer.

## Stack

- **Workspace:** pnpm workspaces
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui-style components
- **Backend:** Fastify
- **Database:** PostgreSQL with Drizzle ORM
- **Hosted database option:** Supabase Postgres
- **Language:** TypeScript

## Project Structure

```text
artifacts/
  api-server/          Fastify API server
  bviral-dashboard/    Main React/Vite dashboard
  mockup-sandbox/      UI/mockup sandbox
  openvideo/           Vendored BVIRAL Video Editor, based on the OpenVideo React editor

lib/
  api-client-react/    Generated API client
  api-spec/            OpenAPI spec and codegen config
  api-zod/             Generated Zod schemas
  db/                  Drizzle schema and database helpers

scripts/               Utility scripts
```

## Requirements

- Node.js 24
- pnpm
- PostgreSQL database URL for the API server
- The vendored video editor uses its own Next.js app in `artifacts/openvideo`

The dashboard can run without a database because the UI currently uses mocked/demo data. The API server requires `DATABASE_URL`.

## Install

From the project root:

```powershell
pnpm install
```

## Run the Dashboard

```powershell
pnpm run dev:dashboard
```

This starts the BViral dashboard at:

```text
http://localhost:5173
```

The root `dev` script only starts the dashboard.

## Run the BVIRAL Video Editor

The AI Studio includes a local browser video editor, vendored in `artifacts/openvideo` and branded as **BVIRAL Video Editor**. It is implemented as a separate Next.js app so the heavier video timeline, canvas rendering, media storage, and export pipeline stay isolated from the main dashboard bundle.

Install the editor dependencies from the project root if needed:

```powershell
pnpm -C artifacts/openvideo install --ignore-workspace
```

Start the editor:

```powershell
pnpm run dev:video-editor
```

This starts the editor at:

```text
http://localhost:3000/projects
```

AI Studio embeds this local editor from:

```text
http://localhost:5173/ai-video-studio
```

The dashboard integration defaults to `http://localhost:3000/projects`. To point AI Studio at another editor host, set:

```powershell
$env:VITE_BVIRAL_VIDEO_EDITOR_URL="http://localhost:3000/projects"
```

Notes:

- The visible editor UI is branded as BVIRAL Video Editor with the BVIRAL logo.
- The editor is isolated from the dashboard bundle, so it does not slow the normal dashboard route unless the editor tab/iframe is opened.
- The editor is dual-licensed by its upstream project. Review `artifacts/openvideo/LICENSE` before production or commercial distribution.
- AI features such as transcription, voiceover, stock search, or chat assistance require the matching keys in `artifacts/openvideo/.env.sample`; timeline editing, browser media import, local project storage, and export are the primary baseline workflow.
- The editor stores projects and media in the browser using local storage/IndexedDB/OPFS-style browser storage, so users should keep source files available until export is complete.

## Run the API Server

Set `DATABASE_URL`, then start the Fastify API:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
pnpm --filter @workspace/api-server run dev
```

The API defaults to:

```text
http://localhost:3001
```

Health check:

```text
http://localhost:3001/healthz
```

## Supabase Setup

For Supabase, use the **Session Pooler** connection string when running locally, especially if the direct database URL has IPv6 connectivity issues.

In Supabase:

```text
Project Dashboard -> Connect -> Connection string -> Session pooler
```

Use that value as `DATABASE_URL`:

```powershell
$env:DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

Avoid committing real credentials. Local `.env` files are ignored by git. The API server auto-loads the first `.env` file it finds in the current directory, `artifacts/api-server`, or the workspace root.

## Account OAuth Setup

The Accounts page can connect YouTube, TikTok, and Meta/Facebook accounts. In local development, the API uses the configured `ADMIN_TOKEN` to attach a local BVIRAL admin user when the dashboard does not have a Supabase login session yet. Production still requires a real Supabase bearer token.

Provider credentials are optional at boot. If a provider is missing credentials, its connect route returns `503` with the missing environment variables instead of crashing the API.

OAuth callbacks redirect back to the dashboard after a successful provider connection. For local development, set:

```text
DASHBOARD_URL=http://localhost:5173
```

Required redirect URIs for local provider dashboards:

```text
YouTube: http://localhost:3001/api/v1/accounts/youtube/callback
TikTok:  http://localhost:3001/api/v1/accounts/tiktok/callback
Meta:    http://localhost:3001/api/v1/accounts/meta/callback
```

For Instagram access, configure Meta/Facebook credentials in `.env`:

```text
META_APP_ID=...
META_APP_SECRET=...
META_REDIRECT_URI=http://localhost:3001/api/v1/accounts/meta/callback
```

The Meta flow uses Facebook Login to request Instagram/Page permissions. The connected Instagram account must be a professional Instagram account linked to a Facebook Page that the logged-in user can access.

## Push Database Schema

After setting `DATABASE_URL`, push the Drizzle schema:

```powershell
pnpm --filter @workspace/db run push
```

If Drizzle asks for confirmation, review the generated changes before accepting.

## Run Full Local Development

Use three terminals when running the API, dashboard, and editor together.

Terminal 1: API server

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
pnpm --filter @workspace/api-server run dev
```

Terminal 2: dashboard

```powershell
pnpm run dev:dashboard
```

Terminal 3: BVIRAL Video Editor

```powershell
pnpm run dev:video-editor
```

## Build

```powershell
pnpm run build
```

Build the vendored video editor separately:

```powershell
pnpm run build:video-editor
```

## Typecheck

```powershell
pnpm run typecheck
```

## Useful Package Commands

```powershell
pnpm --filter @workspace/bviral-dashboard run dev
pnpm --filter @workspace/bviral-dashboard run build
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/db run push
pnpm run dev:video-editor
pnpm run build:video-editor
```

## Notes

- Keep the current Fastify API unless the backend grows large enough to justify a framework migration.
- Supabase is used as hosted PostgreSQL; Fastify remains the backend server.
- The dashboard and API are separate apps inside the same workspace.
- The vendored video editor is excluded from the parent pnpm workspace and is managed through `pnpm -C artifacts/openvideo --ignore-workspace ...`.
