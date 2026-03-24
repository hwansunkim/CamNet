"""
Shared pytest fixtures for CamNet backend tests.
Uses synchronous TestClient for API calls; async fixtures via pytest-asyncio.
"""
import pytest
import pytest_asyncio
from starlette.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.database import Base, get_db
from app.main import app


# ── In-memory SQLite DB ─────────────────────────────────────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """각 테스트마다 테이블 생성 및 정리 (pytest-asyncio로 직접 await)."""
    await _create_tables()
    yield
    await _drop_tables()


async def _create_tables():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _drop_tables():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def client():
    """FastAPI 동기 테스트 클라이언트."""
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()


# ── Sample data ──────────────────────────────────────────────────────────────────
@pytest.fixture
def sample_camera_data():
    return {
        "name": "테스트 카메라",
        "ip": "192.168.0.100",
        "port": 8889,
        "rtsp_port": 8554,
        "api_port": 9997,
        "hls_port": 8888,
        "api_username": "",
        "api_password": "secret123",
        "path": "cam",
        "protocol": "webrtc",
        "room": "거실",
        "map_x": 50.0,
        "map_y": 50.0,
        "enabled": True,
    }


@pytest.fixture
def sample_map_data():
    return {
        "name": "1층 도면",
        "description": "테스트용 도면",
        "rooms": [
            {"id": "room1", "label": "거실", "x": 10, "y": 10, "w": 40, "h": 30, "color": "#141c28"},
        ],
    }
