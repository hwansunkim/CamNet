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

    # MediaMTX polling interval (seconds)
    POLL_INTERVAL: int = 15

    # Camera offline threshold (seconds without response)
    OFFLINE_THRESHOLD: int = 30

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
