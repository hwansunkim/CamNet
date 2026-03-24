from sqlalchemy import Column, String, Integer, Boolean, Float, DateTime, Enum, Text
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class CameraStatus(str, enum.Enum):
    online = "online"
    offline = "offline"
    unknown = "unknown"


class CameraProtocol(str, enum.Enum):
    webrtc = "webrtc"
    rtsp = "rtsp"


class Camera(Base):
    __tablename__ = "cameras"

    id          = Column(String, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    ip          = Column(String, nullable=False)
    port        = Column(Integer, default=8889)       # MediaMTX WebRTC port
    rtsp_port   = Column(Integer, default=8554)       # MediaMTX RTSP port
    api_port    = Column(Integer, default=9997)       # MediaMTX REST API port
    hls_port    = Column(Integer, default=8888)       # MediaMTX HLS port
    api_username = Column(String, default="")         # MediaMTX API Basic Auth
    api_password = Column(String, default="")
    path        = Column(String, nullable=False)      # stream path e.g. "cam"
    protocol    = Column(Enum(CameraProtocol), default=CameraProtocol.webrtc)
    room        = Column(String, default="")          # room/location label
    map_x       = Column(Float, default=50.0)         # floor map position (%)
    map_y       = Column(Float, default=50.0)
    enabled     = Column(Boolean, default=True)
    status      = Column(Enum(CameraStatus), default=CameraStatus.unknown)
    last_seen   = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    @property
    def webrtc_url(self) -> str:
        return f"http://{self.ip}:{self.port}/{self.path}/"

    @property
    def hls_url(self) -> str:
        return f"/hls/{self.ip}/{self.hls_port}/{self.path}/index.m3u8"

    @property
    def rtsp_url(self) -> str:
        return f"rtsp://{self.ip}:{self.rtsp_port}/{self.path}"

    @property
    def mediamtx_api_url(self) -> str:
        return f"http://{self.ip}:{self.api_port}/v3/paths/get/{self.path}"
