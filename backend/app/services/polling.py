"""
MediaMTX 상태 폴링 서비스

각 라즈베리파이의 MediaMTX REST API를 주기적으로 호출해서
카메라 online/offline 상태를 감지하고 WebSocket으로 프론트에 푸시합니다.

MediaMTX REST API 엔드포인트:
  GET /v3/paths/list          → 전체 경로 목록
  GET /v3/paths/get/{name}    → 특정 경로 상세 (readyTime 있으면 스트리밍 중)
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.ws_manager import ws_manager
from app.models.camera import Camera, CameraStatus

logger = logging.getLogger(__name__)


class PollingService:
    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        # 이전 상태 캐시 — 변경이 있을 때만 브로드캐스트
        self._status_cache: Dict[str, CameraStatus] = {}

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    async def start(self):
        logger.info(f"MediaMTX polling started (interval: {settings.POLL_INTERVAL}s)")
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self):
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("MediaMTX polling stopped")

    async def _poll_loop(self):
        while True:
            try:
                await self._poll_all_cameras()
            except Exception as e:
                logger.error(f"Polling error: {e}")
            await asyncio.sleep(settings.POLL_INTERVAL)

    async def _poll_all_cameras(self):
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Camera).where(Camera.enabled == True)
            )
            cameras = result.scalars().all()

            if not cameras:
                return

            # 모든 카메라를 동시에 체크 (병렬)
            async with httpx.AsyncClient(timeout=5.0) as client:
                tasks = [self._check_camera(client, cam) for cam in cameras]
                results = await asyncio.gather(*tasks, return_exceptions=True)

            # DB 업데이트 및 변경 브로드캐스트 (같은 세션 내에서)
            for cam, check_result in zip(cameras, results):
                if isinstance(check_result, Exception):
                    new_status = CameraStatus.offline
                    last_seen = None
                else:
                    new_status, last_seen = check_result

                prev_status = self._status_cache.get(cam.id)

                # DB 업데이트 (동일 세션의 객체이므로 안전)
                cam.status = new_status
                if last_seen:
                    cam.last_seen = last_seen

                # 상태가 바뀐 경우에만 WebSocket 브로드캐스트
                if prev_status != new_status:
                    self._status_cache[cam.id] = new_status
                    await ws_manager.broadcast({
                        "type":      "status_update",
                        "camera_id": cam.id,
                        "status":    new_status.value,
                        "last_seen": last_seen.isoformat() if last_seen else None,
                    })
                    logger.info(f"Camera {cam.name} ({cam.id}): {prev_status} → {new_status}")

            await db.commit()

    async def _check_camera(
        self, client: httpx.AsyncClient, cam: Camera
    ) -> tuple[CameraStatus, Optional[datetime]]:
        """
        1차: MediaMTX REST API (api_port/9997) — readyTime으로 스트림 활성 여부 확인
        2차: API 연결 실패 시 WebRTC 포트 (port/8889) HTTP 응답으로 fallback
        """
        # ── 1차: MediaMTX REST API ─────────────────────────────────────────
        try:
            url  = f"http://{cam.ip}:{cam.api_port}/v3/paths/get/{cam.path}"
            auth = (cam.api_username, cam.api_password) if cam.api_username else None
            resp = await client.get(url, auth=auth)
            resp.raise_for_status()
            data = resp.json()

            # readyTime이 존재하면 카메라가 실제로 스트리밍 중
            if data.get("readyTime"):
                return CameraStatus.online, datetime.now(timezone.utc)
            else:
                return CameraStatus.offline, None

        except (httpx.ConnectError, httpx.TimeoutException):
            # MediaMTX API 미설정 또는 접근 불가 → WebRTC 포트로 fallback
            logger.debug(f"MediaMTX API unreachable for {cam.name}, trying WebRTC port fallback")

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return CameraStatus.offline, None
            if e.response.status_code in (401, 403):
                # API 인증 필요 → 자격증명 없이 호출 중이므로 WebRTC 포트로 fallback
                logger.debug(f"MediaMTX API auth required ({e.response.status_code}) for {cam.name}, trying WebRTC port fallback")
            else:
                raise

        # ── 2차: WebRTC 포트 HTTP 접근 가능 여부로 판단 ────────────────────
        try:
            webrtc_url = f"http://{cam.ip}:{cam.port}/{cam.path}/"
            resp = await client.get(webrtc_url)
            if resp.status_code < 500:
                return CameraStatus.online, datetime.now(timezone.utc)
            return CameraStatus.offline, None
        except (httpx.ConnectError, httpx.TimeoutException):
            return CameraStatus.offline, None

    async def check_single(self, camera_id: str) -> CameraStatus:
        """단일 카메라 즉시 체크 (API 요청 시 사용)"""
        async with AsyncSessionLocal() as db:
            cam = await db.get(Camera, camera_id)
            if not cam:
                raise ValueError(f"Camera {camera_id} not found")

        async with httpx.AsyncClient(timeout=5.0) as client:
            status, last_seen = await self._check_camera(client, cam)

        async with AsyncSessionLocal() as db:
            db_cam = await db.get(Camera, camera_id)
            if db_cam:
                db_cam.status = status
                if last_seen:
                    db_cam.last_seen = last_seen
                await db.commit()

        return status


# 싱글톤
polling_service = PollingService()
