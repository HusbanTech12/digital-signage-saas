# Build Prompts — Digital Signage SaaS

Feed these to Claude Code / OpenCode one at a time, in order. Sequence is **Frontend first, Backend second** — the frontend is built against typed mock data, then the backend is built to match that exact contract, then wired together in the final backend prompt.

Add `AGENTS.md` to the project root before Prompt 1.

---

## Prompt 0: Bare Initialization (run before AGENTS.md is added)

Initialize the project root as `digital-signage-saas` with two top-level folders: `frontend` (Next.js, App Router, TypeScript, Tailwind) and `backend` (FastAPI, Python, with a basic `/health` endpoint) — a simple two-folder layout, no monorepo tooling needed. Install and wire up the core dependencies both apps will need later — don't configure them yet, just confirm they install cleanly and import without error:
- Dashboard: `drizzle-orm`, `@clerk/nextjs`, Fabric.js or Konva.js, shadcn/ui, Lucide React
- API: dependencies for Supabase Postgres access, `celery`, `redis`, `python-dotenv`, WebSocket support (FastAPI's built-in `websockets`)

Add a root-level `.gitignore` and a minimal `README.md` at `digital-signage-saas/`. No database connection, auth, or business logic yet — just confirm both apps run locally (`npm run dev` in `frontend`, `uvicorn` in `backend`), `/health` returns 200, and all installed packages import cleanly. Stop after both apps boot successfully.

Add `AGENTS.md` to the project root only after this prompt completes.

---

## FRONTEND

### Prompt 1: Frontend Foundation

Read AGENTS.md fully before starting. Initialize `frontend` — Next.js (App Router, TypeScript strict, Tailwind). Build the layout shell: navbar, sidebar (role-aware), auth pages (Clerk sign-in/sign-up UI only, client-side). Define a `lib/mock-data.ts` module with typed mock objects matching the Section 5 schema (organizations, locations, screens, menus, menu_items, templates, themes) — this is the data contract the real backend must match later. No FastAPI, no live DB yet.

### Prompt 2: Dashboard UI — Org / Location / Screen Management

Build the organization, location, and screen management screens per Section 6, using the mock data layer from Prompt 1. Include the screen pairing UI (Section 8) — a `/pair` display screen and a dashboard "enter code" action — wired to mock functions for now. Enforce role-based visibility in the UI (Super Admin / Admin / Location Manager per Section 4) using mock session data.

### Prompt 3: Menu Designer UI

Build the drag-and-drop menu designer (Fabric.js or Konva.js) per Section 2/6: menu and menu_items CRUD screens, template gallery, and a "publish" button — all against mock data. Keep the designer's save/load functions isolated in one module so they're easy to swap for real API calls later.

### Prompt 4: Display Client UI (Kiosk)

Build the `/display/[screenId]` route per Section 8, rendering a menu/template from mock/local data. Implement the offline-fallback UI (cached-state placeholder) and the pairing-code screen. Keep the bundle light — no heavy animation libraries. This route still runs on mock data; live sync comes in the backend phase.

---

## BACKEND

### Prompt 5: Backend Foundation

Initialize `backend` (FastAPI). Set up Drizzle ORM against Supabase Postgres with the full Section 5 schema. Configure Clerk server-side auth verification and org-scoped access enforcement at the query layer, matching the roles used in the frontend. Add `.env.example` and `docker-compose.yml` for local Postgres/Redis. Add a `/health` endpoint.

### Prompt 6: Core APIs — Org / Location / Screen

Build REST endpoints for organization, location, and screen CRUD, plus the pairing endpoint, matching the exact shapes used in `lib/mock-data.ts` from Prompt 1. Replace the dashboard's mock calls from Prompt 2 with real API calls.

### Prompt 7: Menu APIs

Build menu and menu_items CRUD endpoints, template endpoints, and the publish endpoint. Replace the menu designer's mock save/load (Prompt 3) with real API calls.

### Prompt 8: Real-Time Sync

Add WebSocket sync per Section 3/7: publish action pushes an update through the event envelope (`{ type, screenId, payload, ts }`) via Redis pub-sub. Wire the display client (Prompt 4) to subscribe per-screen and re-render on push, with auto-reconnect (exponential backoff) and polling fallback. Target: under 3 seconds save-to-screen per Section 13.

### Prompt 9: Theme Scheduling

Implement Celery + Celery Beat per Section 2/6: time-of-day and seasonal theme-switch rules, and a heartbeat task marking screens offline on missed check-ins. Surface live online/offline status on the dashboard (replacing any mock status).

### Prompt 10: POS Integration (First Provider)

Implement the adapter pattern from Section 7 for one POS provider (confirm which). Normalize events into `PriceUpdateEvent` / `AvailabilityUpdateEvent`, queue through Redis, write to `menu_items`, and log to `pos_sync_events`. Add a sync-status indicator to the dashboard.

### Prompt 11: Deployment

Set up deploy configs per Section 12: Railway for dev/staging (web service + Celery worker + Redis), and Render Starter (or Railway Pro) for production. Document the switch-over in the README. Do not target Hugging Face Spaces.

---

## POST-MVP

### Prompt 12: AI Menu Generation & Mobile PWA

Only start once Prompts 1–11 are stable. Add AI-assisted menu layout generation (Section 6, item 2) and convert the dashboard into a PWA for on-the-go price/promo edits, per the Phase 5 note in AGENTS.md — before considering a native React Native app.
