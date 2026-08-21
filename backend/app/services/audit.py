from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.ids import new_id
from db.models import AuditLog, User


async def record_audit(
    db: AsyncSession,
    *,
    organization_id: str,
    action: str,
    actor: User | None = None,
    target_user_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    entry = AuditLog(
        id=new_id("aud"),
        organization_id=organization_id,
        actor_user_id=actor.id if actor else None,
        target_user_id=target_user_id,
        action=action,
        metadata_json=metadata or {},
    )
    db.add(entry)
    return entry
