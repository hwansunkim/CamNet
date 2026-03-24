from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """DB 세션 제공. 커밋은 라우터에서 명시적으로 수행."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """Create all tables on startup, then add any missing columns (SQLite migration)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if "sqlite" in settings.DATABASE_URL:
            await conn.run_sync(_sqlite_add_missing_columns)


import re
_SAFE_IDENTIFIER = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')


def _check_identifier(name: str) -> str:
    """테이블/컬럼명이 안전한 SQL 식별자인지 검증한다."""
    if not _SAFE_IDENTIFIER.match(name):
        raise ValueError(f"안전하지 않은 SQL 식별자: {name!r}")
    return name


def _sqlite_add_missing_columns(conn):
    """ALTER TABLE로 누락된 컬럼을 추가한다 (이미 있으면 무시)."""
    from sqlalchemy import inspect, text
    inspector = inspect(conn)
    for table in Base.metadata.sorted_tables:
        existing = {col["name"] for col in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name not in existing:
                col_type = col.type.compile(conn.dialect)
                # 기본값은 SQLAlchemy DDL을 통해 안전하게 처리
                default_clause = ""
                if col.default is not None and col.default.arg is not None:
                    default_val = col.default.arg
                    if isinstance(default_val, bool):
                        default_clause = f" DEFAULT {int(default_val)}"
                    elif isinstance(default_val, (int, float)):
                        default_clause = f" DEFAULT {default_val}"
                    elif isinstance(default_val, str):
                        # 안전한 문자열 이스케이프: single quote 탈출
                        safe_val = default_val.replace("'", "''")
                        default_clause = f" DEFAULT '{safe_val}'"
                conn.execute(text(
                    f"ALTER TABLE {_check_identifier(table.name)}"
                    f" ADD COLUMN {_check_identifier(col.name)} {col_type}{default_clause}"
                ))
