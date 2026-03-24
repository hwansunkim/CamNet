from sqlalchemy import Column, String, JSON, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class FloorMap(Base):
    __tablename__ = "floor_maps"

    id          = Column(String, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    description = Column(String, default="")
    rooms       = Column(JSON, default=list)   # JSON array of room objects
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())
