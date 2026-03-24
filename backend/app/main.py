import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api import cameras, ws, maps
from app.services.polling import polling_service

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── 시작 ──────────────────────────────────────
    logger.info(f"Starting {settings.APP_NAME} {settings.VERSION}")
    await init_db()                   # 테이블 생성
    await polling_service.start()     # MediaMTX 폴링 시작
    yield
    # ── 종료 ──────────────────────────────────────
    await polling_service.stop()
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=settings.CORS_METHODS,
    allow_headers=settings.CORS_HEADERS,
)

# ── 라우터 등록 ─────────────────────────────────
app.include_router(cameras.router, prefix="/api")
app.include_router(maps.router,    prefix="/api")
app.include_router(ws.router)       # /ws  (prefix 없음)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "version": settings.VERSION,
        "polling_active": polling_service.is_running,
    }
