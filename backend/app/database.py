# backend/app/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base

# 识别是否在 GitLab CI 的测试阶段
if os.getenv("CI") or os.getenv("GITLAB_CI"):
    default_db_url = "sqlite:///./test.db"
else:
    default_db_url = "mysql+pymysql://root:123456@mysql-db:3306/whatthedogdoing"

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", default_db_url)

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # 【核心修复 2】加入 pool_pre_ping 和 pool_recycle，防止云数据库假死引发的 500 报错
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,  # 每次查询前验证连接是否有效，无效自动重连
        pool_recycle=3600    # 定期回收连接池
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