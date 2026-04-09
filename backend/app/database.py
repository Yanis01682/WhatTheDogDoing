import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DEFAULT_SQLITE_URL = "sqlite:///./whatthedogdoing.db"


def normalize_database_url(raw_url: str | None) -> str:
    database_url = (raw_url or "").strip()
    if not database_url:
        return DEFAULT_SQLITE_URL

    if database_url.startswith("mysql://"):
        return database_url.replace("mysql://", "mysql+pymysql://", 1)

    return database_url


def get_engine_kwargs(database_url: str) -> dict:
    if database_url.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}}

    return {"pool_pre_ping": True}


SQLALCHEMY_DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL"))

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    **get_engine_kwargs(SQLALCHEMY_DATABASE_URL),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """获取数据库会话的依赖函数"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
