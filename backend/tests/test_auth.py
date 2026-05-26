# backend/tests/test_auth.py
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import get_db
from app.auth import create_access_token
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


def test_register_duplicate_email():
    """测试重复邮箱返回 400 而不是数据库错误"""
    first = client.post(
        "/auth/register",
        json={"username": "email_user_one", "password": "pw123456", "email": "dup@example.com"}
    )
    assert first.status_code == 200

    response = client.post(
        "/auth/register",
        json={"username": "email_user_two", "password": "pw123456", "email": "dup@example.com"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already taken"


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
    """测试登录后可访问会话接口 (补全覆盖率)"""
    client.post("/auth/register", json={"username": "chat_session_user", "password": "pw"})
    login_res = client.post(
        "/auth/login",
        data={"username": "chat_session_user", "password": "pw"},
    )
    token = login_res.json()["access_token"]

    response = client.get(
        "/api/chat/sessions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json() == []


def test_get_current_user_invalid_subject_token():
    """token 中缺少 sub 时返回 401"""
    bad_token = create_access_token({"foo": "bar"})
    response = client.get(
        "/auth/profile",
        headers={"Authorization": f"Bearer {bad_token}"},
    )
    assert response.status_code == 401


def test_get_current_user_user_not_found():
    """token 的 sub 对应用户不存在时返回 404"""
    missing_user_token = create_access_token({"sub": "ghost_user_for_test"})
    response = client.get(
        "/auth/profile",
        headers={"Authorization": f"Bearer {missing_user_token}"},
    )
    assert response.status_code == 404


def test_logout_and_change_password_flow():
    """覆盖 logout/change-password 的关键分支"""
    client.post(
        "/auth/register",
        json={"username": "state_user", "password": "oldpass123", "email": "state_user@example.com"},
    )
    login_res = client.post(
        "/auth/login",
        data={"username": "state_user", "password": "oldpass123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    wrong_old = client.put(
        "/auth/change-password",
        json={"old_password": "wrong-old", "new_password": "newpass123"},
        headers=headers,
    )
    assert wrong_old.status_code == 400

    short_new = client.put(
        "/auth/change-password",
        json={"old_password": "oldpass123", "new_password": "123"},
        headers=headers,
    )
    assert short_new.status_code == 400

    changed = client.put(
        "/auth/change-password",
        json={"old_password": "oldpass123", "new_password": "newpass123"},
        headers=headers,
    )
    assert changed.status_code == 200

    logout_res = client.post("/auth/logout", headers=headers)
    assert logout_res.status_code == 200

    old_login = client.post(
        "/auth/login",
        data={"username": "state_user", "password": "oldpass123"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/auth/login",
        data={"username": "state_user", "password": "newpass123"},
    )
    assert new_login.status_code == 200


def test_update_profile_and_read_profile():
    """覆盖 profile 更新与读取"""
    client.post(
        "/auth/register",
        json={"username": "profile_user", "password": "profilepass", "email": "profile_user@example.com"},
    )
    login_res = client.post(
        "/auth/login",
        data={"username": "profile_user", "password": "profilepass"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    update_res = client.put(
        "/auth/profile",
        json={
            "nickname": "Profile Nick",
            "gender": "female",
            "phone": "13800138000",
            "bio": "hello",
            "email": "updated_profile_user@example.com",
        },
        headers=headers,
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["nickname"] == "Profile Nick"
    assert updated["gender"] == "female"
    assert updated["phone"] == "13800138000"
    assert updated["bio"] == "hello"
    assert updated["email"] == "updated_profile_user@example.com"

    profile_res = client.get("/auth/profile", headers=headers)
    assert profile_res.status_code == 200
    assert profile_res.json()["nickname"] == "Profile Nick"


def test_delete_account_endpoint():
    """覆盖 /api/users/me 删除账号分支"""
    client.post(
        "/auth/register",
        json={"username": "delete_me_user", "password": "deletepass", "email": "delete_me_user@example.com"},
    )
    login_res = client.post(
        "/auth/login",
        data={"username": "delete_me_user", "password": "deletepass"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    delete_res = client.delete("/api/users/me", headers=headers)
    assert delete_res.status_code == 200

    me_after_delete = client.get("/auth/me", headers=headers)
    assert me_after_delete.status_code in (401, 404)

    relogin = client.post(
        "/auth/login",
        data={"username": "delete_me_user", "password": "deletepass"},
    )
    assert relogin.status_code == 401


def test_delete_account_cleans_friendships_private_messages_and_group_membership():
    alice_register = client.post(
        "/auth/register",
        json={"username": "cleanup_alice", "password": "deletepass", "email": "cleanup_alice@example.com"},
    )
    bob_register = client.post(
        "/auth/register",
        json={"username": "cleanup_bob", "password": "deletepass", "email": "cleanup_bob@example.com"},
    )
    carol_register = client.post(
        "/auth/register",
        json={"username": "cleanup_carol", "password": "deletepass", "email": "cleanup_carol@example.com"},
    )
    assert alice_register.status_code == 200
    assert bob_register.status_code == 200
    assert carol_register.status_code == 200

    alice_id = alice_register.json()["id"]
    bob_id = bob_register.json()["id"]
    carol_id = carol_register.json()["id"]

    alice_login = client.post("/auth/login", data={"username": "cleanup_alice", "password": "deletepass"})
    bob_login = client.post("/auth/login", data={"username": "cleanup_bob", "password": "deletepass"})
    assert alice_login.status_code == 200
    assert bob_login.status_code == 200

    alice_headers = {"Authorization": f"Bearer {alice_login.json()['access_token']}"}
    bob_headers = {"Authorization": f"Bearer {bob_login.json()['access_token']}"}

    private_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_id},
        headers=alice_headers,
    )
    assert private_res.status_code == 200
    private_conversation_id = private_res.json()["conversation_id"]

    private_message_res = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": private_conversation_id, "content": "private cleanup"},
        headers=alice_headers,
    )
    assert private_message_res.status_code == 200

    # Carol must also be a friend to be in a group
    client.post("/api/chat/friends/add", json={"friend_id": carol_id}, headers=alice_headers)

    group_res = client.post(
        "/api/chat/groups",
        json={"name": "cleanup-group", "member_ids": [bob_id, carol_id]},
        headers=alice_headers,
    )
    assert group_res.status_code == 200
    group_conversation_id = group_res.json()["conversation_id"]

    group_message_res = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": group_conversation_id, "content": "group cleanup"},
        headers=alice_headers,
    )
    assert group_message_res.status_code == 200

    delete_res = client.delete("/api/users/me", headers=alice_headers)
    assert delete_res.status_code == 200

    bob_friends = client.get("/api/chat/friends", headers=bob_headers)
    bob_sessions = client.get("/api/chat/sessions", headers=bob_headers)
    group_members = client.get(f"/api/chat/groups/{group_conversation_id}/members", headers=bob_headers)
    group_messages = client.get(f"/api/chat/sessions/{group_conversation_id}/messages", headers=bob_headers)
    private_messages = client.get(f"/api/chat/sessions/{private_conversation_id}/messages", headers=bob_headers)

    assert bob_friends.status_code == 200
    assert bob_friends.json() == []
    assert bob_sessions.status_code == 200
    assert all(session["id"] != private_conversation_id for session in bob_sessions.json())
    assert any(session["id"] == group_conversation_id for session in bob_sessions.json())

    assert group_members.status_code == 200
    assert all(member["name"] != "cleanup_alice" for member in group_members.json())

    assert group_messages.status_code == 200
    assert all(m["sender"] == "system" for m in group_messages.json())

    assert private_messages.status_code == 403

    relogin = client.post(
        "/auth/login",
        data={"username": "cleanup_alice", "password": "deletepass"},
    )
    assert relogin.status_code == 401
