# Digital Signage SaaS

Multi-tenant digital menu board platform.

- **Frontend**: Next.js (App Router, TypeScript, Tailwind CSS)
- **Backend**: FastAPI + SQLAlchemy (async) + Alembic — Supabase Postgres / local Docker
- **Auth**: Clerk
- **Jobs / realtime**: Celery + Redis, WebSocket screen push

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Copy `frontend/.env.example` → `frontend/.env.local` and add Clerk keys + `NEXT_PUBLIC_API_URL`.

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Seed demo tenant:

```bash
curl -X POST http://localhost:8000/api/v1/dev/seed
```

Optional Redis (realtime + Celery):

```bash
cd infra
docker compose up -d redis
```

### Celery (themes / offline / POS queue)

```bash
cd backend
celery -A workers.celery_app.celery_app worker -l info
celery -A workers.celery_app.celery_app beat -l info
```

Without Celery, the API still runs an inline theme/offline scheduler and processes POS webhooks inline.

## POS integration (Prompt 10 — Square first)

First provider: **Square** (demo webhook + simulate). Adapters also include `clear_mock`.

| Method | Path | Auth |
|---|---|---|
| GET/POST | `/api/v1/pos/integrations` | Clerk |
| PATCH/DELETE | `/api/v1/pos/integrations/{id}` | Clerk |
| GET | `/api/v1/pos/integrations/{id}/events` | Clerk |
| GET | `/api/v1/pos/sync-status` | Clerk |
| POST | `/api/v1/pos/integrations/{id}/simulate` | Clerk |
| POST | `/api/v1/webhooks/pos/{provider}/{id}` | Webhook secret |

Seed creates `pos_square_downtown` with SKU map:

- `SKU-LATTE` → `item_latte`
- `SKU-AVOCADO` → `item_avocado`
- `SKU-SOUP` → `item_soup`

Simulate from **Dashboard → Settings**, or:

```bash
curl -X POST http://localhost:8000/api/v1/webhooks/pos/square/pos_square_downtown \
  -H "Content-Type: application/json" \
  -H "X-Pos-Signature: demo-pos-secret" \
  -d "{\"updates\":[{\"type\":\"price_update\",\"externalSku\":\"SKU-LATTE\",\"price\":5.25}]}"
```

## Deploy on Vercel (frontend + API)

Monorepo: create **two** Vercel projects (or one frontend project + keep API elsewhere).

### Frontend (Next.js)

1. Import the Git repo → **Root Directory** = `frontend`
2. Framework: Next.js (auto)
3. Env vars (Production): from `frontend/.env.example` / `.env.local`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_API_URL` = your API URL (e.g. `https://digital-signage-api.vercel.app`)
   - `NEXT_PUBLIC_USE_MOCK_API=false`
4. Deploy

CLI (from repo root, after `npx vercel login`):

```bash
cd frontend
npx vercel link --yes --project digital-signage-web --scope <team-slug>
npx vercel --prod --yes
```

Current production project: `digital-signage-web` → https://digital-signage-web-rho.vercel.app

### Backend (FastAPI on Vercel)

1. Second Vercel project → **Root Directory** = `backend`
2. Framework: FastAPI / Python (`app.main:app` via `pyproject.toml` `[tool.vercel]`)
3. Dependencies: keep **`pyproject.toml` `[project].dependencies`** in sync with `requirements.txt` (Vercel installs from `pyproject.toml` when present)
4. Env vars: from `backend/.env.example`
   - `DATABASE_URL` (`postgresql+asyncpg://…`)
   - `CLERK_JWKS_URL` or `CLERK_FRONTEND_API`
   - `CORS_ORIGINS` = frontend URL(s), comma-separated
   - `APP_ENV=production`
   - `DEV_AUTH_BYPASS=false`
   - `INLINE_SCHEDULER=false` (recommended on serverless)
   - `REDIS_URL` optional (WebSockets / Celery are limited on Vercel)

CLI:

```bash
cd backend
npx vercel link --yes --project digital-signage-api --scope <team-slug>
npx vercel --prod --yes
```

Current production project: `digital-signage-api` → https://digital-signage-api-pi.vercel.app  
Health: `GET /health` → `{"status":"ok",...}`

**Limits on Vercel Functions:** durable WebSockets, Celery Beat, and Redis pub/sub relays are unreliable. Kiosk HTTP polling still works. For always-on WS + workers, prefer Railway for the API and Vercel only for the frontend.

Also add the frontend URL in the **Clerk Dashboard → Allowed origins / redirect URLs**.

## Deploy backend on Railway (optional / realtime)

Railpack failed because the repo root is a monorepo (`frontend/` + `backend/`). Point the Railway service at **`backend`**.

1. Railway → your API service → **Settings**
2. Set **Root Directory** to `backend` (required)
3. Clear any custom start script that points to repo-root `start.sh`
4. Redeploy

This repo includes:
- `backend/Dockerfile`
- `backend/start.sh` (uvicorn on `$PORT`, optional Alembic)
- `backend/railway.toml`

### Required env vars (Railway)

Same as the Vercel backend list above; also set `REDIS_URL` (Railway Redis plugin recommended).

Health check: `GET /health`

## Repo layout

```
digital-signage-saas/
├── frontend/
├── backend/
│   ├── app/          # routes, auth, schemas, services
│   ├── db/           # SQLAlchemy models
│   ├── alembic/      # migrations
│   └── workers/      # Celery tasks + Beat
├── infra/
│   └── docker-compose.yml
├── AGENTS.md
└── PROMPTS.md
```
