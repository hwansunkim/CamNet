import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.config import settings
from app.core.ws_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(default=""),
):
    """
    실시간 카메라 상태 수신 WebSocket.

    클라이언트 연결 즉시 현재 전체 상태 스냅샷을 전송하고,
    이후 변경 발생 시마다 개별 이벤트를 푸시합니다.

    메시지 포맷:
      { type: "status_update", camera_id: "...", status: "online"|"offline", last_seen: "..." }
      { type: "snapshot",      cameras: [{...}] }  ← 최초 연결 시
    """
    # WS_TOKEN이 설정된 경우에만 토큰 검증 (미설정 시 사내망 무인증 허용)
    if settings.WS_TOKEN and token != settings.WS_TOKEN:
        await websocket.close(code=4401, reason="Unauthorized")
        logger.warning(f"WS rejected — invalid token from {websocket.client}")
        return

    connected = False
    try:
        await ws_manager.connect(websocket)
        connected = True

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
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if connected:
            ws_manager.disconnect(websocket)
