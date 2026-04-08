# backend/app/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base

# 核心修复：识别是否在 GitLab CI 的测试阶段
# 如果是在 CI 环境跑测试，使用本地 SQLite；否则默认使用 Secoder 的真实 MySQL
if os.getenv("CI") or os.getenv("GITLAB_CI"):
    default_db_url = "sqlite:///./test.db"
else:
    default_db_url = "mysql+pymysql://root:123456@mysql-db:3306/whatthedogdoing"

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", default_db_url)

# SQLite 需要设置 check_same_thread，但 MySQL 不能加这个参数
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """获取数据库会话的依赖函数"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()