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

    # Team invitations
    frontend_url: str = "http://localhost:3000"
    invite_expiry_days: int = 7
    resend_api_key: str = ""
    email_from: str = ""

    # Clover OAuth + webhooks (sandbox by default)
    clover_app_id: str = ""
    clover_app_secret: str = ""
    clover_env: str = "sandbox"
    clover_region: str = "na"
    clover_webhook_auth: str = ""

    # Public origin of this API — encoded into tracked QR codes (/q/<code>)
    public_api_url: str = "http://localhost:8000"

    # Media library (S3-compatible; falls back to local disk when unset)
    media_local_root: str = "uploads"
    s3_bucket: str = ""
    s3_region: str = "auto"
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_public_base_url: str = ""
    s3_acl: str = ""

    # When true (development), accept Authorization: Bearer dev:<clerk_user_id>
    # so the dashboard role switcher can hit real APIs without a Clerk JWT.
    dev_auth_bypass: bool = True

    # Prompt 9 — mark online screens offline after missed heartbeats
    screen_offline_after_seconds: int = 60

    # Run theme + offline ticks inside the API process (handy without Celery).
    # Disabled automatically on Vercel serverless (no long-lived process).
    inline_scheduler: bool = True
    inline_scheduler_interval_seconds: int = 30

    @property
    def public_api_origin(self) -> str:
        return (self.public_api_url or "http://localhost:8000").rstrip("/")

    @property
    def public_frontend_origin(self) -> str:
        return (self.frontend_url or "http://localhost:3000").rstrip("/")

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        # Always allow local frontend + known Vercel production aliases
        for extra in (
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://digital-signage-web-rho.vercel.app",
            "https://digital-signage-web.vercel.app",
            "https://digital-menu-brai.vercel.app",
        ):
            if extra not in origins:
                origins.append(extra)
        return origins

    @property
    def database_host_is_local(self) -> bool:
        url = self.async_database_url.lower()
        return "localhost" in url or "127.0.0.1" in url

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
        """Supabase transaction pooler (PgBouncer) needs statement_cache_size=0 + SSL."""
        args: dict = {}
        if self.uses_supabase_pooler or "supabase.com" in self.async_database_url.lower():
            import ssl

            # Supabase pooler presents an intermediate that fails strict verify
            # on some serverless runtimes (CERTIFICATE_VERIFY_FAILED / self-signed).
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            args["statement_cache_size"] = 0
            args["ssl"] = ctx
        return args

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
