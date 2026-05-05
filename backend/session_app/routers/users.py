from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from session_app.db.database import get_db
from session_app.middleware.auth import get_current_user
from session_app.models.models import User
from session_app.schemas.schemas import UserResponse

router = APIRouter(prefix="/users", tags=["users"])


# ------------------------------------------------------------------
# GET /users/me  — return the currently authenticated user's profile
# ------------------------------------------------------------------
# Returns the profile of the currently authenticated user.
@router.get("/me", response_model=UserResponse)
async def get_me(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await get_current_user(request, db)
    return UserResponse(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        role_name=user.role.role_name,
        is_active=user.is_active,
        created_at=user.created_at,
    )
