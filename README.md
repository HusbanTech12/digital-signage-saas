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
