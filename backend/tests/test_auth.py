# backend/tests/test_auth.py
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import get_db
from app import models

# 1. 创建一个专门用于测试的内存数据库 (运行完就销毁，干干净净)
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_whatthedogdoing.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 建表
models.Base.metadata.create_all(bind=engine)

# 2. 替换掉真实的数据库连接
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

# ====================
# 开始写测试用例
# ====================

def test_register_success():
    """测试正常注册"""
    response = client.post(
        "/auth/register",
        json={"username": "testuser", "password": "testpassword"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
    assert "id" in data

def test_register_duplicate():
    """测试重复注册报错"""
    # 第一次注册（依赖上面的状态或重新发一次）
    client.post("/auth/register", json={"username": "duplicate_user", "password": "pw"})
    # 第二次注册同名
    response = client.post(
        "/auth/register",
        json={"username": "duplicate_user", "password": "pw"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "用户名已被注册"

def test_login_success():
    """测试正常登录"""
    # 先注册一个
    client.post("/auth/register", json={"username": "loginuser", "password": "loginpw"})
    # 再登录
    response = client.post(
        "/auth/login",
        json={"username": "loginuser", "password": "loginpw"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "loginuser"

def test_login_wrong_password():
    """测试密码错误"""
    client.post("/auth/register", json={"username": "wrongpwuser", "password": "pw"})
    response = client.post(
        "/auth/login",
        json={"username": "wrongpwuser", "password": "wrongpw"}
    )
    assert response.status_code == 401