"""Conexión y sesión PostgreSQL con SQLAlchemy async."""
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from backend.config import settings

# Asegurar que la URL use driver async
url = settings.DATABASE_URL
if url.startswith("postgresql://"):
    url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

# asyncpg no acepta sslmode en connect(); usa ssl=True. Quitar sslmode de la URL y pasar ssl por connect_args.
parsed = urlparse(url)
query = parse_qs(parsed.query, keep_blank_values=True)
sslmode = query.pop("sslmode", None)
ssl_param = query.pop("ssl", None)
new_query = urlencode([(k, v[0] if len(v) == 1 else v) for k, v in query.items()], doseq=True)
url = urlunparse(parsed._replace(query=new_query))

need_ssl = False
if sslmode:
    need_ssl = sslmode[0].lower() in ("require", "true", "1", "yes") if isinstance(sslmode, list) else True
if not need_ssl and ssl_param:
    need_ssl = ssl_param[0].lower() in ("true", "1", "yes") if isinstance(ssl_param, list) else True
if not need_ssl and "postgres.database.azure.com" in url:
    need_ssl = True
connect_args = {"ssl": True} if need_ssl else {}

engine = create_async_engine(
    url,
    echo=settings.ENV == "development",
    pool_pre_ping=True,
    connect_args=connect_args,
)
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)
Base = declarative_base()


async def init_db():
    from backend.config import settings
    from backend.models.user import User, Role
    from sqlalchemy import select

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    if settings.DEV_SKIP_AUTH:
        async with AsyncSessionLocal() as db:
            existing = await db.execute(select(User).where(User.id == 1))
            if existing.scalar_one_or_none() is None:
                dev = User(id=1, email="dev@local", name="Dev Local", role=Role.admin)
                db.add(dev)
                await db.commit()


async def close_db():
    await engine.dispose()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
