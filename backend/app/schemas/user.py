from datetime import datetime

from app.schemas.common import CamelModel


class UserOut(CamelModel):
    id: str
    clerk_user_id: str
    organization_id: str
    email: str
    name: str
    role: str
    location_ids: list[str]
    created_at: datetime
