from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
 
from session_app.db.database import get_frontend_db
from session_app.models.models import NodeType
from session_app.schemas.schemas import NodeTypeResponse
 
router = APIRouter(prefix="/node-types", tags=["node-types"])


# ------------------------------------------------------------------
# GET /node-types  — return all active node types ordered by sort_order
# ------------------------------------------------------------------
# Public endpoint — no auth required so the canvas can load nodes
# even before the user profile resolves.
@router.get("", response_model=list[NodeTypeResponse])
async def get_node_types(
    db: AsyncSession = Depends(get_frontend_db),
) -> list[NodeTypeResponse]:
    result = await db.execute(
        select(NodeType)
        .where(NodeType.is_active == True)
        .order_by(NodeType.sort_order)
    )
    node_types = result.scalars().all()
    return [NodeTypeResponse.model_validate(nt) for nt in node_types]
