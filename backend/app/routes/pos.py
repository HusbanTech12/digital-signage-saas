from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import assert_same_org, require_roles
from app.auth.clerk import get_current_user
from app.schemas.pos import (
    PosIntegrationCreate,
    PosIntegrationOut,
    PosIntegrationUpdate,
    PosSimulateIn,
    PosSyncEventOut,
    PosSyncStatusOut,
    PosWebhookAccepted,
)
from app.services.pos.apply import (
    dispatch_pos_event,
    enqueue_pos_raw_event_async,
    process_pos_sync_event_async,
)
from app.utils.ids import new_id
from db.models import Location, PosIntegration, PosSyncEvent, User
from db.session import get_db

router = APIRouter(prefix="/api/v1/pos", tags=["pos"])
webhook_router = APIRouter(prefix="/api/v1/webhooks/pos", tags=["pos-webhooks"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _latest_event(
    db: AsyncSession, integration_id: str
) -> PosSyncEvent | None:
    result = await db.execute(
        select(PosSyncEvent)
        .where(PosSyncEvent.integration_id == integration_id)
        .order_by(desc(PosSyncEvent.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _to_out(db: AsyncSession, row: PosIntegration) -> PosIntegrationOut:
    latest = await _latest_event(db, row.id)
    last_sync = None
    last_error = None
    if latest is not None:
        last_sync = latest.created_at
        if latest.status == "failed":
            last_error = latest.error_message
    creds = row.credentials if isinstance(row.credentials, dict) else {}
    return PosIntegrationOut(
        id=row.id,
        location_id=row.location_id,
        organization_id=row.organization_id,
        provider=row.provider,
        status=row.status,
        config=row.config if isinstance(row.config, dict) else {},
        has_credentials=bool(creds),
        last_sync_at=last_sync,
        last_error=last_error,
        created_at=row.created_at,
    )


async def _get_org_integration(
    db: AsyncSession, user: User, integration_id: str
) -> PosIntegration:
    row = await db.get(PosIntegration, integration_id)
    if row is None or row.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="POS integration not found")
    return row


def _provider_matches(url_provider: str, integration_provider: str) -> bool:
    a = url_provider.lower().replace("-", "_")
    b = integration_provider.lower().replace("-", "_")
    if a == b:
        return True
    # Square webhook URL may target clear_mock demo integrations
    return a == "square" and b in {"square", "clear_mock"}


def _verify_webhook_secret(
    integration: PosIntegration,
    *,
    authorization: str | None,
    x_pos_signature: str | None,
) -> None:
    creds = integration.credentials if isinstance(integration.credentials, dict) else {}
    secret = creds.get("webhookSecret") or creds.get("webhook_secret")
    if not secret:
        return
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if x_pos_signature:
        token = x_pos_signature.strip()
    if token != str(secret):
        raise HTTPException(status_code=401, detail="Invalid POS webhook secret")


async def _accept_and_process(
    db: AsyncSession,
    *,
    integration: PosIntegration,
    payload: dict[str, Any],
    event_type: str,
) -> PosWebhookAccepted:
    event = await enqueue_pos_raw_event_async(
        db,
        integration=integration,
        raw_payload=payload,
        event_type=event_type,
    )
    dispatch = dispatch_pos_event(event.id)
    if dispatch.get("queued"):
        return PosWebhookAccepted(
            accepted=True,
            event_id=event.id,
            queued=True,
            inline=False,
        )

    # Inline async apply (works without Celery / psycopg)
    result = await process_pos_sync_event_async(db, event.id)
    return PosWebhookAccepted(
        accepted=True,
        event_id=event.id,
        queued=False,
        inline=True,
    ) if result.get("ok") else PosWebhookAccepted(
        accepted=True,
        event_id=event.id,
        queued=False,
        inline=True,
    )


@router.get("/integrations", response_model=list[PosIntegrationOut])
async def list_integrations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PosIntegrationOut]:
    require_roles(user, "super_admin", "admin")
    result = await db.execute(
        select(PosIntegration)
        .where(PosIntegration.organization_id == user.organization_id)
        .order_by(PosIntegration.created_at.desc())
    )
    rows = list(result.scalars().all())
    return [await _to_out(db, row) for row in rows]


@router.post(
    "/integrations",
    response_model=PosIntegrationOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_integration(
    body: PosIntegrationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PosIntegrationOut:
    require_roles(user, "super_admin", "admin")
    assert_same_org(user, body.organization_id)
    loc = await db.get(Location, body.location_id)
    if loc is None or loc.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Location not found")

    row = PosIntegration(
        id=new_id("pos"),
        location_id=body.location_id,
        organization_id=body.organization_id,
        provider=body.provider,
        credentials=dict(body.credentials or {}),
        config=dict(body.config or {}),
        status=body.status,
        created_at=_utcnow(),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return await _to_out(db, row)


@router.patch("/integrations/{integration_id}", response_model=PosIntegrationOut)
async def update_integration(
    integration_id: str,
    body: PosIntegrationUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PosIntegrationOut:
    require_roles(user, "super_admin", "admin")
    row = await _get_org_integration(db, user, integration_id)
    if body.credentials is not None:
        row.credentials = dict(body.credentials)
    if body.config is not None:
        row.config = dict(body.config)
    if body.status is not None:
        row.status = body.status
    await db.commit()
    await db.refresh(row)
    return await _to_out(db, row)


@router.delete(
    "/integrations/{integration_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_integration(
    integration_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    require_roles(user, "super_admin", "admin")
    row = await _get_org_integration(db, user, integration_id)
    await db.delete(row)
    await db.commit()


@router.get(
    "/integrations/{integration_id}/events",
    response_model=list[PosSyncEventOut],
)
async def list_integration_events(
    integration_id: str,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PosSyncEvent]:
    require_roles(user, "super_admin", "admin")
    await _get_org_integration(db, user, integration_id)
    result = await db.execute(
        select(PosSyncEvent)
        .where(PosSyncEvent.integration_id == integration_id)
        .order_by(desc(PosSyncEvent.created_at))
        .limit(max(1, min(limit, 200)))
    )
    return list(result.scalars().all())


@router.get("/sync-status", response_model=PosSyncStatusOut)
async def get_sync_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PosSyncStatusOut:
    require_roles(user, "super_admin", "admin", "location_manager")
    org_id = user.organization_id
    integrations = list(
        (
            await db.execute(
                select(PosIntegration).where(PosIntegration.organization_id == org_id)
            )
        )
        .scalars()
        .all()
    )
    active = sum(1 for i in integrations if i.status == "active")
    errored = sum(1 for i in integrations if i.status == "error")

    latest = (
        await db.execute(
            select(PosSyncEvent)
            .where(PosSyncEvent.organization_id == org_id)
            .order_by(desc(PosSyncEvent.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()

    since = _utcnow() - timedelta(hours=24)
    failures = await db.scalar(
        select(func.count())
        .select_from(PosSyncEvent)
        .where(
            PosSyncEvent.organization_id == org_id,
            PosSyncEvent.status == "failed",
            PosSyncEvent.created_at >= since,
        )
    )

    return PosSyncStatusOut(
        organization_id=org_id,
        integrations_active=active,
        integrations_error=errored,
        last_sync_at=latest.created_at if latest else None,
        last_event_status=latest.status if latest else None,
        recent_failures=int(failures or 0),
    )


@router.post(
    "/integrations/{integration_id}/simulate",
    response_model=PosWebhookAccepted,
)
async def simulate_pos_updates(
    integration_id: str,
    body: PosSimulateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PosWebhookAccepted:
    require_roles(user, "super_admin", "admin")
    row = await _get_org_integration(db, user, integration_id)
    if row.status == "inactive":
        raise HTTPException(status_code=400, detail="Integration is inactive")
    return await _accept_and_process(
        db,
        integration=row,
        payload={"updates": body.updates},
        event_type="simulate",
    )


@webhook_router.post(
    "/{provider}/{integration_id}",
    response_model=PosWebhookAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def pos_webhook(
    provider: str,
    integration_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_pos_signature: str | None = Header(default=None, alias="X-Pos-Signature"),
) -> PosWebhookAccepted:
    try:
        payload: Any = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid JSON body") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook body must be an object")

    integration = await db.get(PosIntegration, integration_id)
    if integration is None:
        raise HTTPException(status_code=404, detail="POS integration not found")
    if not _provider_matches(provider, integration.provider):
        raise HTTPException(status_code=404, detail="Provider mismatch")
    if integration.status == "inactive":
        raise HTTPException(status_code=400, detail="Integration is inactive")

    _verify_webhook_secret(
        integration,
        authorization=authorization,
        x_pos_signature=x_pos_signature,
    )
    return await _accept_and_process(
        db,
        integration=integration,
        payload=payload,
        event_type="webhook_raw",
    )
