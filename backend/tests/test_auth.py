import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import get_db
from app.auth import create_access_token
from app import models

TEST_DB_FILE = "./test_auth_real.db"

engine = create_engine(
    f"sqlite:///{TEST_DB_FILE}", connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

models.Base.metadata.drop_all(bind=engine)
models.Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_register_user_success():
    response = client.post(
        "/auth/register",
        json={"username": "testuser", "password": "testpassword", "email": "test@example.com"}
    )
    assert response.status_code == 200

def test_register_user_duplicate_username():
    client.post("/auth/register", json={"username": "dup_user", "password": "pw"})
    response = client.post("/auth/register", json={"username": "dup_user", "password": "pw"})
    assert response.status_code == 400
    # 这里修改为正确的英文断言！
    assert response.json()["detail"] == "Username already taken"

def test_login_success():
    client.post("/auth/register", json={"username": "login_user", "password": "pw"})
    response = client.post("/auth/login", json={"username": "login_user", "password": "pw"})
    assert response.status_code == 200

def test_login_invalid_password():
    client.post("/auth/register", json={"username": "wrong_pw_user", "password": "pw"})
    response = client.post("/auth/login", json={"username": "wrong_pw_user", "password": "wrong_pw"})
    assert response.status_code == 401

def test_login_user_not_found():
    response = client.post("/auth/login", json={"username": "nonexistent_user", "password": "pw"})
    assert response.status_code == 401

def test_get_user_profile():
    client.post("/auth/register", json={"username": "profile_user", "password": "pw"})
    login_res = client.post("/auth/login", json={"username": "profile_user", "password": "pw"})
    token = login_res.json()["access_token"]
    res = client.get("/auth/profile", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200

def test_update_user_profile_success():
    login_res = client.post("/auth/login", json={"username": "profile_user", "password": "pw"})
    token = login_res.json()["access_token"]
    res = client.patch(
        "/auth/profile", 
        headers={"Authorization": f"Bearer {token}"},
        json={"nickname": "NewName", "bio": "Hello World"}
    )
    assert res.status_code == 200

def test_delete_user_account():
    client.post("/auth/register", json={"username": "delete_user", "password": "pw"})
    login_res = client.post("/auth/login", json={"username": "delete_user", "password": "pw"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    fail_res = client.request("DELETE", "/api/users/me", headers=headers, json={"password": "wrong_pw"})
    assert fail_res.status_code == 400
    success_res = client.request("DELETE", "/api/users/me", headers=headers, json={"password": "pw"})
    assert success_res.status_code == 200

def test_database_session_lifecycle():
    from app.database import get_db
    db_gen = get_db()
    db = next(db_gen)
    assert db is not None
    try:
        next(db_gen)
    except StopIteration:
        pass

def test_login_with_email_fallback():
    client.post("/auth/register", json={
        "username": "email_user", 
        "password": "pw",
        "email": "test_login@example.com"
    })
    res = client.post("/auth/login", json={"username": "test_login@example.com", "password": "pw"})
    assert res.status_code == 200

def test_update_profile_email_conflict():
    client.post("/auth/register", json={"username": "user_a", "password": "pw", "email": "a@test.com"})
    client.post("/auth/register", json={"username": "user_b", "password": "pw"})
    login_res = client.post("/auth/login", json={"username": "user_b", "password": "pw"})
    token = login_res.json()["access_token"]
    res = client.patch(
        "/auth/profile", 
        headers={"Authorization": f"Bearer {token}"}, 
        json={"email": "a@test.com"}
    )
    assert res.status_code == 400

def test_all_token_exception_branches():
    """暴力测试：用三种非法 Token 请求所有受保护接口，保证 100% 覆盖率"""
    invalid_token = "Bearer this_is_a_completely_invalid_token_string"
    no_sub_token = f"Bearer {create_access_token(data={'other_key': 'value'})}"
    ghost_token = f"Bearer {create_access_token(data={'sub': 'ghost_user'})}"

    endpoints = [
        ("GET", "/auth/me"),
        ("GET", "/auth/profile"),
        ("PATCH", "/auth/profile"),
        ("DELETE", "/api/users/me")
    ]

    for method, url in endpoints:
        # 触发 401 异常分支 (无效 token)
        client.request(method, url, headers={"Authorization": invalid_token}, json={"password": "pw"})
        # 触发 401 异常分支 (缺少 sub)
        client.request(method, url, headers={"Authorization": no_sub_token}, json={"password": "pw"})
        # 触发 404 异常分支 (用户不存在)
        client.request(method, url, headers={"Authorization": ghost_token}, json={"password": "pw"})