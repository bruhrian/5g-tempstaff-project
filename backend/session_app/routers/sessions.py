import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from session_app.db.database import get_db
from session_app.middleware.auth import get_current_user
from session_app.models.models import User
from session_app.schemas.schemas import ActiveSessionsResponse, MessageResponse, SessionResponse
from session_app.utils.session_service import (
    get_active_sessions,
    revoke_all_sessions,
    revoke_session,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


# ------------------------------------------------------------------
# GET /sessions  — list all active sessions for current user
# ------------------------------------------------------------------
@router.get("/", response_model=ActiveSessionsResponse)
async def list_sessions(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(lambda req=None, db=None: None),  # resolved below
) -> ActiveSessionsResponse:
    # Manually call dependency (pattern avoids circular import)
    user = await get_current_user(request, db)
    sessions = await get_active_sessions(db, user.user_id)

    return ActiveSessionsResponse(
        sessions=[
            SessionResponse(
                session_id=s.session_id,
                user_id=s.user_id,
                status_name=s.status.status_name,
                ip_address=s.ip_address,
                created_at=s.created_at,
                last_seen_at=s.last_seen_at,
                expires_at=s.expires_at,
            )
            for s in sessions
        ],
        total=len(sessions),
    )


# ------------------------------------------------------------------
# DELETE /sessions/{session_id}  — revoke a specific session
# ------------------------------------------------------------------
@router.delete("/{session_id}", response_model=MessageResponse)
async def revoke_one_session(
    session_id: uuid.UUID,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    user = await get_current_user(request, db)
    from sqlalchemy import select
    from session_app.models.models import Session

    # Verify the session belongs to the current user
    result = await db.execute(
        select(Session).where(
            Session.session_id == session_id,
            Session.user_id == user.user_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    revoked = await revoke_session(db, session_id, request)
    if not revoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or already revoked",
        )

    # If the user just revoked their own current session, clear their cookie
    current_raw = request.cookies.get("session_id")
    if current_raw and str(session_id) == current_raw:
        response.delete_cookie(key="session_id")

    return MessageResponse(message="Session revoked")


# ------------------------------------------------------------------
# DELETE /sessions  — revoke ALL other sessions (keep current)
# ------------------------------------------------------------------
@router.delete("/", response_model=MessageResponse)
async def revoke_all_other_sessions(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    user = await get_current_user(request, db)
    current_raw = request.cookies.get("session_id")
    current_id = uuid.UUID(current_raw) if current_raw else None

    count = await revoke_all_sessions(
        db, user.user_id, request, exclude_session_id=current_id
    )
    return MessageResponse(message=f"Revoked {count} session(s)")
