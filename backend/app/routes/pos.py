from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import assert_same_org
from app.auth.clerk import get_current_user
from app.auth.permissions import POS_CONFIGURE, POS_READ, require_permission
from app.config import get_settings
from app.schemas.pos import (
    PosCatalogItemOut,
    PosCatalogOut,
    PosCloverVerificationOut,
    PosIntegrationCreate,
    PosIntegrationOut,
    PosIntegrationUpdate,
    PosOAuthStartOut,
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
from app.services.pos.base import POSAdapter, get_adapter
from app.services.pos.oauth import decode_oauth_state, encode_oauth_state
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
        oauth_connected=bool(creds.get("accessToken")),
        merchant_id=str(creds["merchantId"]) if creds.get("merchantId") else None,
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
    return a == b


def _require_adapter(provider: str) -> POSAdapter:
    try:
        return get_adapter(provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


_clover_verification_code: str | None = None


def _store_clover_verification(payload: dict[str, Any]) -> str | None:
    global _clover_verification_code
    code = payload.get("verificationCode") or payload.get("verification_code")
    if isinstance(code, str) and code.strip():
        _clover_verification_code = code.strip()
        return _clover_verification_code
    return None


def _verify_webhook_secret(
    integration: PosIntegration,
    *,
    authorization: str | None,
    x_pos_signature: str | None,
    x_clover_auth: str | None = None,
) -> None:
    adapter = _require_adapter(integration.provider)
    creds = integration.credentials if isinstance(integration.credentials, dict) else {}
    adapter.verify_webhook(
        credentials=creds,
        authorization=authorization,
        x_pos_signature=x_pos_signature,
        x_clover_auth=x_clover_auth,
    )


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
    require_permission(user, POS_READ)
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
    require_permission(user, POS_CONFIGURE)
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
    require_permission(user, POS_CONFIGURE)
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
    require_permission(user, POS_CONFIGURE)
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
    require_permission(user, POS_READ)
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
    require_permission(user, POS_READ)
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
    require_permission(user, POS_CONFIGURE)
    row = await _get_org_integration(db, user, integration_id)
    if row.status == "inactive":
        raise HTTPException(status_code=400, detail="Integration is inactive")
    return await _accept_and_process(
        db,
        integration=row,
        payload={"updates": body.updates},
        event_type="simulate",
    )


@router.get(
    "/integrations/{integration_id}/oauth/start",
    response_model=PosOAuthStartOut,
)
async def start_pos_oauth(
    integration_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PosOAuthStartOut:
    require_permission(user, POS_CONFIGURE)
    row = await _get_org_integration(db, user, integration_id)
    adapter = _require_adapter(row.provider)
    if not adapter.supports_oauth:
        raise HTTPException(
            status_code=400,
            detail=f"{row.provider} does not use OAuth",
        )
    settings = get_settings()
    redirect_uri = f"{settings.public_api_origin}/api/v1/pos/oauth/{row.provider}/callback"
    state = encode_oauth_state(row.id)
    return PosOAuthStartOut(
        authorize_url=adapter.authorize_url(redirect_uri=redirect_uri, state=state),
        provider=row.provider,
    )


@router.get("/oauth/clover/callback")
async def clover_oauth_callback(
    db: AsyncSession = Depends(get_db),
    code: str | None = None,
    state: str | None = None,
    merchant_id: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    settings = get_settings()
    frontend = settings.public_frontend_origin
    if error:
        return RedirectResponse(f"{frontend}/dashboard/settings?clover=error")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing OAuth code or state")
    try:
        integration_id = decode_oauth_state(state)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    row = await db.get(PosIntegration, integration_id)
    if row is None or row.provider != "clover":
        raise HTTPException(status_code=404, detail="Clover integration not found")
    adapter = _require_adapter("clover")
    tokens = await adapter.exchange_code(code=code, merchant_id=merchant_id)
    creds = dict(row.credentials) if isinstance(row.credentials, dict) else {}
    creds.update({k: v for k, v in tokens.items() if v})
    row.credentials = creds
    if row.status == "inactive":
        row.status = "active"
    await db.commit()
    return RedirectResponse(f"{frontend}/dashboard/settings?clover=connected")


@router.get(
    "/integrations/{integration_id}/catalog",
    response_model=PosCatalogOut,
)
async def get_pos_catalog(
    integration_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PosCatalogOut:
    require_permission(user, POS_CONFIGURE)
    row = await _get_org_integration(db, user, integration_id)
    adapter = _require_adapter(row.provider)
    creds = row.credentials if isinstance(row.credentials, dict) else {}
    config = row.config if isinstance(row.config, dict) else {}
    items = await adapter.fetch_catalog(creds, config)
    return PosCatalogOut(
        items=[
            PosCatalogItemOut(
                external_sku=item.external_sku,
                name=item.name,
                price=item.price,
                available=item.available,
                external_id=item.external_id,
            )
            for item in items
        ],
        oauth_connected=bool(creds.get("accessToken")),
    )


@router.get("/clover/verification-code", response_model=PosCloverVerificationOut)
async def get_clover_verification_code(
    user: User = Depends(get_current_user),
) -> PosCloverVerificationOut:
    require_permission(user, POS_CONFIGURE)
    return PosCloverVerificationOut(verification_code=_clover_verification_code)


@webhook_router.post(
    "/clover",
    response_model=PosWebhookAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def clover_app_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_pos_signature: str | None = Header(default=None, alias="X-Pos-Signature"),
    x_clover_auth: str | None = Header(default=None, alias="X-Clover-Auth"),
) -> PosWebhookAccepted:
    try:
        payload: Any = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid JSON body") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook body must be an object")
    if _store_clover_verification(payload):
        return PosWebhookAccepted(
            accepted=True,
            event_id="verification",
            queued=False,
            inline=False,
        )
    merchants = payload.get("merchants")
    if not isinstance(merchants, dict) or not merchants:
        raise HTTPException(status_code=400, detail="Clover webhook missing merchants")
    last: PosWebhookAccepted | None = None
    for merchant_id in merchants:
        result = await db.execute(
            select(PosIntegration).where(
                PosIntegration.provider == "clover",
                PosIntegration.status != "inactive",
            )
        )
        match = None
        for row in result.scalars().all():
            creds = row.credentials if isinstance(row.credentials, dict) else {}
            if str(creds.get("merchantId") or "") == str(merchant_id):
                match = row
                break
        if match is None:
            continue
        _verify_webhook_secret(
            match,
            authorization=authorization,
            x_pos_signature=x_pos_signature,
            x_clover_auth=x_clover_auth,
        )
        last = await _accept_and_process(
            db,
            integration=match,
            payload=payload,
            event_type="webhook_raw",
        )
    if last is None:
        raise HTTPException(
            status_code=404,
            detail="No Clover integration matched this merchant",
        )
    return last


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
    x_clover_auth: str | None = Header(default=None, alias="X-Clover-Auth"),
) -> PosWebhookAccepted:
    try:
        payload: Any = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid JSON body") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook body must be an object")

    if provider.lower() == "clover" and _store_clover_verification(payload):
        return PosWebhookAccepted(
            accepted=True,
            event_id="verification",
            queued=False,
            inline=False,
        )

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
        x_clover_auth=x_clover_auth,
    )
    return await _accept_and_process(
        db,
        integration=integration,
        payload=payload,
        event_type="webhook_raw",
    )
