"""
Tests for group invite/create edge cases and main.py endpoints.
"""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.database import get_db
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_coverage_extras.db"
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


def create_group(owner_headers, name, member_ids):
    res = client.post("/api/chat/groups", json={"name": name, "member_ids": member_ids}, headers=owner_headers)
    assert res.status_code == 200, res.text
    return res.json()["conversation_id"]


def make_group_with_two_users(prefix):
    u, ue = unique(f"{prefix}_owner")
    v, ve = unique(f"{prefix}_mbr")
    h_owner, owner = register_and_login(u, ue)
    h_member, member = register_and_login(v, ve)
    make_friends(h_owner, h_member, member["id"])
    gid = create_group(h_owner, f"{prefix} group", [member["id"]])
    return h_owner, owner, h_member, member, gid


# ---------------------------------------------------------------------------
# Group: invite members
# ---------------------------------------------------------------------------

def test_owner_can_invite_friend():
    u, ue = unique("inv_owner")
    v, ve = unique("inv_member")
    w, we = unique("inv_new")
    h_owner, owner = register_and_login(u, ue)
    h_member, member = register_and_login(v, ve)
    h_new, new_user = register_and_login(w, we)
    make_friends(h_owner, h_member, member["id"])
    make_friends(h_owner, h_new, new_user["id"])
    gid = create_group(h_owner, "invite group", [member["id"]])

    res = client.post(f"/api/chat/groups/{gid}/invite",
                      json={"member_ids": [new_user["id"]]}, headers=h_owner)
    assert res.status_code == 200
    assert res.json()["invited_count"] == 1


def test_cannot_invite_non_friend():
    u, ue = unique("inv_nf_owner")
    v, ve = unique("inv_nf_member")
    s, se = unique("inv_nf_stranger")
    h_owner, owner = register_and_login(u, ue)
    h_member, member = register_and_login(v, ve)
    _, stranger = register_and_login(s, se)
    make_friends(h_owner, h_member, member["id"])
    gid = create_group(h_owner, "nf invite group", [member["id"]])

    res = client.post(f"/api/chat/groups/{gid}/invite",
                      json={"member_ids": [stranger["id"]]}, headers=h_owner)
    assert res.status_code == 403
    assert res.json()["detail"] == "You can only invite your friends to a group"


def test_cannot_invite_existing_member():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("inv_existing")
    res = client.post(f"/api/chat/groups/{gid}/invite",
                      json={"member_ids": [member["id"]]}, headers=h_owner)
    assert res.status_code == 400


def test_invite_empty_list_returns_400():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("inv_empty")
    res = client.post(f"/api/chat/groups/{gid}/invite",
                      json={"member_ids": []}, headers=h_owner)
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# Group: create edge cases
# ---------------------------------------------------------------------------

def test_create_group_with_empty_name_fails():
    u, ue = unique("gcreate_e_owner")
    v, ve = unique("gcreate_e_mbr")
    h_owner, owner = register_and_login(u, ue)
    h_member, member = register_and_login(v, ve)
    make_friends(h_owner, h_member, member["id"])
    res = client.post("/api/chat/groups",
                      json={"name": "  ", "member_ids": [member["id"]]},
                      headers=h_owner)
    assert res.status_code == 400
    assert res.json()["detail"] == "Group name cannot be empty"


def test_create_group_with_non_friend_fails():
    u, ue = unique("gcreate_nf_owner")
    v, ve = unique("gcreate_nf_mbr")
    h_owner, _ = register_and_login(u, ue)
    _, member = register_and_login(v, ve)
    res = client.post("/api/chat/groups",
                      json={"name": "Test Group", "member_ids": [member["id"]]},
                      headers=h_owner)
    assert res.status_code == 403
    assert res.json()["detail"] == "You can only invite your friends to a group"


def test_create_group_needs_at_least_two_members():
    u, ue = unique("gcreate_min")
    h_owner, _ = register_and_login(u, ue)
    res = client.post("/api/chat/groups",
                      json={"name": "Lonely Group", "member_ids": []},
                      headers=h_owner)
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# main.py: /health, delete_account, update_status
# ---------------------------------------------------------------------------

def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_update_status_via_main():
    u, ue = unique("upd_status")
    h, _ = register_and_login(u, ue)
    res = client.put("/api/users/me/status?new_status=busy", headers=h)
    assert res.status_code == 200
    assert res.json()["status"] == "busy"


def test_delete_account_removes_user():
    u, ue = unique("del_acct")
    h, _ = register_and_login(u, ue)
    res = client.delete("/api/users/me", headers=h)
    assert res.status_code == 200
    assert res.json()["message"] == "Account deleted successfully"


def test_delete_account_cleans_private_conversation():
    u1, ue1 = unique("del_clean_a")
    u2, ue2 = unique("del_clean_b")
    h_a, u_a = register_and_login(u1, ue1)
    h_b, u_b = register_and_login(u2, ue2)
    make_friends(h_a, h_b, u_b["id"])

    client.delete("/api/users/me", headers=h_a)
    sessions_after = client.get("/api/chat/sessions", headers=h_b)
    assert sessions_after.json() == []


def test_delete_account_with_group_membership():
    u1, ue1 = unique("grp_del_owner")
    u2, ue2 = unique("grp_del_mbr")
    h_owner, u_owner = register_and_login(u1, ue1)
    h_member, u_member = register_and_login(u2, ue2)
    make_friends(h_owner, h_member, u_member["id"])
    create_group(h_owner, "grp del test", [u_member["id"]])

    client.delete("/api/users/me", headers=h_member)
    owner_sessions = client.get("/api/chat/sessions", headers=h_owner)
    group_sessions = [s for s in owner_sessions.json() if s["isGroup"]]
    assert len(group_sessions) >= 1


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
