from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.config import settings

# Determine the database dialect from URL
db_url = settings.database_url
if db_url.startswith("mysql"):
    # Convert mysql+pymysql to mysql+aiomysql
    db_url = db_url.replace("mysql+pymysql", "mysql+aiomysql")
    db_url = db_url.replace("mysql+asyncpg", "mysql+aiomysql")

# Create engine with appropriate pool
if "mysql" in db_url:
    # MySQL needs special handling
    engine = create_async_engine(
        db_url,
        echo=settings.debug,
        poolclass=NullPool,  # MySQL async needs NullPool or proper pool config
    )
else:
    engine = create_async_engine(db_url, echo=settings.debug)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Alias for backwards compatibility
AsyncSessionLocal = async_session


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
