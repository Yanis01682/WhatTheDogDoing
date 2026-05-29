"""
Tests for group management: kick, transfer, dismiss, exit, admin, nickname.
"""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.database import get_db
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_group_mgmt.db"
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
    v, ve = unique(f"{prefix}_member")
    h_owner, owner = register_and_login(u, ue)
    h_member, member = register_and_login(v, ve)
    make_friends(h_owner, h_member, member["id"])
    gid = create_group(h_owner, f"{prefix} group", [member["id"]])
    return h_owner, owner, h_member, member, gid


# ---------------------------------------------------------------------------
# Group: kick member
# ---------------------------------------------------------------------------

def test_owner_can_kick_member():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("kick_ok")
    res = client.post(f"/api/chat/groups/{gid}/kick",
                      json={"user_id": member["id"]}, headers=h_owner)
    assert res.status_code == 200
    assert res.json()["message"] == "Member kicked successfully"


def test_member_cannot_kick():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("kick_perm")
    res = client.post(f"/api/chat/groups/{gid}/kick",
                      json={"user_id": owner["id"]}, headers=h_member)
    assert res.status_code == 403


def test_kick_nonexistent_user_returns_404():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("kick_404")
    res = client.post(f"/api/chat/groups/{gid}/kick",
                      json={"user_id": 99999}, headers=h_owner)
    assert res.status_code == 404


def test_cannot_kick_self():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("kick_self")
    res = client.post(f"/api/chat/groups/{gid}/kick",
                      json={"user_id": owner["id"]}, headers=h_owner)
    assert res.status_code == 400


def test_kick_missing_user_id_returns_400():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("kick_missing")
    res = client.post(f"/api/chat/groups/{gid}/kick", json={}, headers=h_owner)
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# Group: transfer ownership
# ---------------------------------------------------------------------------

def test_owner_can_transfer():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("xfer_ok")
    res = client.post(f"/api/chat/groups/{gid}/transfer",
                      json={"new_owner_id": member["id"]}, headers=h_owner)
    assert res.status_code == 200
    members = client.get(f"/api/chat/groups/{gid}/members", headers=h_member)
    roles = {m["id"]: m["role"] for m in members.json()}
    assert roles[member["id"]] == "owner"
    assert roles[owner["id"]] == "member"


def test_member_cannot_transfer():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("xfer_perm")
    res = client.post(f"/api/chat/groups/{gid}/transfer",
                      json={"new_owner_id": owner["id"]}, headers=h_member)
    assert res.status_code == 403


def test_cannot_transfer_to_self():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("xfer_self")
    res = client.post(f"/api/chat/groups/{gid}/transfer",
                      json={"new_owner_id": owner["id"]}, headers=h_owner)
    assert res.status_code == 400


def test_cannot_transfer_to_non_member():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("xfer_nonmember")
    res = client.post(f"/api/chat/groups/{gid}/transfer",
                      json={"new_owner_id": 99999}, headers=h_owner)
    assert res.status_code == 404


def test_transfer_missing_new_owner_id_returns_400():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("xfer_missing")
    res = client.post(f"/api/chat/groups/{gid}/transfer", json={}, headers=h_owner)
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# Group: dismiss
# ---------------------------------------------------------------------------

def test_member_cannot_dismiss():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("dismiss_perm")
    res = client.delete(f"/api/chat/groups/{gid}", headers=h_member)
    assert res.status_code == 403
    assert res.json()["detail"] == "Only group owner can dismiss the group"


def test_owner_can_dismiss_group():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("dismiss_ok")
    res = client.delete(f"/api/chat/groups/{gid}", headers=h_owner)
    assert res.status_code == 200
    sessions = client.get("/api/chat/sessions", headers=h_member)
    group_ids = [s["id"] for s in sessions.json()]
    assert gid not in group_ids


# ---------------------------------------------------------------------------
# Group: exit
# ---------------------------------------------------------------------------

def test_member_can_exit_group():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("exit_ok")
    res = client.post(f"/api/chat/groups/{gid}/exit", headers=h_member)
    assert res.status_code == 200
    sessions = client.get("/api/chat/sessions", headers=h_member)
    assert not any(s["id"] == gid for s in sessions.json())


def test_owner_cannot_exit_without_transfer():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("exit_owner")
    res = client.post(f"/api/chat/groups/{gid}/exit", headers=h_owner)
    assert res.status_code == 403
    assert res.json()["detail"] == "Owner cannot leave the group, please transfer ownership first"


# ---------------------------------------------------------------------------
# Group: set admin
# ---------------------------------------------------------------------------

def test_owner_can_set_admin():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("admin_set")
    res = client.put(f"/api/chat/groups/{gid}/admin",
                     json={"user_id": member["id"], "is_admin": True}, headers=h_owner)
    assert res.status_code == 200
    assert res.json()["role"] == "admin"


def test_owner_can_unset_admin():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("admin_unset")
    client.put(f"/api/chat/groups/{gid}/admin",
               json={"user_id": member["id"], "is_admin": True}, headers=h_owner)
    res = client.put(f"/api/chat/groups/{gid}/admin",
                     json={"user_id": member["id"], "is_admin": False}, headers=h_owner)
    assert res.status_code == 200
    assert res.json()["role"] == "member"


def test_member_cannot_set_admin():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("admin_perm")
    res = client.put(f"/api/chat/groups/{gid}/admin",
                     json={"user_id": owner["id"], "is_admin": True}, headers=h_member)
    assert res.status_code == 403


def test_cannot_change_own_admin_role():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("admin_self")
    res = client.put(f"/api/chat/groups/{gid}/admin",
                     json={"user_id": owner["id"], "is_admin": False}, headers=h_owner)
    assert res.status_code == 400


def test_admin_missing_user_id_returns_400():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("admin_missing")
    res = client.put(f"/api/chat/groups/{gid}/admin",
                     json={"is_admin": True}, headers=h_owner)
    assert res.status_code == 400


def test_admin_cannot_kick_owner():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("admin_kick_owner")
    client.put(f"/api/chat/groups/{gid}/admin",
               json={"user_id": member["id"], "is_admin": True}, headers=h_owner)
    res = client.post(f"/api/chat/groups/{gid}/kick",
                      json={"user_id": owner["id"]}, headers=h_member)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Group: group nickname
# ---------------------------------------------------------------------------

def test_member_can_set_group_nickname():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("nick_set")
    res = client.put(f"/api/chat/groups/{gid}/nickname",
                     json={"nickname": "Cool Nickname"}, headers=h_member)
    assert res.status_code == 200
    assert res.json()["group_nickname"] == "Cool Nickname"


def test_clearing_nickname_returns_empty_string():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("nick_clear")
    client.put(f"/api/chat/groups/{gid}/nickname",
               json={"nickname": "Temp"}, headers=h_member)
    res = client.put(f"/api/chat/groups/{gid}/nickname",
                     json={"nickname": ""}, headers=h_member)
    assert res.status_code == 200
    assert res.json()["group_nickname"] == ""


def test_nickname_appears_in_member_list():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("nick_list")
    client.put(f"/api/chat/groups/{gid}/nickname",
               json={"nickname": "Visible Nick"}, headers=h_member)
    members = client.get(f"/api/chat/groups/{gid}/members", headers=h_owner)
    member_data = next(m for m in members.json() if m["id"] == member["id"])
    assert member_data["groupNickname"] == "Visible Nick"
    assert member_data["displayName"] == "Visible Nick"


def test_owner_can_publish_and_read_group_announcements():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("announce")
    create_res = client.post(
        f"/api/chat/groups/{gid}/announcements",
        json={"content": "First announcement"},
        headers=h_owner,
    )
    assert create_res.status_code == 200

    history_res = client.get(f"/api/chat/groups/{gid}/announcements", headers=h_member)
    assert history_res.status_code == 200
    assert history_res.json()[0]["content"] == "First announcement"
    assert history_res.json()[0]["publisherName"] == owner["username"]

    sessions_res = client.get("/api/chat/sessions", headers=h_member)
    assert any(
        item["id"] == gid and item["badge"] > 0 and "First announcement" in item["lastMessage"]
        for item in sessions_res.json()
    )

    messages_res = client.get(f"/api/chat/sessions/{gid}/messages", headers=h_member)
    assert messages_res.status_code == 200
    assert messages_res.json()[-1]["text"] == f'"{owner["username"]}"发布了新公告：First announcement'


def test_member_invite_request_can_be_approved_by_owner():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("invite_req")
    _, friend_email = unique("invitee")
    friend_name = friend_email.split("@")[0]
    h_friend, friend = register_and_login(friend_name, friend_email)
    make_friends(h_member, h_friend, friend["id"])

    create_res = client.post(
        f"/api/chat/groups/{gid}/invite-requests",
        json={"invitee_id": friend["id"]},
        headers=h_member,
    )
    assert create_res.status_code == 200
    request_id = create_res.json()["request"]["id"]

    pending_res = client.get("/api/chat/groups/invite-requests", headers=h_owner)
    assert pending_res.status_code == 200
    assert any(item["id"] == request_id for item in pending_res.json())

    approve_res = client.post(f"/api/chat/groups/invite-requests/{request_id}/approve", headers=h_owner)
    assert approve_res.status_code == 200

    members_res = client.get(f"/api/chat/groups/{gid}/members", headers=h_owner)
    assert any(item["id"] == friend["id"] for item in members_res.json())


def test_admin_can_reject_group_invite_request():
    h_owner, owner, h_member, member, gid = make_group_with_two_users("invite_reject")
    client.put(f"/api/chat/groups/{gid}/admin", json={"user_id": member["id"], "is_admin": True}, headers=h_owner)
    _, friend_email = unique("invitee_reject")
    friend_name = friend_email.split("@")[0]
    h_friend, friend = register_and_login(friend_name, friend_email)
    make_friends(h_owner, h_friend, friend["id"])

    create_res = client.post(
        f"/api/chat/groups/{gid}/invite-requests",
        json={"invitee_id": friend["id"]},
        headers=h_owner,
    )
    assert create_res.status_code == 200
    request_id = create_res.json()["request"]["id"]

    reject_res = client.post(f"/api/chat/groups/invite-requests/{request_id}/reject", headers=h_member)
    assert reject_res.status_code == 200

    pending_res = client.get("/api/chat/groups/invite-requests", headers=h_member)
    assert all(item["id"] != request_id for item in pending_res.json())
