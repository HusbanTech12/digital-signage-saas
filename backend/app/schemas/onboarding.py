from app.schemas.common import CamelModel
from app.schemas.organization import OrganizationOut
from app.schemas.user import UserOut


class OnboardOut(CamelModel):
    user: UserOut
    organization: OrganizationOut
    created: bool
