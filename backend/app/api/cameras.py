import uuid
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.camera import Camera
from app.schemas.camera import CameraCreate, CameraUpdate, CameraResponse, PositionUpdate
from app.services.polling import polling_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cameras", tags=["cameras"])


@router.get("/", response_model=List[CameraResponse])
async def list_cameras(db: AsyncSession = Depends(get_db)):
    """등록된 카메라 전체 조회"""
    result = await db.execute(select(Camera).order_by(Camera.created_at))
    return result.scalars().all()


@router.post("/", response_model=CameraResponse, status_code=status.HTTP_201_CREATED)
async def create_camera(payload: CameraCreate, db: AsyncSession = Depends(get_db)):
    """카메라 등록"""
    cam = Camera(
        id=str(uuid.uuid4()),
        **payload.model_dump()
    )
    db.add(cam)
    await db.commit()
    await db.refresh(cam)
    logger.info(f"Camera created: {cam.name} ({cam.id})")

    # 등록 즉시 상태 체크
    try:
        await polling_service.check_single(cam.id)
        await db.refresh(cam)
    except Exception:
        pass

    return cam


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(camera_id: str, db: AsyncSession = Depends(get_db)):
    """카메라 단건 조회"""
    cam = await db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return cam


@router.patch("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    camera_id: str,
    payload: CameraUpdate,
    db: AsyncSession = Depends(get_db)
):
    """카메라 정보 수정 (부분 업데이트)"""
    cam = await db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(cam, field, value)

    await db.commit()
    await db.refresh(cam)
    return cam


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_camera(camera_id: str, db: AsyncSession = Depends(get_db)):
    """카메라 삭제"""
    cam = await db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    await db.delete(cam)
    await db.commit()
    logger.info(f"Camera deleted: {camera_id}")


@router.post("/{camera_id}/check", response_model=dict)
async def check_status(camera_id: str, db: AsyncSession = Depends(get_db)):
    """카메라 상태 즉시 체크 (폴링 주기 기다리지 않고 바로 확인)"""
    cam = await db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    try:
        new_status = await polling_service.check_single(camera_id)
        return {"camera_id": camera_id, "status": new_status.value}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{camera_id}/position", response_model=CameraResponse)
async def update_position(
    camera_id: str,
    payload: PositionUpdate,
    db: AsyncSession = Depends(get_db)
):
    """도면 위 카메라 위치 업데이트 (드래그 이벤트용)"""
    cam = await db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    cam.map_x = payload.map_x
    cam.map_y = payload.map_y
    await db.commit()
    await db.refresh(cam)
    return cam
