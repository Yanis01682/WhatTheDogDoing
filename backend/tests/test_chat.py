import io

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import chat
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


def test_moments_feed_like_comment_and_public_visibility():
    headers_alice, _ = register_and_login("moment_alice", "moment_alice@example.com")
    headers_bob, bob_user = register_and_login("moment_bob", "moment_bob@example.com")
    headers_cara, _ = register_and_login("moment_cara", "moment_cara@example.com")

    request_res = client.post(
        "/api/chat/friends/requests",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    assert request_res.status_code == 200
    client.post(f"/api/chat/friends/requests/{request_res.json()['id']}/accept", headers=headers_bob)

    create_res = client.post(
        "/api/chat/moments",
        json={"content": "今天在城墙上巡夜。", "image_url": "data:image/png;base64,AA=="},
        headers=headers_alice,
    )
    assert create_res.status_code == 200
    post_id = create_res.json()["id"]
    assert create_res.json()["imageUrl"] == "data:image/png;base64,AA=="

    bob_feed = client.get("/api/chat/moments", headers=headers_bob)
    assert bob_feed.status_code == 200
    assert bob_feed.json()[0]["content"] == "今天在城墙上巡夜。"

    like_res = client.post(f"/api/chat/moments/{post_id}/like", headers=headers_bob)
    assert like_res.status_code == 200
    assert like_res.json()["likedByMe"] is True
    assert like_res.json()["likes"][0]["name"] == "moment_bob"

    comment_res = client.post(
        f"/api/chat/moments/{post_id}/comments",
        json={"content": "收到，晨钟前换岗。"},
        headers=headers_bob,
    )
    assert comment_res.status_code == 200
    assert comment_res.json()["comments"][0]["content"] == "收到，晨钟前换岗。"

    cara_feed = client.get("/api/chat/moments", headers=headers_cara)
    assert cara_feed.status_code == 200
    assert cara_feed.json()[0]["id"] == post_id
    denied = client.post(f"/api/chat/moments/{post_id}/like", headers=headers_cara)
    assert denied.status_code == 200
    assert denied.json()["likedByMe"] is True


def test_moment_image_upload_returns_data_url():
    headers_alice, _ = register_and_login("moment_upload_alice", "moment_upload_alice@example.com")

    upload_res = client.post(
        "/api/chat/moments/upload-image",
        files={"file": ("echo.png", b"\x89PNG\r\n\x1a\n", "image/png")},
        headers=headers_alice,
    )

    assert upload_res.status_code == 200
    assert upload_res.json()["imageUrl"].startswith("data:image/png;base64,")


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


def test_tic_tac_toe_invite_accept_move_and_resign():
    headers_alice, _ = register_and_login("ttt_alice", "ttt_alice@example.com")
    headers_bob, bob_user = register_and_login("ttt_bob", "ttt_bob@example.com")
    add_friend_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    conversation_id = add_friend_res.json()["conversation_id"]

    invite_res = client.post(
        "/api/chat/games/tictactoe/invite",
        json={"conversation_id": conversation_id},
        headers=headers_alice,
    )
    assert invite_res.status_code == 200
    game = invite_res.json()
    assert game["status"] == "pending"
    assert game["currentUserMark"] == "X"

    bob_active = client.get(
        f"/api/chat/games/tictactoe/active?conversation_id={conversation_id}",
        headers=headers_bob,
    )
    assert bob_active.status_code == 200
    assert bob_active.json()["currentUserMark"] == "O"

    messages_res = client.get(f"/api/chat/sessions/{conversation_id}/messages", headers=headers_bob)
    assert messages_res.status_code == 200
    assert messages_res.json()[-1]["type"] == "game"
    assert messages_res.json()[-1]["gameData"]["gameId"] == game["id"]

    accept_res = client.post(f"/api/chat/games/tictactoe/{game['id']}/accept", headers=headers_bob)
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "active"

    out_of_turn = client.post(
        f"/api/chat/games/tictactoe/{game['id']}/move",
        json={"index": 0},
        headers=headers_bob,
    )
    assert out_of_turn.status_code == 400

    first_move = client.post(
        f"/api/chat/games/tictactoe/{game['id']}/move",
        json={"index": 0},
        headers=headers_alice,
    )
    assert first_move.status_code == 200
    assert first_move.json()["board"][0] == "X"

    resign_res = client.post(f"/api/chat/games/tictactoe/{game['id']}/resign", headers=headers_bob)
    assert resign_res.status_code == 200
    assert resign_res.json()["status"] == "x_win"


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


def test_sessions_badge_reflects_unread_messages_and_clears_after_read():
    headers_alice, _ = register_and_login("badge_alice", "badge_alice@example.com")
    headers_bob, bob_user = register_and_login("badge_bob", "badge_bob@example.com")

    add_friend_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    conversation_id = add_friend_res.json()["conversation_id"]

    initial_bob_sessions = client.get("/api/chat/sessions", headers=headers_bob)
    assert initial_bob_sessions.status_code == 200
    assert initial_bob_sessions.json()[0]["badge"] == 0

    send_response = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": conversation_id, "content": "unread check"},
        headers=headers_alice,
    )
    assert send_response.status_code == 200

    unread_bob_sessions = client.get("/api/chat/sessions", headers=headers_bob)
    assert unread_bob_sessions.status_code == 200
    assert unread_bob_sessions.json()[0]["badge"] == 1

    read_response = client.get(f"/api/chat/sessions/{conversation_id}/messages", headers=headers_bob)
    assert read_response.status_code == 200

    cleared_bob_sessions = client.get("/api/chat/sessions", headers=headers_bob)
    assert cleared_bob_sessions.status_code == 200
    assert cleared_bob_sessions.json()[0]["badge"] == 0


def test_muted_session_hides_unread_badge():
    headers_alice, _ = register_and_login("mute_alice", "mute_alice@example.com")
    headers_bob, bob_user = register_and_login("mute_bob", "mute_bob@example.com")

    add_friend_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    conversation_id = add_friend_res.json()["conversation_id"]

    mute_res = client.put(
        f"/api/chat/sessions/{conversation_id}/mute",
        json={"muted": True},
        headers=headers_bob,
    )
    assert mute_res.status_code == 200
    assert mute_res.json()["isMuted"] is True

    send_response = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": conversation_id, "content": "muted unread"},
        headers=headers_alice,
    )
    assert send_response.status_code == 200

    muted_sessions = client.get("/api/chat/sessions", headers=headers_bob)
    assert muted_sessions.status_code == 200
    assert muted_sessions.json()[0]["badge"] == 0
    assert muted_sessions.json()[0]["isMuted"] is True


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


def test_send_forward_message_notifies_with_object_forward_data(monkeypatch):
    headers_alice, _ = register_and_login("forward_alice", "forward_alice@example.com")
    headers_bob, bob_user = register_and_login("forward_bob", "forward_bob@example.com")

    add_friend_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    conversation_id = add_friend_res.json()["conversation_id"]
    captured_notifications = []

    def capture_notification(user_ids, payload):
        captured_notifications.append((user_ids, payload))

    monkeypatch.setattr(chat, "_dispatch_notification", capture_notification)

    response = client.post(
        "/api/chat/messages/send-forward",
        json={
            "conversation_id": conversation_id,
            "forward_title": "alice和bob的聊天记录",
            "forward_messages": [
                {"senderName": "alice", "text": "hello", "type": "text", "time": "2026年05月28日 16:00"},
            ],
        },
        headers=headers_alice,
    )

    assert response.status_code == 200
    assert response.json()["message"]["forwardData"]["title"] == "alice和bob的聊天记录"
    assert captured_notifications
    notified_message = captured_notifications[0][1]["message"]
    assert isinstance(notified_message["forwardData"], dict)
    assert notified_message["forwardData"]["messages"][0]["text"] == "hello"


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


def test_translate_message_uses_ai_gateway(monkeypatch):
    headers_alice, _ = register_and_login("translate_alice", "translate_alice@example.com")
    headers_bob, bob_user = register_and_login("translate_bob", "translate_bob@example.com")
    add_friend_res = client.post(
        "/api/chat/friends/add",
        json={"friend_id": bob_user["id"]},
        headers=headers_alice,
    )
    conversation_id = add_friend_res.json()["conversation_id"]
    send_response = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": conversation_id, "content": "oath received"},
        headers=headers_alice,
    )
    message_id = send_response.json()["message"]["id"]
    monkeypatch.setattr(chat.ai_gateway, "translate_text", lambda text, target: "誓约已收到")

    response = client.post(
        f"/api/chat/messages/{message_id}/translate",
        json={"target_language": "简体中文"},
        headers=headers_bob,
    )

    assert response.status_code == 200
    assert response.json()["translation"] == "誓约已收到"
    assert response.json()["source"] == "oath received"


def test_group_bot_replies_when_mentioned(monkeypatch):
    headers_alice, _ = register_and_login("bot_alice", "bot_alice@example.com")
    headers_bob, bob_user = register_and_login("bot_bob", "bot_bob@example.com")
    client.post("/api/chat/friends/add", json={"friend_id": bob_user["id"]}, headers=headers_alice)
    group_res = client.post(
        "/api/chat/groups",
        json={"name": "誓约厅", "member_ids": [bob_user["id"]]},
        headers=headers_alice,
    )
    conversation_id = group_res.json()["conversation_id"]
    monkeypatch.setattr(chat.ai_gateway, "answer_group_prompt", lambda prompt, context: f"记录如下：{prompt}")

    send_response = client.post(
        "/api/chat/messages/send",
        json={"conversation_id": conversation_id, "content": "@誓约书记 今天怎么安排？"},
        headers=headers_alice,
    )
    assert send_response.status_code == 200
    messages_response = client.get(f"/api/chat/sessions/{conversation_id}/messages", headers=headers_bob)

    messages = messages_response.json()
    assert messages[-1]["type"] == "bot"
    assert messages[-1]["senderName"] == "誓约书记"
    assert messages[-1]["text"] == "记录如下：今天怎么安排？"


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
