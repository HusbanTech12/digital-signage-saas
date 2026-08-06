"""
Drop the outdated public app tables (empty in this project), recreate from
SQLAlchemy metadata matching our models, then seed Harbor & Hearth demo data.
"""

import asyncio

from sqlalchemy import text

from app.routes.dev import seed_demo_data
from db.base import Base
from db import models  # noqa: F401
from db.session import AsyncSessionLocal, engine


DROP_SQL = """
DO $$ DECLARE
  r RECORD;
BEGIN
  -- Drop all tables in public
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
  -- Drop custom enums in public
  FOR r IN (
    SELECT t.typname
    FROM pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
  ) LOOP
    EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
  END LOOP;
END $$;
"""


async def main() -> None:
    async with engine.begin() as conn:
        await conn.execute(text(DROP_SQL))
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS alembic_version ("
                "version_num VARCHAR(32) NOT NULL PRIMARY KEY)"
            )
        )
        await conn.execute(text("DELETE FROM alembic_version"))
        await conn.execute(
            text("INSERT INTO alembic_version (version_num) VALUES ('20260802_0001')")
        )
        print("schema_recreated: True")

    async with AsyncSessionLocal() as db:
        result = await seed_demo_data(db)
        print("seed:", result)

    async with AsyncSessionLocal() as db:
        org = (
            await db.execute(text("select name from organizations where id='org_demo_001'"))
        ).scalar()
        loc_n = (await db.execute(text("select count(*) from locations"))).scalar()
        scr_n = (await db.execute(text("select count(*) from screens"))).scalar()
        usr_n = (await db.execute(text("select count(*) from users"))).scalar()
        print(f"verify org={org} locations={loc_n} screens={scr_n} users={usr_n}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
