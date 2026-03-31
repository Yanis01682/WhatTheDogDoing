# backend/app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
# 假设大作业初期你们使用 SQLite 方便本地开发和演示
SQLALCHEMY_DATABASE_URL = "sqlite:///./whatthedogdoing.db" 

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """获取数据库会话的依赖函数"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()