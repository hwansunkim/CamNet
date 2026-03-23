import uuid
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.floor_map import FloorMap

router = APIRouter(prefix="/maps", tags=["floor-maps"])


class RoomSchema(BaseModel):
    id:    str
    label: str
    x:     float
    y:     float
    w:     float
    h:     float
    color: str = "#141c28"


class FloorMapCreate(BaseModel):
    name:        str
    description: str = ""
    rooms:       List[RoomSchema] = []


class FloorMapResponse(BaseModel):
    id:          str
    name:        str
    description: str
    rooms:       List[RoomSchema]
    model_config = {"from_attributes": True}


@router.get("/", response_model=List[FloorMapResponse])
async def list_maps(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FloorMap))
    maps = result.scalars().all()
    return [
        FloorMapResponse(
            id=m.id, name=m.name, description=m.description,
            rooms=json.loads(m.rooms_json)
        )
        for m in maps
    ]


@router.post("/", response_model=FloorMapResponse)
async def create_map(payload: FloorMapCreate, db: AsyncSession = Depends(get_db)):
    fm = FloorMap(
        id=str(uuid.uuid4()),
        name=payload.name,
        description=payload.description,
        rooms_json=json.dumps([r.model_dump() for r in payload.rooms]),
    )
    db.add(fm)
    await db.commit()
    await db.refresh(fm)
    return FloorMapResponse(
        id=fm.id, name=fm.name, description=fm.description,
        rooms=json.loads(fm.rooms_json)
    )


@router.put("/{map_id}/rooms", response_model=FloorMapResponse)
async def update_rooms(
    map_id: str,
    rooms: List[RoomSchema],
    db: AsyncSession = Depends(get_db)
):
    fm = await db.get(FloorMap, map_id)
    if not fm:
        raise HTTPException(status_code=404, detail="Map not found")
    fm.rooms_json = json.dumps([r.model_dump() for r in rooms])
    await db.commit()
    await db.refresh(fm)
    return FloorMapResponse(
        id=fm.id, name=fm.name, description=fm.description,
        rooms=json.loads(fm.rooms_json)
    )
