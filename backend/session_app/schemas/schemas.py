import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, field_validator


# ------------------------------------------------------------------
# Auth
# ------------------------------------------------------------------
class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ------------------------------------------------------------------
# User
# ------------------------------------------------------------------
class UserResponse(BaseModel):
    user_id: uuid.UUID
    username: str
    email: str
    role_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ------------------------------------------------------------------
# Session
# ------------------------------------------------------------------
class SessionResponse(BaseModel):
    session_id: uuid.UUID
    user_id: uuid.UUID
    status_name: str
    ip_address: str | None
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("ip_address", mode="before")
    @classmethod
    def coerce_ip(cls, v: Any) -> str | None:
        """Postgres INET comes back as IPv4Address/IPv6Address — coerce to str."""
        if v is None:
            return None
        return str(v)


class ActiveSessionsResponse(BaseModel):
    sessions: list[SessionResponse]
    total: int


# ------------------------------------------------------------------
# Generic
# ------------------------------------------------------------------
class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    detail: str