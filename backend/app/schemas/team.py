from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class TeamMemberOut(CamelModel):
    kind: str = "member"
    id: str
    clerk_user_id: str
    organization_id: str
    email: str
    name: str
    role: str
    location_ids: list[str]
    status: str
    last_active_at: datetime | None = None
    created_at: datetime
    invitation_status: str | None = None


class InvitationOut(CamelModel):
    kind: str = "invitation"
    id: str
    organization_id: str
    email: str
    name: str
    role: str
    location_ids: list[str]
    status: str
    message: str | None = None
    invited_by_user_id: str | None = None
    expires_at: datetime
    created_at: datetime
    # Never includes token


class InviteCreate(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=320)
    role: str
    location_ids: list[str] = Field(default_factory=list)
    message: str | None = Field(default=None, max_length=2000)


class InviteCreateResult(CamelModel):
    invitation: InvitationOut
    email_sent: bool
    # Only returned to the inviter so they can share manually when email is off
    invite_url: str | None = None


class InvitationPreviewOut(CamelModel):
    organization_id: str
    organization_name: str
    email: str
    name: str
    role: str
    role_label: str
    location_ids: list[str]
    location_names: list[str]
    expires_at: datetime
    status: str
    message: str | None = None
    valid: bool
    error: str | None = None


class AcceptInvitationIn(CamelModel):
    token: str = Field(min_length=16, max_length=256)


class MemberRoleUpdate(CamelModel):
    role: str


class MemberLocationsUpdate(CamelModel):
    location_ids: list[str]


class OwnershipTransferIn(CamelModel):
    new_owner_user_id: str


class TeamListOut(CamelModel):
    members: list[TeamMemberOut]
    invitations: list[InvitationOut]
