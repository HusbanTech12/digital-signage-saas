# Digital Signage SaaS

Multi-tenant digital menu board platform.

- **Frontend**: Next.js (App Router, TypeScript, Tailwind CSS) — dashboard, designer, kiosk, marketing
- **Backend**: FastAPI + SQLAlchemy (async) + Alembic — Supabase Postgres / local Docker
- **Auth**: Clerk
- **Jobs / cache**: Celery + Redis (wired in later prompts)

See `AGENTS.md` and `PROMPTS.md` for product scope and build order.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Copy `frontend/.env.example` → `frontend/.env.local` and add Clerk keys.

## Backend

Requires **Python 3.11+** and either local Docker Postgres or Supabase.

```bash
# Local Postgres + Redis
cd infra
docker compose up -d

cd ../backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # or edit backend/.env

alembic upgrade head
uvicorn main:app --reload --port 8000
```

Health check: [http://localhost:8000/health](http://localhost:8000/health)

### Seed demo tenant (Prompt 6)

```bash
curl -X POST http://localhost:8000/api/v1/dev/seed
```

Seeds Harbor & Hearth org, locations, screens (pairing code `482917`), and demo users for `DEV_AUTH_BYPASS`.

### Wire the frontend to the API

In `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID=org_demo_001
# Remove or set false once the backend is running + seeded:
NEXT_PUBLIC_USE_MOCK_API=false
```

With `NEXT_PUBLIC_USE_MOCK_API=true` (or no `NEXT_PUBLIC_API_URL`), the dashboard keeps using the in-memory mock store.

### Env notes

- `DATABASE_URL` must use `postgresql+asyncpg://…`
- Supabase **transaction pooler** (port `6543`) needs `statement_cache_size=0` (already handled in `db/session.py` / Alembic)
- Set `CLERK_JWKS_URL` / `CLERK_FRONTEND_API` for JWT verification
- `DEV_AUTH_BYPASS=true` (development) accepts `Authorization: Bearer dev:<clerk_user_id>`
- Prefer a direct Supabase DB URL (port `5432`) for migrations when the pooler misbehaves

### Core tenant APIs (Prompt 6)

| Method | Path | Auth |
|---|---|---|
| GET/PATCH | `/api/v1/organizations/{id}` | Clerk / dev bypass |
| GET/POST | `/api/v1/locations` | Clerk / dev bypass |
| PATCH/DELETE | `/api/v1/locations/{id}` | Clerk / dev bypass |
| GET/PATCH/DELETE | `/api/v1/screens`… | Clerk / dev bypass |
| POST | `/api/v1/pairing/sessions` | Public (kiosk) |
| POST | `/api/v1/pairing/complete` | Clerk / dev bypass |
| GET/POST | `/api/v1/menus` | Clerk / dev bypass |
| PATCH/DELETE | `/api/v1/menus/{id}` | Clerk / dev bypass |
| POST | `/api/v1/menus/publish` | Clerk / dev bypass |
| GET/POST/PATCH/DELETE | `/api/v1/menu-items`… | Clerk / dev bypass |
| GET/POST/PATCH/DELETE | `/api/v1/templates`… | Clerk / dev bypass |
| GET | `/api/v1/screens/{id}/content?device_token=` | Screen device token |
| WS | `/api/v1/screens/{id}/ws?device_token=` | Screen device token |

### Real-time sync (Prompt 8)

Publish (`POST /api/v1/menus/publish`) writes screen assignments, then fans out a typed envelope `{ type, screenId, payload, ts }` over Redis pub/sub (channel `signage:screen:{screenId}`). Each API worker relays to local WebSocket subscribers.

- Kiosk connects to `WS /api/v1/screens/{id}/ws?device_token=…`, reconnects with exponential backoff, and polls `GET …/content` every few seconds as fallback.
- Without Redis, a single uvicorn worker still pushes in-process (fine for local demo).
- Start Redis locally: `cd infra && docker compose up -d redis`

### Theme scheduling + offline detection (Prompt 9)

| Method | Path | Auth |
|---|---|---|
| GET/POST | `/api/v1/themes` | Clerk / admin roles |
| PATCH/DELETE | `/api/v1/themes/{id}` | Clerk / admin roles |
| POST | `/api/v1/themes/apply-now` | Clerk / admin roles |

- Time-of-day and date-range themes auto-switch `active_menu_id` / `active_template_id` (location timezone).
- Date-range wins over time-of-day when both match.
- Stale heartbeats mark screens `online` → `offline` after `SCREEN_OFFLINE_AFTER_SECONDS` (default 60).
- Dashboard Themes page + Screens status poll every 20s.
- Uvicorn runs an inline scheduler every 30s by default. Production-style:

```bash
cd backend
celery -A workers.celery_app worker --loglevel=info
celery -A workers.celery_app beat --loglevel=info
```

Set `INLINE_SCHEDULER=false` when Celery Beat owns scheduling.

## Repo layout

```
digital-signage-saas/
├── frontend/
├── backend/
│   ├── app/          # routes, auth, schemas
│   ├── db/           # SQLAlchemy models
│   ├── alembic/      # migrations
│   └── workers/      # Celery tasks + Beat (Prompt 9)
├── infra/
│   └── docker-compose.yml
├── AGENTS.md
└── PROMPTS.md
```
