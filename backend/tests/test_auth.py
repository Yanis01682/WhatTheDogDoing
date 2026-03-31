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
models.Base.metadata.drop_all(bind=engine)
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
    client.post("/auth/register", json={"username": "duplicate_user", "password": "pw"})
    response = client.post(
        "/auth/register",
        json={"username": "duplicate_user", "password": "pw"}
    )
    assert response.status_code == 400
    # 修复了断言 Bug，对齐了 auth.py 里的英文报错
    assert response.json()["detail"] == "Username already taken" 

def test_login_success():
    """测试正常登录"""
    client.post("/auth/register", json={"username": "loginuser", "password": "loginpw"})
    # 因为 login 改为了表单接收，这里必须用 data 而不是 json
    response = client.post(
        "/auth/login",
        data={"username": "loginuser", "password": "loginpw"}
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
        data={"username": "wrongpwuser", "password": "wrongpw"}
    )
    assert response.status_code == 401

def test_auth_me():
    """测试通过 token 获取当前用户信息 (补全覆盖率)"""
    client.post("/auth/register", json={"username": "me_user", "password": "pw"})
    login_res = client.post("/auth/login", data={"username": "me_user", "password": "pw"})
    token = login_res.json()["access_token"]
    
    response = client.get(
        "/auth/me", 
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["username"] == "me_user"

def test_auth_me_invalid_token():
    """测试无效的 token (补全覆盖率)"""
    response = client.get(
        "/auth/me", 
        headers={"Authorization": "Bearer fake_token_here"}
    )
    assert response.status_code == 401

def test_health_check():
    """测试健康检查接口 (补全覆盖率)"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_chat_sessions_placeholder():
    """测试会话占位接口 (补全覆盖率)"""
    response = client.get("/api/chat/sessions")
    # 因为 wjq 的 chat.py 里目前返回的是空列表 []
    assert response.status_code == 200
    assert response.json() == []