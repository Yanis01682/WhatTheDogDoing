import io

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.database import get_db
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_chat_real_flow.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
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


def register_and_login(username: str, email: str):
    register_res = client.post(
        "/auth/register",
        json={"username": username, "password": "secret123", "email": email},
    )
    assert register_res.status_code == 200

    login_res = client.post(
        "/auth/login",
        data={"username": username, "password": "secret123"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, login_res.json()["user"]


def test_search_users_excludes_current_user():
    headers_alice, _ = register_and_login("alice", "alice@example.com")
    register_and_login("bob", "bob@example.com")

    response = client.get("/api/chat/users/search?q=bo", headers=headers_alice)

    assert response.status_code == 200
    data = response.json()
    names = [item["name"] for item in data]
    assert "bob" in names
    assert "alice" not in names


def test_friend_request_flow_creates_private_chat_after_accept():
    headers_alice, _ = register_and_login("iris", "iris@example.com")
    headers_bob, bob_user = register_and_login("jack", "jack@example.com")

    request_res = client.post(
        "/api/chat/friends/requests",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    assert request_res.status_code == 200
    request_id = request_res.json()["id"]

    bob_requests = client.get("/api/chat/friends/requests", headers=headers_bob)
    assert bob_requests.status_code == 200
    assert bob_requests.json()["incoming"][0]["name"] == "iris"

    accept_res = client.post(f"/api/chat/friends/requests/{request_id}/accept", headers=headers_bob)
    assert accept_res.status_code == 200
    assert accept_res.json()["friend"]["name"] == "iris"

    alice_friends = client.get("/api/chat/friends", headers=headers_alice)
    bob_friends = client.get("/api/chat/friends", headers=headers_bob)
    assert alice_friends.json()[0]["name"] == "jack"
    assert bob_friends.json()[0]["name"] == "iris"


def test_reject_friend_request_removes_pending_item():
    headers_alice, _ = register_and_login("kate", "kate@example.com")
    headers_bob, bob_user = register_and_login("liam", "liam@example.com")

    request_res = client.post(
        "/api/chat/friends/requests",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    request_id = request_res.json()["id"]

    reject_res = client.post(f"/api/chat/friends/requests/{request_id}/reject", headers=headers_bob)
    assert reject_res.status_code == 200

    bob_requests = client.get("/api/chat/friends/requests", headers=headers_bob)
    assert bob_requests.status_code == 200
    assert bob_requests.json()["incoming"] == []


def test_add_friend_creates_session_for_both_users():
    headers_alice, _ = register_and_login("carol", "carol@example.com")
    headers_bob, bob_user = register_and_login("dave", "dave@example.com")

    response = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["friend"]["name"] == "dave"
    assert payload["conversation_id"] > 0

    alice_friends = client.get("/api/chat/friends", headers=headers_alice)
    bob_friends = client.get("/api/chat/friends", headers=headers_bob)

    assert alice_friends.status_code == 200
    assert bob_friends.status_code == 200
    assert alice_friends.json()[0]["name"] == "dave"
    assert bob_friends.json()[0]["name"] == "carol"

    alice_sessions = client.get("/api/chat/sessions", headers=headers_alice)
    bob_sessions = client.get("/api/chat/sessions", headers=headers_bob)

    assert alice_sessions.status_code == 200
    assert bob_sessions.status_code == 200
    assert alice_sessions.json()[0]["title"] == "dave"
    assert bob_sessions.json()[0]["title"] == "carol"


def test_add_friend_upgrades_pending_request_to_accepted_friendship():
    headers_alice, _ = register_and_login("olivia", "olivia@example.com")
    headers_bob, bob_user = register_and_login("peter", "peter@example.com")

    request_res = client.post(
        "/api/chat/friends/requests",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    assert request_res.status_code == 200

    add_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    assert add_res.status_code == 200

    alice_friends = client.get("/api/chat/friends", headers=headers_alice)
    bob_friends = client.get("/api/chat/friends", headers=headers_bob)

    assert [friend["name"] for friend in alice_friends.json()] == ["peter"]
    assert [friend["name"] for friend in bob_friends.json()] == ["olivia"]


def test_send_and_read_messages():
    headers_alice, _ = register_and_login("eve", "eve@example.com")
    headers_bob, bob_user = register_and_login("frank", "frank@example.com")

    add_friend_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    conversation_id = add_friend_res.json()["conversation_id"]

    send_response = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": conversation_id, "content": "hello frank"},
        headers=headers_alice,
    )
    assert send_response.status_code == 200
    assert send_response.json()["message"]["text"] == "hello frank"

    bob_messages = client.get(f"/api/chat/sessions/{conversation_id}/messages", headers=headers_bob)

    assert bob_messages.status_code == 200
    messages = bob_messages.json()
    assert len(messages) == 1
    assert messages[0]["text"] == "hello frank"
    assert messages[0]["sender"] == "other"
    assert messages[0]["senderName"] == "eve"
    assert len(messages[0]["time"]) == 17
    assert messages[0]["time"][4] == "年"
    assert messages[0]["time"][7] == "月"
    assert messages[0]["time"][10] == "日"
    assert messages[0]["time"][14] == ":"

    alice_sessions = client.get("/api/chat/sessions", headers=headers_alice)
    assert alice_sessions.status_code == 200
    assert len(alice_sessions.json()[0]["time"]) == 17
    assert alice_sessions.json()[0]["time"][4] == "年"
    assert alice_sessions.json()[0]["time"][7] == "月"
    assert alice_sessions.json()[0]["time"][10] == "日"
    assert alice_sessions.json()[0]["time"][14] == ":"
    assert alice_sessions.json()[0]["lastMessage"] == "hello frank"


def test_send_message_response_time_matches_messages_list():
    headers_alice, _ = register_and_login("time_alice", "time_alice@example.com")
    headers_bob, bob_user = register_and_login("time_bob", "time_bob@example.com")

    add_friend_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    conversation_id = add_friend_res.json()["conversation_id"]

    send_response = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": conversation_id, "content": "time sync"},
        headers=headers_alice,
    )
    assert send_response.status_code == 200
    sent_time = send_response.json()["message"]["time"]

    read_response = client.get(f"/api/chat/sessions/{conversation_id}/messages", headers=headers_alice)
    assert read_response.status_code == 200
    assert len(read_response.json()) == 1
    assert read_response.json()[0]["time"] == sent_time

    sessions_response = client.get("/api/chat/sessions", headers=headers_alice)
    assert sessions_response.status_code == 200
    assert sessions_response.json()[0]["time"] == sent_time
    assert sessions_response.json()[0]["lastMessage"] == "time sync"


def test_sender_can_revoke_own_message():
    headers_alice, _ = register_and_login("revoke_alice", "revoke_alice@example.com")
    headers_bob, bob_user = register_and_login("revoke_bob", "revoke_bob@example.com")

    add_friend_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    conversation_id = add_friend_res.json()["conversation_id"]

    send_response = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": conversation_id, "content": "revoke me"},
        headers=headers_alice,
    )
    assert send_response.status_code == 200
    message_id = send_response.json()["message"]["id"]

    revoke_response = client.delete(f"/api/chat/messages/{message_id}", headers=headers_alice)
    assert revoke_response.status_code == 200
    assert revoke_response.json()["message_id"] == message_id

    read_response = client.get(f"/api/chat/sessions/{conversation_id}/messages", headers=headers_bob)
    assert read_response.status_code == 200
    assert read_response.json() == []


def test_non_sender_cannot_revoke_other_users_message():
    headers_alice, _ = register_and_login("revoke_guard_alice", "revoke_guard_alice@example.com")
    headers_bob, bob_user = register_and_login("revoke_guard_bob", "revoke_guard_bob@example.com")

    add_friend_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    conversation_id = add_friend_res.json()["conversation_id"]

    send_response = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": conversation_id, "content": "hands off"},
        headers=headers_alice,
    )
    assert send_response.status_code == 200
    message_id = send_response.json()["message"]["id"]

    revoke_response = client.delete(f"/api/chat/messages/{message_id}", headers=headers_bob)
    assert revoke_response.status_code == 403
    assert revoke_response.json()["detail"] == "Only the sender can revoke this message"

    read_response = client.get(f"/api/chat/sessions/{conversation_id}/messages", headers=headers_alice)
    assert read_response.status_code == 200
    assert len(read_response.json()) == 1
    assert read_response.json()[0]["id"] == message_id



def test_send_message_persists_reply_metadata():
    headers_alice, _ = register_and_login("reply_alice", "reply_alice@example.com")
    headers_bob, bob_user = register_and_login("reply_bob", "reply_bob@example.com")

    add_friend_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    conversation_id = add_friend_res.json()["conversation_id"]

    original_response = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": conversation_id, "content": "first message"},
        headers=headers_alice,
    )
    assert original_response.status_code == 200
    original_message = original_response.json()["message"]

    reply_response = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": conversation_id, "content": "reply message", "reply_to_id": original_message["id"]},
        headers=headers_bob,
    )
    assert reply_response.status_code == 200
    reply_message = reply_response.json()["message"]
    assert reply_message["replyToId"] == original_message["id"]
    assert reply_message["replyTo"]["id"] == original_message["id"]
    assert reply_message["replyTo"]["text"] == "first message"
    assert reply_message["replyTo"]["sender"] == "other"
    assert reply_message["replyTo"]["senderName"] == "reply_alice"

    read_response = client.get(f"/api/chat/sessions/{conversation_id}/messages", headers=headers_bob)
    assert read_response.status_code == 200
    messages = read_response.json()
    assert len(messages) == 2
    assert messages[1]["replyToId"] == original_message["id"]
    assert messages[1]["replyTo"]["text"] == "first message"
    assert messages[1]["replyTo"]["senderName"] == "reply_alice"


def test_send_image_message_persists_inline_media_data():
    headers_alice, _ = register_and_login("image_alice", "image_alice@example.com")
    headers_bob, bob_user = register_and_login("image_bob", "image_bob@example.com")

    add_friend_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    conversation_id = add_friend_res.json()["conversation_id"]

    png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDAT\x08\x99c\xf8\xcf"
        b"\xc0\x00\x00\x03\x01\x01\x00\xc9\xfe\x92\xef\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    response = client.post(
        "/api/chat/messages/send-image",
        params={"conversation_id": conversation_id},
        files={"file": ("pixel.png", io.BytesIO(png_bytes), "image/png")},
        headers=headers_alice,
    )

    assert response.status_code == 200
    sent_message = response.json()["message"]
    assert sent_message["type"] == "image"
    assert sent_message["mediaName"] == "pixel.png"
    assert sent_message["mediaUrl"].startswith("data:image/png;base64,")

    read_response = client.get(f"/api/chat/sessions/{conversation_id}/messages", headers=headers_bob)
    assert read_response.status_code == 200
    messages = read_response.json()
    assert len(messages) == 1
    assert messages[0]["mediaUrl"] == sent_message["mediaUrl"]


def test_reply_message_must_belong_to_same_conversation():
    headers_alice, _ = register_and_login("reply_guard_alice", "reply_guard_alice@example.com")
    headers_bob, bob_user = register_and_login("reply_guard_bob", "reply_guard_bob@example.com")
    headers_cathy, cathy_user = register_and_login("reply_guard_cathy", "reply_guard_cathy@example.com")

    first_conversation = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    second_conversation = client.post(
        "/api/chat/friends/add",
        json={"friend_id": cathy_user["id"]},
        headers=headers_alice,
    )
    first_conversation_id = first_conversation.json()["conversation_id"]
    second_conversation_id = second_conversation.json()["conversation_id"]

    original_response = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": first_conversation_id, "content": "source message"},
        headers=headers_alice,
    )
    assert original_response.status_code == 200
    original_message_id = original_response.json()["message"]["id"]

    reply_response = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": second_conversation_id, "content": "bad reply", "reply_to_id": original_message_id},
        headers=headers_alice,
    )
    assert reply_response.status_code == 400
    assert reply_response.json()["detail"] == "Reply message must belong to the same conversation"



def test_pin_session_only_affects_current_user_order():
    headers_alice, _ = register_and_login("pin_alice", "pin_alice@example.com")
    headers_bob, bob_user = register_and_login("pin_bob", "pin_bob@example.com")
    headers_cathy, cathy_user = register_and_login("pin_cathy", "pin_cathy@example.com")

    first_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    second_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": cathy_user["id"]},
        headers=headers_alice,
    )
    first_conversation_id = first_res.json()["conversation_id"]
    second_conversation_id = second_res.json()["conversation_id"]

    pin_res = client.post(f"/api/chat/sessions/{first_conversation_id}/pin", headers=headers_alice)
    assert pin_res.status_code == 200
    assert pin_res.json()["isPinned"] is True

    alice_sessions = client.get("/api/chat/sessions", headers=headers_alice)
    bob_sessions = client.get("/api/chat/sessions", headers=headers_bob)

    assert alice_sessions.status_code == 200
    assert alice_sessions.json()[0]["id"] == first_conversation_id
    assert alice_sessions.json()[0]["isPinned"] is True
    assert any(session["id"] == second_conversation_id and session["isPinned"] is False for session in alice_sessions.json())

    assert bob_sessions.status_code == 200
    assert bob_sessions.json()[0]["isPinned"] is False

    unpin_res = client.delete(f"/api/chat/sessions/{first_conversation_id}/pin", headers=headers_alice)
    assert unpin_res.status_code == 200
    assert unpin_res.json()["isPinned"] is False

    alice_sessions_after_unpin = client.get("/api/chat/sessions", headers=headers_alice)
    assert all(session["isPinned"] is False for session in alice_sessions_after_unpin.json())


def test_delete_friend_removes_friendship_and_private_session():
    headers_alice, _ = register_and_login("gina", "gina@example.com")
    headers_bob, bob_user = register_and_login("hank", "hank@example.com")

    add_friend_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    conversation_id = add_friend_res.json()["conversation_id"]

    delete_res = client.delete(f"/api/chat/friends/{bob_user['id']}", headers=headers_alice)
    assert delete_res.status_code == 200

    alice_friends = client.get("/api/chat/friends", headers=headers_alice)
    bob_friends = client.get("/api/chat/friends", headers=headers_bob)
    alice_sessions = client.get("/api/chat/sessions", headers=headers_alice)
    bob_sessions = client.get("/api/chat/sessions", headers=headers_bob)
    bob_messages = client.get(f"/api/chat/sessions/{conversation_id}/messages", headers=headers_bob)

    assert alice_friends.status_code == 200
    assert bob_friends.status_code == 200
    assert alice_friends.json() == []
    assert bob_friends.json() == []
    assert alice_sessions.json() == []
    assert bob_sessions.json() == []
    assert bob_messages.status_code == 403


def test_create_group_and_read_members():
    headers_alice, _ = register_and_login("mona", "mona@example.com")
    headers_bob, bob_user = register_and_login("nick", "nick@example.com")

    # MUST be friends to create group
    client.post("/api/chat/friends/add", json={"friend_id": bob_user["id"]}, headers=headers_alice)

    group_res = client.post(
        "/api/chat/groups",
        json={"name": "项目组", "member_ids": [bob_user["id"]]},
        headers=headers_alice,
    )
    assert group_res.status_code == 200
    conversation_id = group_res.json()["conversation_id"]

    alice_sessions = client.get("/api/chat/sessions", headers=headers_alice)
    bob_sessions = client.get("/api/chat/sessions", headers=headers_bob)
    group_members = client.get(f"/api/chat/groups/{conversation_id}/members", headers=headers_bob)

    assert any(session["title"] == "项目组" and session["isGroup"] for session in alice_sessions.json())
    assert any(session["title"] == "项目组" and session["isGroup"] for session in bob_sessions.json())
    assert group_members.status_code == 200
    assert group_members.json()[0]["role"] == "owner"
    assert group_members.json()[1]["name"] == "nick"


def test_group_owner_can_rename_group():
    headers_owner, _ = register_and_login("owner_rename", "owner_rename@example.com")
    headers_member, member_user = register_and_login("member_rename", "member_rename@example.com")

    # MUST be friends to create group
    client.post("/api/chat/friends/add", json={"friend_id": member_user["id"]}, headers=headers_owner)

    group_res = client.post(
        "/api/chat/groups",
        json={"name": "原群名", "member_ids": [member_user["id"]]},
        headers=headers_owner,
    )
    assert group_res.status_code == 200
    conversation_id = group_res.json()["conversation_id"]

    rename_res = client.put(
        f"/api/chat/groups/{conversation_id}",
        json={"name": "新群名"},
        headers=headers_owner,
    )
    assert rename_res.status_code == 200
    assert rename_res.json()["title"] == "新群名"

    owner_sessions = client.get("/api/chat/sessions", headers=headers_owner)
    member_sessions = client.get("/api/chat/sessions", headers=headers_member)
    assert any(session["title"] == "新群名" and session["isGroup"] for session in owner_sessions.json())
    assert any(session["title"] == "新群名" and session["isGroup"] for session in member_sessions.json())


def test_non_owner_cannot_rename_group():
    headers_owner, _ = register_and_login("owner_no_rename", "owner_no_rename@example.com")
    headers_member, member_user = register_and_login("member_no_rename", "member_no_rename@example.com")

    # MUST be friends to create group
    client.post("/api/chat/friends/add", json={"friend_id": member_user["id"]}, headers=headers_owner)

    group_res = client.post(
        "/api/chat/groups",
        json={"name": "不可改名群", "member_ids": [member_user["id"]]},
        headers=headers_owner,
    )
    assert group_res.status_code == 200
    conversation_id = group_res.json()["conversation_id"]

    rename_res = client.put(
        f"/api/chat/groups/{conversation_id}",
        json={"name": "成员改名"},
        headers=headers_member,
    )
    assert rename_res.status_code == 403
    assert rename_res.json()["detail"] == "Only group owner can rename group"


def test_rename_group_rejects_empty_name():
    headers_owner, _ = register_and_login("owner_empty_name", "owner_empty_name@example.com")
    headers_member, member_user = register_and_login("member_empty_name", "member_empty_name@example.com")

    # MUST be friends to create group
    client.post("/api/chat/friends/add", json={"friend_id": member_user["id"]}, headers=headers_owner)

    group_res = client.post(
        "/api/chat/groups",
        json={"name": "有名群", "member_ids": [member_user["id"]]},
        headers=headers_owner,
    )
    assert group_res.status_code == 200
    conversation_id = group_res.json()["conversation_id"]

    rename_res = client.put(
        f"/api/chat/groups/{conversation_id}",
        json={"name": "   "},
        headers=headers_owner,
    )
    assert rename_res.status_code == 400
    assert rename_res.json()["detail"] == "Group name cannot be empty"
