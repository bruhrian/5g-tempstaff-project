import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from session_app.config import settings
from session_app.models.models import Session, SessionEvent, SessionStatus, User


def _utcnow() -> datetime:
    """Always returns timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


async def _get_status_id(db: AsyncSession, name: str) -> int:
    result = await db.execute(
        select(SessionStatus.status_id).where(SessionStatus.status_name == name)
    )
    status_id = result.scalar_one_or_none()
    if status_id is None:
        raise RuntimeError(f"Session status '{name}' not found in DB")
    return status_id


async def _log_event(
    db: AsyncSession,
    session_id: uuid.UUID,
    event_type: str,
    request: Request | None = None,
    metadata: dict | None = None,
) -> None:
    ip = request.client.host if request and request.client else None
    ua = request.headers.get("user-agent") if request else None
    event = SessionEvent(
        session_id=session_id,
        event_type=event_type,
        ip_address=ip,
        user_agent=ua,
        event_metadata=metadata,
    )
    db.add(event)


def _make_aware(dt: datetime) -> datetime:
    """Ensure a datetime is timezone-aware (assume UTC if naive)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ------------------------------------------------------------------
# Create session
# ------------------------------------------------------------------
async def create_session(
    db: AsyncSession,
    user: User,
    request: Request,
) -> Session:
    active_status_id = await _get_status_id(db, "active")
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    session = Session(
        user_id=user.user_id,
        status_id=active_status_id,
        ip_address=ip,
        user_agent=ua,
        expires_at=_utcnow() + timedelta(minutes=settings.session_expire_minutes),
    )
    db.add(session)
    await db.flush()

    await _log_event(db, session.session_id, "login", request)
    return session


# ------------------------------------------------------------------
# Validate session (used on every protected request)
# ------------------------------------------------------------------
async def validate_session(
    db: AsyncSession,
    session_id: uuid.UUID,
    request: Request,
) -> Session | None:
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.user).selectinload(User.role), selectinload(Session.status))
        .where(Session.session_id == session_id)
    )
    session = result.scalar_one_or_none()

    if session is None:
        return None

    if session.status.status_name != "active":
        return None

    # Normalise expires_at to aware before comparing
    expires_at = _make_aware(session.expires_at)
    if expires_at < _utcnow():
        expired_status_id = await _get_status_id(db, "expired")
        await db.execute(
            update(Session)
            .where(Session.session_id == session_id)
            .values(status_id=expired_status_id)
        )
        await _log_event(db, session_id, "expired", request)
        return None

    # Slide expiry window + update last_seen
    await db.execute(
        update(Session)
        .where(Session.session_id == session_id)
        .values(
            last_seen_at=_utcnow(),
            expires_at=_utcnow() + timedelta(minutes=settings.session_expire_minutes),
        )
    )
    return session


# ------------------------------------------------------------------
# Revoke a single session (logout)
# ------------------------------------------------------------------
async def revoke_session(
    db: AsyncSession,
    session_id: uuid.UUID,
    request: Request,
) -> bool:
    result = await db.execute(
        select(Session).where(Session.session_id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        return False

    revoked_status_id = await _get_status_id(db, "revoked")
    await db.execute(
        update(Session)
        .where(Session.session_id == session_id)
        .values(status_id=revoked_status_id)
    )
    await _log_event(db, session_id, "logout", request)
    return True


# ------------------------------------------------------------------
# Revoke all sessions for a user (e.g. password change, forced logout)
# ------------------------------------------------------------------
async def revoke_all_sessions(
    db: AsyncSession,
    user_id: uuid.UUID,
    request: Request,
    exclude_session_id: uuid.UUID | None = None,
) -> int:
    active_status_id = await _get_status_id(db, "active")
    revoked_status_id = await _get_status_id(db, "revoked")

    query = select(Session).where(
        Session.user_id == user_id,
        Session.status_id == active_status_id,
    )
    if exclude_session_id:
        query = query.where(Session.session_id != exclude_session_id)

    result = await db.execute(query)
    sessions = result.scalars().all()

    for session in sessions:
        await db.execute(
            update(Session)
            .where(Session.session_id == session.session_id)
            .values(status_id=revoked_status_id)
        )
        await _log_event(db, session.session_id, "forced_revoke", request)

    return len(sessions)


# ------------------------------------------------------------------
# List active sessions for a user
# ------------------------------------------------------------------
async def get_active_sessions(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[Session]:
    active_status_id = await _get_status_id(db, "active")
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.status))
        .where(
            Session.user_id == user_id,
            Session.status_id == active_status_id,
            Session.expires_at > _utcnow(),
        )
        .order_by(Session.last_seen_at.desc())
    )
    return result.scalars().all()