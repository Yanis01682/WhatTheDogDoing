"""
Tests for auth sensitive info update, friend remark, and chat edge cases.
"""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.database import get_db
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_auth_friends.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

models.Base.metadata.drop_all(bind=engine)
models.Base.metadata.create_all(bind=engine)

_counter = [0]


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def unique(prefix: str):
    _counter[0] += 1
    n = _counter[0]
    return f"{prefix}_{n}", f"{prefix}_{n}@test.com"


def register_and_login(username: str, email: str):
    r = client.post("/auth/register", json={"username": username, "password": "secret123", "email": email})
    assert r.status_code == 200, r.text
    login = client.post("/auth/login", data={"username": username, "password": "secret123"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, login.json()["user"]


def make_friends(headers_a, headers_b, user_b_id):
    res = client.post("/api/chat/friends/add", json={"friend_id": user_b_id}, headers=headers_a)
    assert res.status_code == 200, res.text
    return res.json()["conversation_id"]


# ---------------------------------------------------------------------------
# auth.py: sensitive info update
# ---------------------------------------------------------------------------

def test_update_email_with_correct_password():
    u, ue = unique("sens_email")
    h, _ = register_and_login(u, ue)
    _, new_email = unique("new_email")
    res = client.post("/auth/profile/sensitive",
                      json={"password": "secret123", "new_email": new_email},
                      headers=h)
    assert res.status_code == 200
    assert "邮箱" in res.json()["updated_fields"]


def test_update_fails_with_wrong_password():
    u, ue = unique("sens_wrong_pw")
    h, _ = register_and_login(u, ue)
    res = client.post("/auth/profile/sensitive",
                      json={"password": "wrongpass", "new_email": "fail@x.com"},
                      headers=h)
    assert res.status_code == 401


def test_update_password_via_sensitive():
    u, ue = unique("sens_new_pw")
    h, _ = register_and_login(u, ue)
    res = client.post("/auth/profile/sensitive",
                      json={"password": "secret123", "new_password": "newpass456"},
                      headers=h)
    assert res.status_code == 200
    assert "密码" in res.json()["updated_fields"]


def test_update_new_password_too_short():
    u, ue = unique("sens_short_pw")
    h, _ = register_and_login(u, ue)
    res = client.post("/auth/profile/sensitive",
                      json={"password": "secret123", "new_password": "abc"},
                      headers=h)
    assert res.status_code == 400


def test_update_with_no_fields_returns_400():
    u, ue = unique("sens_no_fields")
    h, _ = register_and_login(u, ue)
    res = client.post("/auth/profile/sensitive",
                      json={"password": "secret123"},
                      headers=h)
    assert res.status_code == 400


def test_duplicate_email_in_sensitive_update_rejected():
    u1, ue1 = unique("sens_dup_a")
    u2, ue2 = unique("sens_dup_b")
    h_a, _ = register_and_login(u1, ue1)
    register_and_login(u2, ue2)
    res = client.post("/auth/profile/sensitive",
                      json={"password": "secret123", "new_email": ue2},
                      headers=h_a)
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# chat.py: friend remark & edge cases
# ---------------------------------------------------------------------------

def test_can_set_friend_remark():
    u1, ue1 = unique("remark_a")
    u2, ue2 = unique("remark_b")
    h_a, u_a = register_and_login(u1, ue1)
    h_b, u_b = register_and_login(u2, ue2)
    make_friends(h_a, h_b, u_b["id"])
    res = client.put(f"/api/chat/friends/{u_b['id']}/remark",
                     json={"remark": "My BFF"}, headers=h_a)
    assert res.status_code == 200
    assert res.json()["remark"] == "My BFF"


def test_remark_appears_in_friends_list():
    u1, ue1 = unique("remark_list_a")
    u2, ue2 = unique("remark_list_b")
    h_a, u_a = register_and_login(u1, ue1)
    h_b, u_b = register_and_login(u2, ue2)
    make_friends(h_a, h_b, u_b["id"])
    client.put(f"/api/chat/friends/{u_b['id']}/remark",
               json={"remark": "Best Friend"}, headers=h_a)
    friends = client.get("/api/chat/friends", headers=h_a)
    match = next(f for f in friends.json() if f["id"] == u_b["id"])
    assert match["remark"] == "Best Friend"


def test_remark_on_non_friend_returns_404():
    u1, ue1 = unique("remark_nf_a")
    u2, ue2 = unique("remark_nf_b")
    h_a, _ = register_and_login(u1, ue1)
    _, stranger = register_and_login(u2, ue2)
    res = client.put(f"/api/chat/friends/{stranger['id']}/remark",
                     json={"remark": "nobody"}, headers=h_a)
    assert res.status_code == 404


def test_cannot_add_self_as_friend():
    u, ue = unique("self_add")
    h, user = register_and_login(u, ue)
    res = client.post("/api/chat/friends/add",
                      json={"friend_id": user["id"]}, headers=h)
    assert res.status_code == 400


def test_duplicate_friend_request_rejected():
    u1, ue1 = unique("dup_req_a")
    u2, ue2 = unique("dup_req_b")
    h_a, _ = register_and_login(u1, ue1)
    _, u_b = register_and_login(u2, ue2)
    client.post("/api/chat/friends/requests", json={"friend_id": u_b["id"]}, headers=h_a)
    res = client.post("/api/chat/friends/requests", json={"friend_id": u_b["id"]}, headers=h_a)
    assert res.status_code == 400


def test_send_empty_message_fails():
    u1, ue1 = unique("empty_msg_a")
    u2, ue2 = unique("empty_msg_b")
    h_a, u_a = register_and_login(u1, ue1)
    h_b, u_b = register_and_login(u2, ue2)
    conv_id = make_friends(h_a, h_b, u_b["id"])
    res = client.post("/api/chat/messages/send",
                      json={"conversation_id": conv_id, "content": "   "},
                      headers=h_a)
    assert res.status_code == 400
    assert res.json()["detail"] == "Message content cannot be empty"


def test_revoke_nonexistent_message_returns_404():
    u, ue = unique("revoke_404")
    h, _ = register_and_login(u, ue)
    res = client.delete("/api/chat/messages/999999", headers=h)
    assert res.status_code == 404


def test_search_returns_empty_for_no_match():
    u, ue = unique("search_nomatch")
    h, _ = register_and_login(u, ue)
    res = client.get("/api/chat/users/search?q=zzz_no_match_xyz", headers=h)
    assert res.status_code == 200
    assert res.json() == []
