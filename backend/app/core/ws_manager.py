import json
import logging
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    WebSocket 연결 관리자.
    카메라 상태 변경 시 연결된 모든 클라이언트에 브로드캐스트.
    """

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WS connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WS disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, data: dict):
        """연결된 모든 클라이언트에 JSON 메시지 전송.

        dead 세트 패턴: 반복 중 Set을 직접 수정하면 RuntimeError가 발생하므로
        끊어진 소켓을 dead에 모아뒀다가 반복 완료 후 일괄 제거한다.
        Python asyncio는 단일 스레드(협력적 멀티태스킹)이므로 이 패턴이 안전하다.
        """
        if not self.active_connections:
            return
        message = json.dumps(data, default=str)
        dead: Set[WebSocket] = set()
        for ws in self.active_connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active_connections.discard(ws)

    async def send_personal(self, websocket: WebSocket, data: dict):
        message = json.dumps(data, default=str)
        await websocket.send_text(message)

    @property
    def connection_count(self) -> int:
        return len(self.active_connections)


# 싱글톤 — 앱 전체에서 공유
ws_manager = ConnectionManager()
