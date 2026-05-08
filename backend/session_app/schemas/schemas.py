import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, field_validator


# ------------------------------------------------------------------
# Auth
# ------------------------------------------------------------------
# Request body for user registration, containing username, email, and password.
# Validates that the password is at least 8 characters before accepting the input.
class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

    # Validates that the submitted password meets the minimum length requirement.
    # Raises a ValueError if the password is shorter than 8 characters.
    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

# Request body for user login, accepting an email and password.
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ------------------------------------------------------------------
# User
# ------------------------------------------------------------------
# Response schema for returning public user details.
# Reads directly from ORM attributes via from_attributes.
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
# Response schema for a single session, including status, IP, and timestamps.
# Coerces Postgres INET types to plain strings for JSON serialisation.
class SessionResponse(BaseModel):
    session_id: uuid.UUID
    user_id: uuid.UUID
    status_name: str
    ip_address: str | None
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime

    model_config = {"from_attributes": True}

    # Coerces Postgres INET values (IPv4Address/IPv6Address) to plain strings.
    # Returns None if no IP address is present.
    @field_validator("ip_address", mode="before")
    @classmethod
    def coerce_ip(cls, v: Any) -> str | None:
        """Postgres INET comes back as IPv4Address/IPv6Address — coerce to str."""
        if v is None:
            return None
        return str(v)

# Response schema for listing a user's active sessions with a total count.
class ActiveSessionsResponse(BaseModel):
    sessions: list[SessionResponse]
    total: int


# ------------------------------------------------------------------
# Generic
# ------------------------------------------------------------------
# Generic response schema for returning a plain message string.
class MessageResponse(BaseModel):
    message: str

# Generic response schema for returning an error detail string.
class ErrorResponse(BaseModel):
    detail: str

# ------------------------------------------------------------------
# NodeType
# ------------------------------------------------------------------
# Response schema for a single node type returned by GET /node-types.
# Maps directly from the NodeType ORM model via from_attributes.
class NodeTypeResponse(BaseModel):
    id: str
    type: str
    name: str
    description: str
    icon: str
    sort_order: int

    model_config = {"from_attributes": True}
