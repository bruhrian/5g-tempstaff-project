from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from session_app.config import settings

# ------------------------------------------------------------------
# Main database (sessions / users)
# ------------------------------------------------------------------
engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


# FastAPI dependency that yields an async DB session per request.
# Automatically commits on success, rolls back on error, and always closes the session.
async def get_db() -> AsyncSession:
    """FastAPI dependency — yields a DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ------------------------------------------------------------------
# Frontend database (node_types)
# ------------------------------------------------------------------
frontend_engine = create_async_engine(
    settings.frontend_database_url,
    echo=settings.environment == "development",
    pool_size=5,
    max_overflow=10,
)

FrontendAsyncSessionLocal = async_sessionmaker(
    bind=frontend_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class FrontendBase(DeclarativeBase):
    pass


# FastAPI dependency that yields an async DB session for the frontend database.
# Automatically commits on success, rolls back on error, and always closes the session.
async def get_frontend_db() -> AsyncSession:
    """FastAPI dependency — yields a frontend DB session per request."""
    async with FrontendAsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
