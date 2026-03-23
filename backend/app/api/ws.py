import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.ws_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    실시간 카메라 상태 수신 WebSocket.

    클라이언트 연결 즉시 현재 전체 상태 스냅샷을 전송하고,
    이후 변경 발생 시마다 개별 이벤트를 푸시합니다.

    메시지 포맷:
      { type: "status_update", camera_id: "...", status: "online"|"offline", last_seen: "..." }
      { type: "snapshot",      cameras: [{...}] }  ← 최초 연결 시
    """
    await ws_manager.connect(websocket)
    try:
        # 최초 연결 시 현재 상태 스냅샷 전송
        from app.core.database import AsyncSessionLocal
        from app.models.camera import Camera
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Camera))
            cameras = result.scalars().all()

        snapshot = [
            {
                "id":        c.id,
                "name":      c.name,
                "status":    c.status.value,
                "enabled":   c.enabled,
                "last_seen": c.last_seen.isoformat() if c.last_seen else None,
            }
            for c in cameras
        ]
        await ws_manager.send_personal(websocket, {
            "type":    "snapshot",
            "cameras": snapshot,
        })

        # 연결 유지 (클라이언트 ping/pong)
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await ws_manager.send_personal(websocket, {"type": "pong"})

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)
