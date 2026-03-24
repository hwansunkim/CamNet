from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME:    str  = "CamNET"
    VERSION:     str  = "1.0.0"
    DEBUG:       bool = False

    # Database — SQLite by default, swap to PostgreSQL in production
    DATABASE_URL: str = "sqlite+aiosqlite:///./camnet.db"
    # PostgreSQL example:
    # DATABASE_URL: str = "postgresql+asyncpg://user:pass@db:5432/camnet"

    # CORS — allow React dev server and production domain
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:80",
    ]
    CORS_METHODS: List[str] = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
    CORS_HEADERS: List[str] = ["Content-Type", "Authorization"]

    # MediaMTX polling interval (seconds)
    POLL_INTERVAL: int = 15

    # Camera offline threshold (seconds without response)
    OFFLINE_THRESHOLD: int = 30

    # HTTP timeout for MediaMTX health checks (seconds)
    HTTP_TIMEOUT: float = 5.0

    # WebSocket token (optional). If set, clients must pass ?token=<value>.
    # Leave empty to disable auth (default — safe for private LAN).
    WS_TOKEN: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
