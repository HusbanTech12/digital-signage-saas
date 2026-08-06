import asyncio

from sqlalchemy import text

from db.session import engine


async def main() -> None:
    async with engine.connect() as conn:
        enums = (
            await conn.execute(
                text(
                    """
                    select t.typname, e.enumlabel
                    from pg_type t
                    join pg_enum e on t.oid = e.enumtypid
                    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
                    where n.nspname = 'public'
                    order by t.typname, e.enumsortorder
                    """
                )
            )
        ).all()
        print("enums:")
        for name, label in enums:
            print(f"  {name}: {label}")

        counts = (
            await conn.execute(
                text(
                    """
                    select 'organizations' as t, count(*) from organizations
                    union all select 'locations', count(*) from locations
                    union all select 'screens', count(*) from screens
                    union all select 'users', count(*) from users
                    """
                )
            )
        ).all()
        print("counts:")
        for t, n in counts:
            print(f"  {t}: {n}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
