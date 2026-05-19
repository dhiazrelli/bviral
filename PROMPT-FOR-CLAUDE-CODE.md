# Claude Code task: BViral role-aware login + admin views

Paste the section between the `===` lines below into a fresh Claude Code session
opened at the repo root. The Magic MCP, the `ui-ux-pro-max` skill (in `.claude/skills/`),
and the `motion` package are already installed.

================================================================================

You are working in a pnpm monorepo (`BViral-Control-Center-master`). The repo has a
React/Vite dashboard, a Fastify API server, Drizzle ORM + Postgres (Supabase), and
generated API/Zod packages. The `ui-ux-pro-max` skill and the `21st-dev/magic` MCP
are installed — use both. `motion` (the framer-motion rebrand) is in
`artifacts/bviral-dashboard/package.json` but you still need to run `pnpm install`.

## Goal

Add role-aware authentication to BViral with two roles — `admin` and
`content_creator` — and a 3D-animated login page. Admins see everything across all
creators plus company-owned ("BViral company") accounts; creators see only their
own data. Filterable analytics for admins (by video / creator / platform).
**Invite-only**: no public sign-up.

## Constraints — read these before writing code

1. **No raw OAuth tokens in any UI, ever.** Admins see metadata only: platform,
   status, scopes, expiry, last-used. The `accounts.access_token` /
   `refresh_token` columns stay encrypted, server-side, never serialized to
   responses. If something needs re-linking, trigger a fresh OAuth flow.
2. Use RLS as the source of truth for row scoping. Add admin-bypass policies
   instead of routing admin traffic around RLS.
3. Keep the API spec in `lib/api-spec` as the contract. After schema/route
   changes, regenerate `lib/api-zod` and `lib/api-client-react`.
4. Type-safety end to end. No `any`.
5. Honor `prefers-reduced-motion` on the login page.

## Current repo facts you can rely on (verified)

- `lib/db/src/schema/users.ts` — `userRoleEnum` is `["admin", "member"]`. The app
  code uses `"admin" | "team"` for `AuthRole`. Both will be normalized to
  `"admin" | "content_creator"`.
- `lib/db/src/schema/scheduler.ts` — `accountsTable.userId` is `notNull`. Every
  row currently in this table belongs to the BViral company (user confirmed).
  All tables have row-owner RLS via `auth.uid()` and no admin bypass.
- `artifacts/api-server/src/plugins/50-auth.ts` — Supabase JWT verification,
  `authenticate` + `requireRole` decorators. `resolveRole` reads `app_metadata`.
- `artifacts/bviral-dashboard/src/App.tsx` — no `/login` route, no auth gate.
  Everything mounts inside `Shell`. Pages: Dashboard, Scheduling,
  AiVideoStudio, Analytics, Alerts, Accounts, Settings. Routing via wouter.
- `artifacts/api-server/src/routes/v1/analytics/index.ts` — overview and
  per-post analytics, both hard-scoped to `currentUser.id`. No filters.

## Plan — execute in order, commit per phase

### Phase 1 — Database

Edit `lib/db/src/schema/users.ts` and `lib/db/src/schema/scheduler.ts`:

- Rename `userRoleEnum` value `member` → `content_creator`.
- Add `accountOwnerKindEnum`: `["user", "bviral_company"]`. Default
  `bviral_company`.
- `accountsTable`: add `ownerKind` column with that enum, make `userId`
  nullable, add a CHECK constraint:
  `(owner_kind = 'user' AND user_id IS NOT NULL) OR (owner_kind = 'bviral_company' AND user_id IS NULL)`.
- Add admin-bypass RLS policies on `users`, `accounts`, `videos`, `posts`,
  `analytics`, `alerts`:
  `pgPolicy("admins_full_access", { for: "all", to: authenticatedRole, using: sql\`(auth.jwt() ->> 'app_role') = 'admin'\`, withCheck: sql\`(auth.jwt() ->> 'app_role') = 'admin'\` })`
- Generate one migration with `drizzle-kit` covering: enum rename, new enum,
  new column with default `bviral_company`, backfill (existing rows are
  already user-scoped — tag them `user` initially, then audit), nullable
  switch, CHECK constraint, RLS policies.
- Important: an enum value rename in Postgres is `ALTER TYPE … RENAME VALUE
  'member' TO 'content_creator'`. Do NOT drop and recreate the enum.

Verify: `pnpm --filter @workspace/db run typecheck` and the generated SQL.

### Phase 2 — Backend (Fastify)

`artifacts/api-server/src/plugins/50-auth.ts`:
- Change `AuthRole` to `"admin" | "content_creator"`.
- `resolveRole` returns `"content_creator"` instead of `"team"`.
- `attachDevelopmentUser` keeps role `admin`.

`artifacts/api-server/src/services/analytics.service.ts` (and its repository):
- Add `getOverviewFiltered({ videoId?, creatorId?, platform?, from?, to? })`
  for admin callers. The existing per-user `getOverview(userId)` stays for
  creators.
- Add Zod schema for the filter query.

`artifacts/api-server/src/routes/v1/analytics/index.ts`:
- Extend `GET /` to accept query filters. If `currentUser.role === 'admin'`
  honor them; if creator, ignore filters and scope to caller.

New admin routes under `artifacts/api-server/src/routes/v1/admin/`:
- `GET /admin/creators` — list of content creators with `{ id, email, fullName,
  connectedAccountsCount, lastActiveAt, unresolvedAlertsCount }`. Use
  `fastify.requireRole("admin")`.
- `GET /admin/creators/:id` — that creator's profile, list of accounts
  (metadata only — see Constraint #1), aggregated stats.
- `GET /admin/creators/:id/schedule` — that creator's scheduled posts.
- `GET /admin/bviral-accounts` + `POST /admin/bviral-accounts` — manage
  company-owned accounts (`ownerKind = 'bviral_company'`).

Update `lib/api-spec` with the new endpoints, then run codegen to refresh
`lib/api-zod` and `lib/api-client-react`.

### Phase 3 — Frontend auth + 3D login page

`artifacts/bviral-dashboard/package.json` — add deps:
- `@react-three/fiber`
- `@react-three/drei`
- `three` (peer)
- `@supabase/supabase-js` if not already present

Run `pnpm install` from the repo root.

New files:
- `src/lib/supabase.ts` — Supabase client (read URL + anon key from
  `import.meta.env`).
- `src/lib/auth-context.tsx` — React context exposing
  `{ user, role, loading, signIn, signOut }`. On mount, fetch
  `/api/v1/auth/me` with the Supabase session token.
- `src/components/auth/ProtectedRoute.tsx` — redirect to `/login` if no
  session; show a spinner while `loading`.
- `src/components/auth/AdminOnly.tsx` — render children only when role is
  admin, otherwise redirect.
- `src/pages/Login.tsx` — see "3D login" section below.

`src/App.tsx`:
- Add `/login` route outside `Shell`.
- Wrap rest of routes in `ProtectedRoute`. Wrap `AuthProvider` around
  `QueryClientProvider`.

`src/components/layout/Shell.tsx` — hide admin-only nav items unless role is
admin.

#### 3D login (`src/pages/Login.tsx`)

Use the `21st-dev/magic` MCP to find a hero/background component matching:
"orbiting circles 3D dark aurora glassmorphism login hero". If a clean match
exists, drop it in. If not, build it:

- **Scene** (`src/components/login/LoginBackground.tsx`, isolated so Magic can
  swap it later): R3F `<Canvas>` with:
  - Dark aurora gradient skybox (custom shader or drei `<Gradient>`).
  - Center `<group>` holding 5 platform icons (TikTok, Instagram, YouTube,
    Facebook, Snapchat — match `platformEnum`) as billboarded sprites,
    arranged on two tilted orbital rings rotating at different speeds.
  - Subtle particle field using `<Sparkles>` from drei.
  - Pointer parallax via `useFrame` with damping. Clamp tilt to ~5°.
  - `prefers-reduced-motion`: freeze orbits, keep static composition.
- **Form** (glassmorphic card centered over the canvas):
  - shadcn `Card` with `backdrop-blur` + soft border + brand-tinted shadow.
  - shadcn `Input` for email + password. shadcn `Button` for submit.
  - `motion` for entrance (stagger fields top-down) and submit (button squish
    + spinner). Focus rings tinted with brand color.
  - "Forgot password" link. **No sign-up link** (invite-only).
- After Supabase `signInWithPassword`, fetch `/api/v1/auth/me`, then
  `navigate("/admin")` if admin, `navigate("/")` if creator.

### Phase 4 — Admin views

`src/pages/admin/Creators.tsx` — DataTable with `id`, email, name, account
count, last active, alerts. Click → detail page.

`src/pages/admin/CreatorDetail.tsx` — that creator's accounts (platform +
status + expiry, no token strings), schedule, mini-analytics, alerts.

`src/pages/admin/BviralAccounts.tsx` — list company-owned accounts (kind
`bviral_company`), connect new ones via existing OAuth callback flow.

`src/pages/Analytics.tsx` — add filter bar visible only when `role === admin`:
Video select, Creator select, Platform select, Date range. Wires to the
extended `GET /v1/analytics?...` endpoint. Creators see the page unchanged.

`src/App.tsx` — wire admin routes under `AdminOnly`.

### Phase 5 — Wiring + verification

- `pnpm install`
- Regenerate API client: from `lib/api-spec` run the codegen script.
- `pnpm typecheck` at repo root — must pass clean.
- Build a seed script at `scripts/src/seed-roles.ts`: creates one admin user
  (`app_metadata.app_role = "admin"`), one content_creator, one
  bviral_company account, and a tiny set of fake posts/analytics so the
  filters in the admin Analytics page have data to render.
- Smoke test: `pnpm dev:dashboard`, log in as admin, verify all admin views
  render and analytics filters work. Log in as creator, verify they only see
  their data and the admin sidebar items are hidden.

## Magic MCP usage

For each visual component you want polished, prefer the Magic MCP over
hand-writing markup:

- `/ui new login hero with 3D orbiting platform icons, dark aurora background, glassmorphism form card`
- `/ui new admin data table with row hover and inline actions`
- `/ui new filter bar for analytics: video select, creator select, platform select, date range`

Always isolate Magic-generated components in their own file so swaps are
one-file.

## Order of commits (suggested)

1. `feat(db): rename role enum, add account owner kind, admin RLS bypass`
2. `feat(api): align AuthRole, add admin routes, filterable analytics`
3. `feat(api-spec): regenerate Zod and React client`
4. `feat(web): auth context, protected routes, role-aware shell`
5. `feat(web): 3D login page with R3F + motion`
6. `feat(web): admin creators / bviral-accounts / filterable analytics`
7. `chore: seed script + docs`

================================================================================
