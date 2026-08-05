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
- Set `CLERK_JWKS_URL` / `CLERK_FRONTEND_API` for JWT verification
- `DEV_AUTH_BYPASS=true` (development) accepts `Authorization: Bearer dev:<clerk_user_id>`
- Prefer Docker Postgres for migrations; Supabase pooler (port 6543) can be flaky with Alembic — use a direct DB URL if needed

### Core tenant APIs (Prompt 6)

| Method | Path | Auth |
|---|---|---|
| GET/PATCH | `/api/v1/organizations/{id}` | Clerk / dev bypass |
| GET/POST | `/api/v1/locations` | Clerk / dev bypass |
| PATCH/DELETE | `/api/v1/locations/{id}` | Clerk / dev bypass |
| GET/PATCH/DELETE | `/api/v1/screens`… | Clerk / dev bypass |
| POST | `/api/v1/pairing/sessions` | Public (kiosk) |
| POST | `/api/v1/pairing/complete` | Clerk / dev bypass |

## Repo layout

```
digital-signage-saas/
├── frontend/
├── backend/
│   ├── app/          # routes, auth, schemas
│   ├── db/           # SQLAlchemy models
│   ├── alembic/      # migrations
│   └── workers/      # Celery (later)
├── infra/
│   └── docker-compose.yml
├── AGENTS.md
└── PROMPTS.md
```
