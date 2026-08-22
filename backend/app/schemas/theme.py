from datetime import date, datetime, time
from typing import Literal

from pydantic import field_serializer, field_validator

from app.schemas.common import CamelModel

ThemeKind = Literal["time_of_day", "date_range"]


def _parse_hhmm(value: object) -> time | None:
    if value is None:
        return None
    if isinstance(value, time):
        return value.replace(second=0, microsecond=0)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        parts = text.split(":")
        if len(parts) < 2:
            raise ValueError("Time must be HH:mm")
        hour = int(parts[0])
        minute = int(parts[1])
        return time(hour=hour, minute=minute)
    raise ValueError("Invalid time")


class ThemeOut(CamelModel):
    id: str
    organization_id: str
    name: str
    kind: str
    start_time: time | None
    end_time: time | None
    start_date: date | None
    end_date: date | None
    menu_id: str
    template_id: str
    audio_playlist_id: str | None = None
    location_ids: list[str]
    enabled: bool
    created_at: datetime

    @field_serializer("start_time", "end_time")
    def _ser_time(self, value: time | None) -> str | None:
        if value is None:
            return None
        return value.strftime("%H:%M")

    @field_serializer("start_date", "end_date")
    def _ser_date(self, value: date | None) -> str | None:
        if value is None:
            return None
        return value.isoformat()


class ThemeCreate(CamelModel):
    organization_id: str
    name: str
    kind: ThemeKind
    start_time: time | None = None
    end_time: time | None = None
    start_date: date | None = None
    end_date: date | None = None
    menu_id: str
    template_id: str
    audio_playlist_id: str | None = None
    location_ids: list[str]
    enabled: bool = True

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def _v_time(cls, value: object) -> time | None:
        return _parse_hhmm(value)


class ThemeUpdate(CamelModel):
    name: str | None = None
    kind: ThemeKind | None = None
    start_time: time | None = None
    end_time: time | None = None
    start_date: date | None = None
    end_date: date | None = None
    menu_id: str | None = None
    template_id: str | None = None
    audio_playlist_id: str | None = None
    clear_audio_playlist: bool = False
    location_ids: list[str] | None = None
    enabled: bool | None = None

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def _v_time(cls, value: object) -> time | None:
        return _parse_hhmm(value)
