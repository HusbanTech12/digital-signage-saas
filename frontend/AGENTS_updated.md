# AGENTS.md — digital-signage-saas

## 1. Project Overview

A multi-tenant SaaS platform that turns any TV into a smart, remotely-managed digital menu board / signage display for restaurants, cafes, and retail businesses. Admins manage menus, prices, promotions, and screen content from a web dashboard; screens run a lightweight browser-based display client (no native TV app required).

**Core value proposition:** POS-connected, real-time menu updates, drag-and-drop menu designer, multi-location/multi-screen management, theme scheduling (time-of-day and seasonal), at a fraction of typical signage vendor cost.

**Reference/inspiration:** Nento (nento.com) — feature parity target, not a clone. Positioning should differentiate on pricing simplicity and web-native architecture.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend (dashboard + designer) | Next.js (App Router) | Admin panel, menu designer, auth flows |
| Display client (screen player) | Next.js route, rendered in Chromium kiosk mode | No native Android/Tizen/webOS/Roku app in v1 |
| Backend API | FastAPI | Business logic, POS webhooks, screen management |
| Database | Supabase (PostgreSQL) | Multi-tenant relational data; can also leverage Supabase Auth/Storage/Realtime if useful later |
| ORM | SQLAlchemy (async, via asyncpg) | Python ORM, works with FastAPI; Schema, migrations (Alembic), type-safe queries |
| Auth | Clerk | Org/multi-tenant roles: Super Admin, Admin, Location Manager |
| Real-time sync | WebSockets (Socket.io or native WS) or managed (Pusher/Ably) | Dashboard change → screen update push |
| Background jobs / scheduling | Celery (+ Celery Beat) + Redis | Theme scheduling (breakfast/lunch/dinner, seasonal themes), heartbeat checks, async POS webhook processing, AI menu generation jobs |
| Cache / pub-sub | Redis | Screen online/offline status, real-time channel fan-out |
| Canvas / menu designer | Fabric.js or Konva.js | Drag-and-drop template editor |
| Email | Resend | Onboarding, alerts (screen offline, billing) |
| Media storage | S3-compatible + CDN | Menu images, video assets, template thumbnails |
| AI menu generation | Anthropic/Claude API (or image-gen provider) | Auto-generate menu designs from text/photos |
| Mobile app (phase 2) | React Native or Flutter | Quick price/promo edits on the go |

---

## 3. Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌────────────────────┐
│  Admin Dashboard │◄────►│   FastAPI Backend │◄────►│  Supabase Postgres  │
│  (Next.js)       │      │  (REST + Webhooks)│      │  (SQLAlchemy schema)│
└─────────────────┘      └─────────┬─────────┘      └────────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │  Redis (pub/sub,   │
                          │  jobs, heartbeat)  │
                          └─────────┬─────────┘
                                    │ WebSocket push
                          ┌─────────▼─────────┐
                          │  Display Client     │
                          │  (Next.js page in   │
                          │  Chromium kiosk on   │
                          │  Pi / mini-PC /      │
                          │  Fire Stick browser) │
                          └────────────────────┘
```

**Display client principle:** the screen is just a browser tab pointed at a `/display/[screenId]` route. It authenticates with a long-lived screen token, subscribes to a WebSocket channel scoped to that screen, and re-renders on push. It must also poll on a fallback interval and cache the last-known menu state locally (localStorage/IndexedDB) so content survives brief connectivity loss.

---

## 4. Multi-Tenancy & Roles

- **Organization** → top-level tenant (a business/brand)
- **Location** → a physical site under an org
- **Screen** → a device/display under a location
- **Roles:** Super Admin (org owner, full control) → Admin (assigned locations) → Location Manager (single location, limited edit rights)

All data access must be scoped by `organization_id` at the query layer — never trust client-supplied org/location IDs without server-side ownership checks.

---

## 5. Core Data Model (high-level)

- `organizations`
- `locations` (belongs to organization)
- `screens` (belongs to location; stores device token, last-heartbeat, resolution, orientation)
- `menus` (belongs to organization; versioned)
- `menu_items` (belongs to menu; name, price, description, image, availability)
- `templates` (design layouts, org-owned or global library)
- `themes` (time/season rules → which template/menu combo is active)
- `pos_integrations` (per-location POS credentials/config, provider type)
- `pos_sync_events` (audit log of price/availability changes from POS)
- `users` (Clerk-linked, role, org/location scope)

---

## 6. Core Features (v1 scope)

1. **Auth & onboarding** — Clerk org creation, invite flow, role assignment
2. **Menu designer** — drag-and-drop canvas editor, template library, AI-assisted layout generation
3. **Screen management** — pair a screen (QR/code pairing flow), assign to location, monitor online/offline via heartbeat
4. **Real-time publish** — edit menu → push to all assigned screens instantly
5. **Theme scheduling** — time-of-day and date-range rules that auto-switch active menu/template
6. **POS integration (phase 1: one provider)** — webhook or polling adapter that syncs price/availability into `menu_items`
7. **Multi-location dashboard** — org-wide view, per-location drill-down
8. **Display client** — kiosk-mode web player, offline-resilient caching, auto-reconnect
9. **Marketing landing page** — public site at `frontend/app/(marketing)/page.tsx`; 16-section structure (hero, integrations grid, template showcase, industries served, what-you-get, device compatibility, why-our-device, menu designer showcase, mobile/POS control, multi-admin, scale statement, AI menu generation, theme automation, why-digital-signage stats, testimonials, contact/footer). Original copy and imagery only — no reused third-party content, no fabricated stats/testimonials (mark unverified numbers with `TODO`). Full spec in PROMPTS.md, Prompt A.

**Explicitly out of scope for v1:** native Android TV/Tizen/webOS/Roku apps, mobile app, queue management module, 20,000+ channel aggregator, social feed embeds. Revisit post-MVP.

---

## 7. POS Integration Strategy

Use an adapter pattern — one interface, provider-specific implementations:

```
POSAdapter (abstract)
 ├── SquareAdapter
 ├── ToastAdapter
 └── ClearMockAdapter (for local dev/demo)
```

Each adapter normalizes incoming webhooks/polling data into a common `PriceUpdateEvent` / `AvailabilityUpdateEvent` shape before writing to `menu_items`. Queue incoming POS events through Redis to avoid webhook timeout/data-loss under load.

---

## 8. Display/Kiosk Client Requirements

- Must run in a plain Chromium browser (`--kiosk` flag) — target hardware: Raspberry Pi, generic Android box via browser, Fire Stick Silk browser
- No heavy client-side animation libraries; keep bundle and repaint cost low for low-end hardware
- Local cache of last-rendered state (IndexedDB) so a screen never goes blank on reconnect
- Auto-reconnect with exponential backoff on WebSocket drop
- A `/pair` flow: screen boots, shows a pairing code, admin enters it in dashboard to bind screen → location

---

## 9. Coding Conventions

- TypeScript strict mode across Next.js codebase
- SQLAlchemy models (`backend/db`) are the single source of truth for DB schema. Frontend TypeScript types in `frontend/lib/types/` are **not** hand-mirrored — generate them from FastAPI's OpenAPI spec: `npx openapi-typescript http://localhost:8000/openapi.json -o frontend/lib/types/api.ts`. Regenerate after any Pydantic model change; consider wiring this into a CI step.
- All FastAPI endpoints require explicit Pydantic request/response models — no raw dict returns
- Every mutation endpoint enforces org/location ownership check before touching data
- Real-time events use a single typed event envelope: `{ type, screenId, payload, ts }`
- Environment config via `.env` — never commit secrets; document required vars in `.env.example` (one per folder: `frontend/.env.example`, `backend/.env.example`)

---

## 10. Repo Structure

Project root: **`digital-signage-saas`** — two top-level folders, no monorepo tooling.

```
digital-signage-saas/
├── frontend/              → Next.js (dashboard, menu designer, display/kiosk client, marketing site)
│   ├── app/
│   │   └── (marketing)/    → public landing page
│   ├── components/
│   ├── lib/
│   │   ├── mock-data.ts   → mock data contract (frontend-first build phase)
│   │   └── types/         → shared types mirrored from backend schema
│   └── .env.example
├── backend/                → FastAPI
│   ├── app/                → routes, services
│   ├── db/                 → SQLAlchemy models + Alembic migrations (Supabase Postgres)
│   ├── workers/             → Celery tasks + Celery Beat schedules
│   └── .env.example
├── infra/
│   └── docker-compose.yml  → local Postgres/Redis for dev
├── AGENTS.md
├── PROMPTS.md
└── README.md
```

---

## 11. Build Phases

**Build order:** Frontend first, Backend second. The full UI (dashboard, menu designer, display client) is built first against a typed mock data layer (`frontend/lib/mock-data.ts`) matching the Section 5 schema. The backend is then built to match that exact contract, and each API replaces its corresponding mock call as it ships. The marketing landing page (feature 9) is independent of this sequence and can be built any time after the frontend foundation. Detailed step-by-step prompts for this sequence live in `PROMPTS.md`.

1. **Phase 1 — Core dashboard + single screen display:** auth, org/location/screen CRUD, basic menu CRUD, manual publish, kiosk display client, pairing flow
2. **Phase 2 — Real-time + designer:** WebSocket push, drag-and-drop template editor, theme scheduling
3. **Phase 3 — POS integration:** one adapter live end-to-end, sync audit log, price-change UI feedback
4. **Phase 4 — Multi-location scale:** role-based access refinement, bulk screen actions, offline resilience hardening
5. **Phase 5 (post-MVP):** mobile app, native TV apps, queue management, AI menu generation, billing/subscription (Stripe)

---

## 12. Deployment

**Backend stack to deploy:** FastAPI web service + Celery worker + Celery Beat + Redis. Database is Supabase (managed separately, not self-hosted).

| Stage | Platform | Why |
|---|---|---|
| Dev / testing | **Railway** | No idle spin-down (usage-based scale-to-zero, not a fixed inactivity sleep) — good for testing WebSocket connections and Celery workers without cold-start friction. $5 trial credit to start, Hobby plan ~$5/mo after. |
| Production | **Render (Starter plan)** or **Railway (Pro)** | Both need a paid, always-on tier in production — free tiers on either platform are not viable for this project (screens need persistent WebSocket/heartbeat connectivity; a sleeping backend means screens falsely show offline). Render Starter is ~$7/mo per service (web + worker = ~$14/mo) with fixed, predictable pricing. Railway is usage-based — cheaper at low traffic, but less predictable as usage grows. |
| Scale-up (post-traction) | AWS (ECS/EC2) or GCP | Once paying customers and multi-location clients justify it — more control, better cost efficiency at scale. |

**Rule of thumb:** build and test on Railway during Phase 1-2 (fast iteration, no sleep issues). Before onboarding a real paying client with live screens, move to a paid always-on tier (Render Starter or Railway Pro) — never launch client-facing screens on a free/sleeping tier.

**Note on Hugging Face Spaces:** not suitable for this project — designed for ML demos, not persistent WebSocket connections, background workers, or reliable webhook uptime.

---

## 13. Non-Negotiables

- Screen content must degrade gracefully offline — never a blank/broken screen
- All tenant data strictly isolated by organization at the query layer
- Real-time publish latency target: under 3 seconds from save to screen update
- Pricing model (if kept simple like the reference product) should be reflected in a `subscriptions`/`billing` table from day one, even if billing UI ships later

---

## 14. Missing Functionality Roadmap

The following functionality is required to close the remaining core product gaps. These features must be implemented as real, production-ready functionality and integrated with the existing architecture, authentication, organization/location isolation, permissions, APIs, database, display client, and design system. Do not create disconnected mock/demo pages.

### Core CMS & Collaboration

1. **Team Management**
   - Invite, accept, resend, cancel, suspend, reactivate, and remove members.
   - Show member status, role, locations, and activity.

2. **Roles & Permissions**
   - Organization Owner, Admin, Location Manager, Content Manager, Viewer.
   - Enforce permissions server-side.
   - Support location-scoped access and strict organization isolation.

3. **Media Library**
   - Image, video, audio, logo, and promotional asset management.
   - Upload, preview, search, filtering, folders, tags, rename, replace, download, delete, usage tracking, and secure storage.
   - Reusable media picker for menus, templates, playlists, and future modules.

4. **Rich Menu Items**
   - Menu item images and videos.
   - Multiple media assets where appropriate.
   - Promotional badges and optional dietary/nutritional metadata.
   - Reuse the Media Library rather than creating separate upload systems.

5. **Advanced Template Designer**
   - Rich text, image, video, menu, logo, shape, background, QR, clock, weather, and promotional elements.
   - Drag/drop, resize, alignment, layers, grouping, locking, typography, opacity, and positioning controls.

6. **Animations & Transitions**
   - Fade, slide, zoom, scale, wipe, dissolve, pan, and lightweight element/slide animations.
   - Must remain performant on low-end kiosk hardware.

7. **Playlists & Content Management**
   - Ordered content playback with duration, looping, priority, publishing, draft, and version states.
   - Support templates, menus, images, and videos.

8. **Content Versioning & Publishing**
   - Draft, published, and archived states.
   - Version history, publisher, timestamps, change history, restore, and atomic publication.

### Display & Device Capabilities

9. **Offline Playback**
   - Cache published menus, templates, images, videos, fonts, and configuration locally.
   - Continue playback during connectivity loss.
   - Automatic retry and synchronization after reconnect.

10. **Advanced Device Management**
    - Device health, last heartbeat, last sync, current content, version, errors, remote refresh, and recovery workflows.
    - QR/code pairing and clearer pairing failure/recovery states.

11. **Multi-Screen / Video Wall Sync**
    - Screen groups supporting 2x2, 3x3, 4x4, and extensible layouts.
    - Grid positioning, synchronized playback, monitoring, and graceful handling of offline screens.

12. **Background Music / Audio**
    - Audio library, playlists, volume, mute, looping, scheduling, and screen/template assignment.
    - Use only user-provided or appropriately licensed audio.

13. **Video Management & Basic Editor**
    - Video upload, thumbnails, duration detection, trimming, cropping, poster frames, mute, looping, transcoding/optimization where required.

### Signage Widgets & Engagement

14. **QR Code Generator**
    - Generate QR codes for menus, promotions, ordering, custom URLs, and other supported destinations.
    - Custom styling, logo, SVG/PNG export, and template integration.

15. **Weather Widget**
    - Current weather, temperature, condition, high/low, optional forecast, location selection, and Celsius/Fahrenheit.
    - Cache the last successful response and fail gracefully.

16. **AI Template Creator**
    - Generate editable signage layouts from natural-language instructions.
    - Support regeneration and style adjustments while keeping the result editable in the existing designer.

### Integrations & Platform

17. **Expanded POS Integrations**
    - Keep the adapter architecture.
    - Add providers such as Clover.
    - Normalize price, availability, menu, SKU, webhook, and sync events through the common POS interface.

18. **Public API**
    - Secure APIs for organizations, locations, screens, menus, menu items, media, templates, playlists, schedules, devices, and POS synchronization.
    - API keys, scopes, rotation, revocation, rate limiting, logging, and documentation.

19. **API Key Management**
    - Organization-level API key creation, scoped permissions, rotation, revocation, last-used information, and audit history.

20. **Analytics & Reporting**
    - Screen uptime/offline status, heartbeat health, sync errors, content usage, QR scans, POS sync performance, and useful date/location filters.

21. **Notifications & Alerts**
    - Screen offline/online, POS sync failures, publishing failures, media processing failures, invitation events, and important system errors.
    - Configurable notification preferences.

22. **Audit Logs**
    - Organization-level history of authentication, team changes, content changes, publishing, scheduling, POS configuration, API keys, and important settings changes.

23. **Global Search**
    - Search menus, menu items, templates, media, screens, locations, team members, playlists, schedules, and other relevant entities.

24. **Advanced Scheduling**
    - Time-of-day, day-of-week, date-range, seasonal, holiday, recurring, location-specific, and screen-specific schedules.
    - Clear priority/conflict resolution when schedules overlap.

### Optional Growth / Hub Modules

These are separate from the core signage CMS and should remain modular:

25. **Guest Smart WiFi**
    - Branded captive portal, customer opt-in, email/phone capture, consent, location association, and analytics.

26. **Marketing Tools**
    - Customer segments, promotions, email/SMS campaigns where properly integrated, scheduling, and campaign analytics.

27. **Loyalty Program**
    - Customer enrollment, loyalty tracking, rewards, and integration with supported marketing/customer data systems.

28. **Reputation Management**
    - Review aggregation where permitted, ratings overview, review monitoring, review links, and location-specific metrics.

29. **Online Ordering**
    - Digital menus, ordering links, QR ordering, availability configuration, location configuration, and signage integration.

30. **Interactive Touchscreen Elements**
    - Touch buttons, polls, quizzes, promotions, navigation, and interactive menu components.
    - Use an extensible interaction/event model for future interactive features.

### Implementation Rules for Missing Functionality

- Inspect existing code before creating new models, routes, components, or services.
- Extend existing functionality rather than duplicating it.
- Every feature must have real frontend, backend, persistence, authorization, validation, error handling, and tests where applicable.
- All mutations require server-side organization/location ownership checks.
- Reuse the existing Clerk, FastAPI, SQLAlchemy, Supabase, Redis, Celery, S3/CDN, WebSocket, and display-client architecture.
- New media functionality must use the existing S3-compatible storage direction.
- New display functionality must preserve the offline-first requirement.
- New real-time functionality must use the existing typed WebSocket event envelope.
- New API contracts must use explicit Pydantic models and regenerate frontend OpenAPI types.
- Do not expose secrets to the frontend.
- Do not silently break existing menu, screen, scheduling, POS, pairing, or publishing functionality.
- Do not mark a feature complete when only its UI exists.
- Prioritize core CMS/display functionality before optional Hub modules.

### Recommended Implementation Order

1. Team Management
2. Roles & Permissions
3. Media Library
4. Rich Menu Items / Menu Media
5. Advanced Template Designer
6. Animations & Transitions
7. Playlists / Content Management
8. Content Versioning & Publishing
9. Advanced Device Management
10. Offline Playback Hardening
11. Advanced Scheduling
12. QR Code Generator
13. Weather Widget
14. Video Management / Editor
15. Multi-Screen / Video Wall Sync
16. Background Music / Audio
17. Expanded POS Integrations
18. Public API / API Key Management
19. Analytics & Reporting
20. Notifications & Audit Logs
21. Global Search
22. AI Template Creator
23. Guest Smart WiFi
24. Marketing Tools
25. Loyalty Program
26. Reputation Management
27. Online Ordering
28. Interactive Touchscreen Elements

