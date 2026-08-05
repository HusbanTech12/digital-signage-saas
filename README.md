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

### Env notes

- `DATABASE_URL` must use `postgresql+asyncpg://…`
- Set `CLERK_JWKS_URL` / `CLERK_FRONTEND_API` for JWT verification
- Prefer Docker Postgres for migrations; Supabase pooler (port 6543) can be flaky with Alembic — use a direct DB URL if needed

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
