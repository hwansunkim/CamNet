from ipaddress import ip_address, AddressValueError
from pydantic import BaseModel, Field, computed_field, field_validator
from typing import Optional
from datetime import datetime
from app.models.camera import CameraStatus, CameraProtocol


class PositionUpdate(BaseModel):
    map_x: float = Field(ge=0, le=100)
    map_y: float = Field(ge=0, le=100)


class CameraBase(BaseModel):
    name:      str
    ip:        str
    port:      int = 8889
    rtsp_port: int = 8554
    api_port:     int = 9997
    hls_port:     int = 8888
    api_username: str = ""
    api_password: str = ""
    path:         str
    protocol:  CameraProtocol = CameraProtocol.webrtc
    room:      str = ""
    map_x:     float = Field(50.0, ge=0, le=100)
    map_y:     float = Field(50.0, ge=0, le=100)
    enabled:   bool = True

    @field_validator("ip")
    @classmethod
    def validate_ip(cls, v: str) -> str:
        try:
            addr = ip_address(v)
        except (AddressValueError, ValueError):
            raise ValueError(f"유효하지 않은 IP 주소입니다: {v!r}")
        if addr.is_loopback:
            raise ValueError("루프백 주소는 허용되지 않습니다")
        if addr.is_link_local:
            raise ValueError("링크-로컬 주소(169.254.x.x)는 허용되지 않습니다")
        return v


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    name:      Optional[str] = None
    ip:        Optional[str] = None
    port:      Optional[int] = None
    rtsp_port: Optional[int] = None
    api_port:     Optional[int] = None
    hls_port:     Optional[int] = None
    api_username: Optional[str] = None
    api_password: Optional[str] = None
    path:         Optional[str] = None
    protocol:  Optional[CameraProtocol] = None
    room:      Optional[str] = None
    map_x:     Optional[float] = Field(None, ge=0, le=100)
    map_y:     Optional[float] = Field(None, ge=0, le=100)
    enabled:   Optional[bool] = None
    # status는 폴링 서비스만 갱신 — 클라이언트 직접 수정 차단


class CameraResponse(CameraBase):
    id:         str
    status:     CameraStatus
    last_seen:  Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    api_password: str = Field(default="", exclude=True)  # 응답에서 비밀번호 제외
    model_config = {"from_attributes": True}

    @computed_field
    @property
    def webrtc_url(self) -> str:
        return f"http://{self.ip}:{self.port}/{self.path}/"

    @computed_field
    @property
    def hls_url(self) -> str:
        return f"/hls/{self.ip}/{self.hls_port}/{self.path}/index.m3u8"

    @computed_field
    @property
    def rtsp_url(self) -> str:
        return f"rtsp://{self.ip}:{self.rtsp_port}/{self.path}"


class CameraStatusEvent(BaseModel):
    """WebSocket으로 전송되는 카메라 상태 이벤트"""
    type:      str = "status_update"
    camera_id: str
    status:    CameraStatus
    last_seen: Optional[datetime]
