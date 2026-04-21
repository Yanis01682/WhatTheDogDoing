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


