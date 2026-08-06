import asyncio

from sqlalchemy import text

from db.session import engine


async def main() -> None:
    async with engine.connect() as conn:
        rows = (
            await conn.execute(
                text(
                    """
                    select table_name, column_name, data_type, is_nullable
                    from information_schema.columns
                    where table_schema = 'public'
                      and table_name in (
                        'organizations','locations','screens','users',
                        'menus','menu_items','templates','themes',
                        'alembic_version'
                      )
                    order by table_name, ordinal_position
                    """
                )
            )
        ).all()
        current = None
        for table_name, column_name, data_type, is_nullable in rows:
            if table_name != current:
                print(f"\n[{table_name}]")
                current = table_name
            print(f"  {column_name}: {data_type} null={is_nullable}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
