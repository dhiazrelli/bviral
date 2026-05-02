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

The dashboard can run without a database because the UI currently uses mocked/demo data. The API server requires `DATABASE_URL`.

## Install

From the project root:

```powershell
pnpm install
```

## Run the Dashboard

```powershell
pnpm dev
```

This starts the BViral dashboard at:

```text
http://localhost:5173
```

The root `dev` script only starts the dashboard.

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

Avoid committing real credentials. Local `.env` files are ignored by git, but this project does not currently auto-load `.env` files, so set environment variables in the terminal before running commands.

## Push Database Schema

After setting `DATABASE_URL`, push the Drizzle schema:

```powershell
pnpm --filter @workspace/db run push
```

If Drizzle asks for confirmation, review the generated changes before accepting.

## Run Full Local Development

Use two terminals.

Terminal 1: API server

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
pnpm --filter @workspace/api-server run dev
```

Terminal 2: dashboard

```powershell
pnpm dev
```

## Build

```powershell
pnpm run build
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
```

## Notes

- Keep the current Fastify API unless the backend grows large enough to justify a framework migration.
- Supabase is used as hosted PostgreSQL; Fastify remains the backend server.
- The dashboard and API are separate apps inside the same workspace.
