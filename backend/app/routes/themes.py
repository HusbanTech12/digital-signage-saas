from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import assert_same_org, require_roles
from app.auth.clerk import get_current_user
from app.schemas.theme import ThemeCreate, ThemeOut, ThemeUpdate
from app.services.theme_scheduler import run_scheduler_tick
from app.utils.ids import new_id
from db.models import Location, Menu, Template, Theme, User
from db.models.audio_playlist import AudioPlaylist
from db.session import get_db

router = APIRouter(prefix="/api/v1/themes", tags=["themes"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _get_org_theme_or_404(
    db: AsyncSession, user: User, theme_id: str
) -> Theme:
    theme = await db.get(Theme, theme_id)
    if theme is None or theme.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Theme not found")
    return theme


async def _validate_theme_refs(
    db: AsyncSession,
    user: User,
    *,
    menu_id: str,
    template_id: str,
    location_ids: list[str],
    kind: str,
    start_time,
    end_time,
    start_date,
    end_date,
    audio_playlist_id: str | None = None,
) -> None:
    menu = await db.get(Menu, menu_id)
    if menu is None or menu.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Menu not found")

    template = await db.get(Template, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if not template.is_global and template.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Template not found")

    if audio_playlist_id:
        playlist = await db.get(AudioPlaylist, audio_playlist_id)
        if playlist is None or playlist.organization_id != user.organization_id:
            raise HTTPException(status_code=404, detail="Audio playlist not found")

    if not location_ids:
        raise HTTPException(status_code=400, detail="Select at least one location")

    result = await db.execute(
        select(Location).where(
            Location.id.in_(location_ids),
            Location.organization_id == user.organization_id,
        )
    )
    found = {loc.id for loc in result.scalars().all()}
    missing = [lid for lid in location_ids if lid not in found]
    if missing:
        raise HTTPException(status_code=404, detail="Location not found")

    if kind == "time_of_day":
        if start_time is None or end_time is None:
            raise HTTPException(
                status_code=400,
                detail="time_of_day themes require startTime and endTime",
            )
    elif kind == "date_range":
        if start_date is None or end_date is None:
            raise HTTPException(
                status_code=400,
                detail="date_range themes require startDate and endDate",
            )
        if end_date < start_date:
            raise HTTPException(
                status_code=400, detail="endDate must be on or after startDate"
            )


@router.get("", response_model=list[ThemeOut])
async def list_themes(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Theme]:
    require_roles(user, "super_admin", "admin")
    result = await db.execute(
        select(Theme)
        .where(Theme.organization_id == user.organization_id)
        .order_by(Theme.name)
    )
    return list(result.scalars().all())


@router.post("", response_model=ThemeOut, status_code=status.HTTP_201_CREATED)
async def create_theme(
    body: ThemeCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Theme:
    require_roles(user, "super_admin", "admin")
    assert_same_org(user, body.organization_id)
    await _validate_theme_refs(
        db,
        user,
        menu_id=body.menu_id,
        template_id=body.template_id,
        location_ids=body.location_ids,
        kind=body.kind,
        start_time=body.start_time,
        end_time=body.end_time,
        start_date=body.start_date,
        end_date=body.end_date,
        audio_playlist_id=body.audio_playlist_id,
    )
    theme = Theme(
        id=new_id("theme"),
        organization_id=body.organization_id,
        name=body.name.strip(),
        kind=body.kind,
        start_time=body.start_time if body.kind == "time_of_day" else None,
        end_time=body.end_time if body.kind == "time_of_day" else None,
        start_date=body.start_date if body.kind == "date_range" else None,
        end_date=body.end_date if body.kind == "date_range" else None,
        menu_id=body.menu_id,
        template_id=body.template_id,
        audio_playlist_id=body.audio_playlist_id,
        location_ids=list(body.location_ids),
        enabled=body.enabled,
        created_at=_utcnow(),
    )
    db.add(theme)
    await db.commit()
    await db.refresh(theme)
    return theme


@router.post("/apply-now")
async def apply_themes_now(
    user: User = Depends(get_current_user),
) -> dict:
    """Manually run one scheduler tick (themes + offline sweep)."""
    require_roles(user, "super_admin", "admin")
    events, via_redis, stats = run_scheduler_tick()
    return {
        "ok": True,
        "publishedViaRedis": via_redis,
        "events": len(events),
        **stats,
    }


@router.get("/{theme_id}", response_model=ThemeOut)
async def get_theme(
    theme_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Theme:
    require_roles(user, "super_admin", "admin")
    return await _get_org_theme_or_404(db, user, theme_id)


@router.patch("/{theme_id}", response_model=ThemeOut)
async def update_theme(
    theme_id: str,
    body: ThemeUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Theme:
    require_roles(user, "super_admin", "admin")
    theme = await _get_org_theme_or_404(db, user, theme_id)

    kind = body.kind or theme.kind
    menu_id = body.menu_id or theme.menu_id
    template_id = body.template_id or theme.template_id
    if body.clear_audio_playlist:
        audio_playlist_id: str | None = None
    elif "audio_playlist_id" in body.model_fields_set:
        audio_playlist_id = body.audio_playlist_id
    else:
        audio_playlist_id = theme.audio_playlist_id
    location_ids = (
        body.location_ids if body.location_ids is not None else list(theme.location_ids)
    )
    start_time = body.start_time if "start_time" in body.model_fields_set else theme.start_time
    end_time = body.end_time if "end_time" in body.model_fields_set else theme.end_time
    start_date = body.start_date if "start_date" in body.model_fields_set else theme.start_date
    end_date = body.end_date if "end_date" in body.model_fields_set else theme.end_date

    await _validate_theme_refs(
        db,
        user,
        menu_id=menu_id,
        template_id=template_id,
        location_ids=location_ids,
        kind=kind,
        start_time=start_time,
        end_time=end_time,
        start_date=start_date,
        end_date=end_date,
        audio_playlist_id=audio_playlist_id,
    )

    if body.name is not None:
        theme.name = body.name.strip()
    theme.kind = kind
    theme.menu_id = menu_id
    theme.template_id = template_id
    theme.audio_playlist_id = audio_playlist_id
    theme.location_ids = location_ids
    if body.enabled is not None:
        theme.enabled = body.enabled

    if kind == "time_of_day":
        theme.start_time = start_time
        theme.end_time = end_time
        theme.start_date = None
        theme.end_date = None
    else:
        theme.start_date = start_date
        theme.end_date = end_date
        theme.start_time = None
        theme.end_time = None

    await db.commit()
    await db.refresh(theme)
    return theme


@router.delete("/{theme_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_theme(
    theme_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    require_roles(user, "super_admin", "admin")
    theme = await _get_org_theme_or_404(db, user, theme_id)
    await db.delete(theme)
    await db.commit()
