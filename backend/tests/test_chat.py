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
    assert len(data) == 1
    assert data[0]["name"] == "bob"


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
