"""
WebSocket 엔드포인트 및 Health 테스트 (synchronous TestClient)
"""
from app.core.database import get_db
from tests.conftest import override_get_db
from app.main import app


class TestWebSocket:

    def test_websocket_connect_and_snapshot(self, client):
        """WebSocket 연결 시 snapshot 메시지 수신."""
        with client.websocket_connect("/ws") as ws:
            data = ws.receive_json()
            assert data["type"] == "snapshot"
            assert "cameras" in data
            assert isinstance(data["cameras"], list)

    def test_websocket_ping_pong(self, client):
        """ping 메시지에 pong 응답."""
        with client.websocket_connect("/ws") as ws:
            # 최초 snapshot 수신
            ws.receive_json()

            # ping 전송
            ws.send_text("ping")
            pong = ws.receive_json()
            assert pong["type"] == "pong"


class TestHealthEndpoint:

    def test_health(self, client):
        """Health 엔드포인트 기본 동작."""
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "polling_active" in data
