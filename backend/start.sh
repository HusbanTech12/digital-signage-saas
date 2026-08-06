#!/bin/sh
set -e

# Optional: run migrations when DATABASE_URL is present
if [ -n "${DATABASE_URL:-}" ] || [ -n "${DATABASE_URL_SYNC:-}" ]; then
  echo "Running Alembic migrations..."
  alembic upgrade head || echo "Alembic migrate skipped/failed — continuing boot"
fi

PORT="${PORT:-8000}"
exec uvicorn main:app --host 0.0.0.0 --port "$PORT"
