"""
PollingService 단위 테스트 (synchronous)
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock
from app.services.polling import PollingService
from app.models.camera import CameraStatus


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


class TestPollingService:

    def test_initial_state(self):
        """초기 상태: 실행 중이 아님."""
        service = PollingService()
        assert service.is_running is False
        assert service._status_cache == {}

    def test_check_camera_online(self):
        """MediaMTX API가 readyTime 반환 시 online."""
        service = PollingService()

        mock_cam = MagicMock()
        mock_cam.ip = "192.168.0.100"
        mock_cam.api_port = 9997
        mock_cam.api_username = ""
        mock_cam.api_password = ""
        mock_cam.path = "cam"
        mock_cam.port = 8889
        mock_cam.name = "test_cam"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"readyTime": "2024-01-01T00:00:00Z"}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        status, last_seen = _run_async(service._check_camera(mock_client, mock_cam))
        assert status == CameraStatus.online
        assert last_seen is not None

    def test_check_camera_offline_no_readytime(self):
        """readyTime이 없으면 offline."""
        service = PollingService()

        mock_cam = MagicMock()
        mock_cam.ip = "192.168.0.100"
        mock_cam.api_port = 9997
        mock_cam.api_username = ""
        mock_cam.api_password = ""
        mock_cam.path = "cam"
        mock_cam.port = 8889
        mock_cam.name = "test_cam"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        status, last_seen = _run_async(service._check_camera(mock_client, mock_cam))
        assert status == CameraStatus.offline
        assert last_seen is None

    def test_check_camera_connection_error(self):
        """연결 실패 시 offline (WebRTC fallback도 실패)."""
        import httpx
        service = PollingService()

        mock_cam = MagicMock()
        mock_cam.ip = "192.168.0.100"
        mock_cam.api_port = 9997
        mock_cam.api_username = ""
        mock_cam.api_password = ""
        mock_cam.path = "cam"
        mock_cam.port = 8889
        mock_cam.name = "test_cam"

        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.ConnectError("Connection refused")

        status, last_seen = _run_async(service._check_camera(mock_client, mock_cam))
        assert status == CameraStatus.offline
        assert last_seen is None

    def test_status_cache(self):
        """상태 캐시가 정상적으로 초기화되는지 확인."""
        service = PollingService()
        service._status_cache["cam1"] = CameraStatus.online
        assert service._status_cache["cam1"] == CameraStatus.online
