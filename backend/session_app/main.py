from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from session_app.config import settings
from session_app.db.database import engine
from session_app.models.models import Base
from session_app.routers import auth, sessions, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (use Alembic migrations in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="User Sessions API",
    description="Session-based authentication with PostgreSQL",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # update to your UI origin
    allow_credentials=True,  # required for cookies to be sent cross-origin
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(users.router)


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    return {"status": "ok", "environment": settings.environment}
