from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from session_app.config import settings
from session_app.db.database import get_db
from session_app.models.models import Role, User
from session_app.schemas.schemas import LoginRequest, MessageResponse, RegisterRequest, UserResponse
from session_app.utils.security import hash_password, verify_password
from session_app.utils.session_service import create_session, revoke_session

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_OPTS = {
    "key": settings.session_cookie_name,
    "httponly": True,
    "samesite": "lax",
    "secure": settings.environment == "production",
}


# ------------------------------------------------------------------
# POST /auth/register
# ------------------------------------------------------------------
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> UserResponse:
    # Check for duplicates
    existing = await db.execute(
        select(User).where(
            (User.email == body.email) | (User.username == body.username)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username already registered",
        )

    # Default to 'member' role
    role_result = await db.execute(select(Role).where(Role.role_name == "member"))
    role = role_result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=500, detail="Default role not seeded")

    user = User(
        role_id=role.role_id,
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()

    # Reload with role relationship for response
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.user_id == user.user_id)
    )
    user = result.scalar_one()

    return UserResponse(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        role_name=user.role.role_name,
        is_active=user.is_active,
        created_at=user.created_at,
    )


# ------------------------------------------------------------------
# POST /auth/login
# ------------------------------------------------------------------
@router.post("/login", response_model=UserResponse)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.email == body.email)
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    session = await create_session(db, user, request)

    response.set_cookie(
        **_COOKIE_OPTS,
        value=str(session.session_id),
        max_age=settings.session_expire_minutes * 60,
    )

    return UserResponse(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        role_name=user.role.role_name,
        is_active=user.is_active,
        created_at=user.created_at,
    )


# ------------------------------------------------------------------
# POST /auth/logout
# ------------------------------------------------------------------
@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    import uuid

    raw = request.cookies.get(settings.session_cookie_name)
    if raw:
        try:
            await revoke_session(db, uuid.UUID(raw), request)
        except (ValueError, Exception):
            pass  # Already invalid — still clear the cookie

    response.delete_cookie(key=settings.session_cookie_name)
    return MessageResponse(message="Logged out successfully")
