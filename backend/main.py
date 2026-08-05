"""Uvicorn entrypoint: `uvicorn main:app --reload` from the backend/ folder."""

from app.main import app

__all__ = ["app"]
