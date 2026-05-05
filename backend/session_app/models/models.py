import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from session_app.db.database import Base


# Returns the current UTC time as a timezone-aware datetime.
# Used as a default factory for timestamp columns across all models.
def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Timezone-aware timestamp type — maps to TIMESTAMPTZ in Postgres
TZ = TIMESTAMP(timezone=True)


# ------------------------------------------------------------------
# Role
# ------------------------------------------------------------------
# Lookup table for user roles (e.g. admin, user).
# Linked to users via a one-to-many relationship.
class Role(Base):
    __tablename__ = "roles"

    role_id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=True)
    role_name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)

    users: Mapped[list["User"]] = relationship("User", back_populates="role")


# ------------------------------------------------------------------
# User
# ------------------------------------------------------------------
# Represents a registered user with a UUID primary key, hashed password, and role assignment.
# Tracks creation and update timestamps, and links to the user's active sessions.
class User(Base):
    __tablename__ = "users"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    role_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("roles.role_id"), nullable=False
    )
    username: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TZ, default=utcnow, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        TZ, default=utcnow, server_default=func.now(), onupdate=utcnow
    )

    role: Mapped["Role"] = relationship("Role", back_populates="users")
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="user")


# ------------------------------------------------------------------
# SessionStatus
# ------------------------------------------------------------------
# Lookup table for session states (e.g. active, expired, revoked).
# Linked to sessions via a one-to-many relationship.
class SessionStatus(Base):
    __tablename__ = "session_status"

    status_id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=True)
    status_name: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)

    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="status")


# ------------------------------------------------------------------
# Session
# ------------------------------------------------------------------
# Represents an authenticated user session, storing IP, user agent, and expiry.
# Cascades deletes from the parent user and links to its audit events.
class Session(Base):
    __tablename__ = "sessions"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    status_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("session_status.status_id"), nullable=False, default=1
    )
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TZ, default=utcnow, server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(TZ, default=utcnow, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(TZ, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="sessions")
    status: Mapped["SessionStatus"] = relationship("SessionStatus", back_populates="sessions")
    events: Mapped[list["SessionEvent"]] = relationship("SessionEvent", back_populates="session")


# ------------------------------------------------------------------
# SessionEvent
# ------------------------------------------------------------------
# Audit log of events that occurred within a session (e.g. login, logout, token refresh).
# Stores IP, user agent, and arbitrary metadata as JSONB. Cascades deletes from the parent session.
class SessionEvent(Base):
    __tablename__ = "session_events"

    event_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.session_id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(Text)
    event_metadata: Mapped[dict | None] = mapped_column(JSONB)
    occurred_at: Mapped[datetime] = mapped_column(TZ, default=utcnow, server_default=func.now())

    session: Mapped["Session"] = relationship("Session", back_populates="events")
