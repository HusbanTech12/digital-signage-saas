from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Digital Signage SaaS API"
    app_env: str = "development"
    cors_origins: str = "http://localhost:3000"

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/signage"
    database_url_sync: str | None = None

    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""
    clerk_frontend_api: str = ""
    clerk_jwks_url: str = ""

    redis_url: str = "redis://localhost:6379/0"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # When true (development), accept Authorization: Bearer dev:<clerk_user_id>
    # so the dashboard role switcher can hit real APIs without a Clerk JWT.
    dev_auth_bypass: bool = True

    # Prompt 9 — mark online screens offline after missed heartbeats
    screen_offline_after_seconds: int = 60

    # Run theme + offline ticks inside the API process (handy without Celery)
    inline_scheduler: bool = True
    inline_scheduler_interval_seconds: int = 30

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    @property
    def alembic_database_url(self) -> str:
        return self.database_url_sync or self.async_database_url

    @property
    def sync_database_url(self) -> str:
        """Sync SQLAlchemy URL for Celery workers (psycopg)."""
        if self.database_url_sync:
            url = self.database_url_sync
        else:
            url = self.database_url
        if url.startswith("postgresql+asyncpg://"):
            return url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg://", 1)
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    @property
    def uses_supabase_pooler(self) -> bool:
        url = self.async_database_url.lower()
        return "pooler.supabase.com" in url or ":6543/" in url

    @property
    def async_engine_connect_args(self) -> dict:
        """Supabase transaction pooler (PgBouncer) needs statement_cache_size=0."""
        if self.uses_supabase_pooler:
            return {"statement_cache_size": 0}
        return {}

    @property
    def resolved_jwks_url(self) -> str:
        if self.clerk_jwks_url:
            return self.clerk_jwks_url
        if self.clerk_frontend_api:
            host = self.clerk_frontend_api.removeprefix("https://").removeprefix(
                "http://"
            )
            return f"https://{host}/.well-known/jwks.json"
        return ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
