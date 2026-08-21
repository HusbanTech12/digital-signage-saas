from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    locations = relationship("Location", back_populates="organization")
    users = relationship("User", back_populates="organization")
    menus = relationship("Menu", back_populates="organization")
    themes = relationship("Theme", back_populates="organization")
    invitations = relationship("Invitation", back_populates="organization")
    subscription = relationship(
        "Subscription", back_populates="organization", uselist=False
    )
