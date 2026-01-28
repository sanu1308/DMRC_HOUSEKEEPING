# GitHub Copilot Instructions for DMRC Housekeeping System

These instructions guide AI coding agents to work productively in this repo. Focus on the concrete patterns used here—architecture, workflows, conventions, and integration points.

## Big Picture
- **Two frontends**:
  - Modern **Next.js app** under [app](../app) with shared UI in [components](../components) and hooks in [hooks](../hooks).
  - Legacy **static HTML/JS** under [frontend](../frontend) (kept for reference/demo). Prefer the Next.js app for new work.
- **Backend**: Express + MySQL in [backend](../backend). Controllers in [backend/controllers](../backend/controllers), routes in [backend/routes](../backend/routes), auth in [backend/middleware/authMiddleware.js](../backend/middleware/authMiddleware.js), DB pool in [backend/config/db.js](../backend/config/db.js).
- **Auth & Roles**: JWT-based. Roles are `superadmin` and `user`. Route guards use `verifyToken`, `verifySuperAdmin`, `verifyUser`.
- **Data flow**: Next.js client calls `${env}/api/*` with `Authorization: Bearer <token>`. Responses are JSON; many endpoints return `{ data: [...] }` but some return arrays directly—code should handle both.

## Run/Build
- **Backend** (Express):
  - From [backend](../backend):
    - `npm install`
    - `cp .env.example .env` and set DB + `JWT_SECRET`
    - `npm run dev` (nodemon) or `npm start`
  - Health: GET `/api/health`
  - Seed demo users: `node backend/seedUsers.js` (Admin@123, User@123)
- **Next.js app** (root):
  - Scripts in [package.json](../package.json): `dev`, `build`, `start`, `lint`
  - Use `pnpm dev` or `npm run dev`
  - Set `NEXT_PUBLIC_API_URL` to backend origin (e.g., `http://localhost:5000`)
- **Static frontend** (optional legacy): serve [frontend](../frontend) via `npx http-server -p 8000`.

## Environment Conventions
- Next.js uses two env names in code:
  - `NEXT_PUBLIC_API_URL` in hooks like [hooks/use-chemicals.ts](../hooks/use-chemicals.ts)
  - `NEXT_PUBLIC_API_BASE_URL` in [app/login/page.tsx](../app/login/page.tsx)
- Prefer `NEXT_PUBLIC_API_URL`; if touching login, align it or read both.
- Token key in browser storage: `dmrc_token`.

## Backend Patterns
- Route layout (see [backend/routes/apiRoutes.js](../backend/routes/apiRoutes.js)):
  - Master data: `/stations`, `/chemicals`, `/machinery`, `/staff`, `/pest-control`, `/areas`
  - Usage tracking: `/chemical-usage`, `/machinery-usage`
  - Logs: `/housekeeping-logs` and `/housekeeping-logs/user/my-logs`
  - Shifts: `/shifts`
  - **Admin analytics** (superadmin only):
    - `/admin/dashboard` - real-time overview cards with auto-updating stats (staff, chemicals, inventory, pest activities)
    - `/admin/inventory` - chemical inventory status with stock calculations and low stock alerts
    - `/admin/chemical-usage` - filter by date/station/area/chemical + total usage calculations
    - `/admin/pest-control` - filter by pest type/area/date/method + recurring issue detection
    - `/admin/machinery-usage` - filter by machine type/date/station + performance analysis
  - **Admin reports** (superadmin only):
    - `/admin/reports/daily-cleaning` - housekeeping logs with filtering by date/station
    - `/admin/reports/chemical-consumption` - monthly consumption with trends and stock alerts
    - `/admin/reports/staff-utilization` - staff deployment analysis by station and shift
- Role rules:
  - Create/Update/Delete on master data → `superadmin` only
  - Usage tracking create/delete → `user`
  - Logs list all → `superadmin`; user can CRUD own logs
  - Admin analytics → `superadmin` only (see [backend/controllers/*Controller.js](../backend/controllers))
- DB access via pool ([backend/config/db.js](../backend/config/db.js)); controllers are async/await.
- CORS allows `*` in dev; set specific origin for production in [backend/server.js](../backend/server.js).

## Frontend (Next.js) Patterns
- **Hooks** for data fetching: [hooks/use-stations.ts](../hooks/use-stations.ts), [hooks/use-areas.ts](../hooks/use-areas.ts), [hooks/use-chemicals.ts](../hooks/use-chemicals.ts), [hooks/use-pests.ts](../hooks/use-pests.ts)
  - Read `dmrc_token` from `localStorage`, set `Authorization: Bearer <token>`.
  - Accept responses as `{ data: [...] }` or direct arrays.
  - Expose `{ items, loading, error, refresh }`-style APIs.
- **Pages** under [app/staff](../app/staff) use UI from [components/ui/*](../components/ui) and follow client-side fetch + optimistic UI.
  - Example: [app/staff/chemicals/page.tsx](../app/staff/chemicals/page.tsx) POSTs to `/chemical-usage`, DELETEs `/chemical-usage/:id`, and exports CSV.
- **Admin pages** under [app/admin](../app/admin) call `/admin/*` endpoints for analytics:
  - [app/admin/page.tsx](../app/admin/page.tsx) - main dashboard with 4 auto-updating cards (staff, chemicals, inventory, pest) and quick action buttons
  - [app/admin/inventory/page.tsx](../app/admin/inventory/page.tsx) - inventory status with color-coded stock levels (green=sufficient, red=low)
  - [app/admin/chemical-usage/page.tsx](../app/admin/chemical-usage/page.tsx) - advanced filtering + total usage summary
  - [app/admin/pest-control/page.tsx](../app/admin/pest-control/page.tsx) - recurring issue detection
  - [app/admin/machinery-usage/page.tsx](../app/admin/machinery-usage/page.tsx) - machine performance analysis
  - [app/admin/reports/page.tsx](../app/admin/reports/page.tsx) - comprehensive reports (daily cleaning, chemical consumption, staff utilization) with CSV export
- **UI library**: Radix UI + Tailwind (v4). Shared styling in [styles/globals.css](../styles/globals.css) and [app/globals.css](../app/globals.css).
- **Toasts**: [hooks/use-toast.ts](../hooks/use-toast.ts) and [components/ui/toaster.tsx](../components/ui/toaster.tsx).

## Adding Features (canonical steps)
1. Backend: add handler in [backend/controllers](../backend/controllers), expose route in [backend/routes/apiRoutes.js](../backend/routes/apiRoutes.js), protect with appropriate `verify*`.
2. Frontend: add a hook in [hooks/*](../hooks) mirroring existing fetch patterns (token, headers, `{ data }` fallback).
3. UI: create page/component under [app/staff/*](../app/staff) using existing table/form/dialog patterns from [components/ui](../components/ui).
4. Wire env: ensure `NEXT_PUBLIC_API_URL` points at the backend.

## Common Pitfalls
- Env mismatch: login page uses `NEXT_PUBLIC_API_BASE_URL`; hooks use `NEXT_PUBLIC_API_URL`.
- Inconsistent JSON shapes: handle both `{ data }` and raw arrays.
- Missing token: hooks set `error` and return empty lists; ensure login stores `dmrc_token`.
- Role violations: 403 responses if user tries admin-only routes.

## Useful References
- API overview: [README.md](../README.md) and [QUICK_START.md](../QUICK_START.md)
- Demo credentials in [backend/seedUsers.js](../backend/seedUsers.js)
- Auth middleware: [backend/middleware/authMiddleware.js](../backend/middleware/authMiddleware.js)

---
If any section is unclear or missing (e.g., preferred env variable naming, test strategy), tell us and we’ll refine this doc.
