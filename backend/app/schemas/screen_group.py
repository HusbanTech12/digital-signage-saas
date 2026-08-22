from datetime import datetime
from typing import Literal

from app.schemas.common import CamelModel

ScreenGroupLayout = Literal["2x2", "3x3", "4x4", "custom"]
ScreenGroupContentMode = Literal["shared", "tiled"]


class ScreenGroupMemberIn(CamelModel):
    screen_id: str
    row_index: int
    col_index: int


class ScreenGroupMemberOut(CamelModel):
    id: str
    screen_group_id: str
    screen_id: str
    organization_id: str
    row_index: int
    col_index: int
    screen_name: str | None = None
    screen_status: str | None = None
    last_heartbeat: datetime | None = None
    created_at: datetime


class ScreenGroupCreate(CamelModel):
    name: str
    location_id: str
    layout: ScreenGroupLayout = "2x2"
    rows: int | None = None
    cols: int | None = None
    content_mode: ScreenGroupContentMode = "shared"
    bezel_compensation_pct: float = 0.0


class ScreenGroupUpdate(CamelModel):
    name: str | None = None
    layout: ScreenGroupLayout | None = None
    rows: int | None = None
    cols: int | None = None
    content_mode: ScreenGroupContentMode | None = None
    bezel_compensation_pct: float | None = None
    active_menu_id: str | None = None
    active_template_id: str | None = None
    active_playlist_id: str | None = None


class ScreenGroupMembersReplace(CamelModel):
    members: list[ScreenGroupMemberIn]


class ScreenGroupPublishIn(CamelModel):
    playlist_id: str | None = None
    menu_id: str | None = None
    template_id: str | None = None
    content_mode: ScreenGroupContentMode | None = None


class ScreenGroupOut(CamelModel):
    id: str
    organization_id: str
    location_id: str
    name: str
    layout: str
    rows: int
    cols: int
    content_mode: str
    active_menu_id: str | None = None
    active_template_id: str | None = None
    active_playlist_id: str | None = None
    sync_epoch_ms: int | None = None
    bezel_compensation_pct: float = 0.0
    members: list[ScreenGroupMemberOut] = []
    online_member_count: int = 0
    member_count: int = 0
    created_at: datetime
    updated_at: datetime


class ScreenGroupListOut(CamelModel):
    screen_groups: list[ScreenGroupOut]
    total: int


class ScreenGroupSyncOut(CamelModel):
    screen_group_id: str
    sync_epoch_ms: int
    member_count: int
