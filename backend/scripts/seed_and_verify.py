"""Seed demo tenant into Supabase and print row counts (no secrets)."""

import asyncio

from sqlalchemy import func, select, text

from app.routes.dev import seed_demo_data
from db.models import Location, Organization, Screen, User
from db.session import AsyncSessionLocal, engine


class _Dummy:
    pass


async def main() -> None:
    async with AsyncSessionLocal() as db:
        # Call seed endpoint logic directly
        result = await seed_demo_data(db)
        print("seed:", result)

    async with AsyncSessionLocal() as db:
        org_n = await db.scalar(select(func.count()).select_from(Organization))
        loc_n = await db.scalar(select(func.count()).select_from(Location))
        scr_n = await db.scalar(select(func.count()).select_from(Screen))
        usr_n = await db.scalar(select(func.count()).select_from(User))
        print(f"counts organizations={org_n} locations={loc_n} screens={scr_n} users={usr_n}")

        org = await db.get(Organization, "org_demo_001")
        print("org_name:", org.name if org else None)

        # Smoke-test a simple query path used by the API
        locs = (
            await db.execute(
                select(Location)
                .where(Location.organization_id == "org_demo_001")
                .order_by(Location.name)
            )
        ).scalars().all()
        print("location_names:", [l.name for l in locs])

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
