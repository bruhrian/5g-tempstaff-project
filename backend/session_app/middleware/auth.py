import uuid
from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from session_app.config import settings
from session_app.models.models import User
from session_app.utils.session_service import validate_session

# Reads the session cookie, validates it against the database, and returns the authenticated user.
# Raises 401 if the cookie is missing, malformed, expired, or revoked.
async def get_current_user(request: Request, db: AsyncSession) -> User:
    raw = request.cookies.get(settings.session_cookie_name)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    try:
        session_id = uuid.UUID(raw)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token",
        )

    session = await validate_session(db, session_id, request)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or revoked",
        )

    return session.user


# Extends get_current_user by additionally asserting that the authenticated user holds the admin role.
# Raises 403 if the user is authenticated but lacks admin privileges.
async def require_admin(request: Request, db: AsyncSession) -> User:
    user = await get_current_user(request, db)
    if user.role.role_name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
