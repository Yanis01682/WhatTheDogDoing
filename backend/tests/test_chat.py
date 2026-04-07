import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import get_db
from app import models

TEST_DB_FILE = "./test_chat_real.db"

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

def test_read_sessions():
    """测试：读取会话接口 (空列表)"""
    response = client.get("/api/chat/sessions")
    assert response.status_code == 200
    assert response.json() == []

def test_add_friend_and_send_message_flow():
    """测试：完整的好友添加与消息发送流程"""
    client.post("/auth/register", json={"username": "alice_chat", "password": "pw"})
    client.post("/auth/register", json={"username": "bob_chat", "password": "pw"})
    client.post("/auth/register", json={"username": "eve_chat", "password": "pw"})
    
    res_alice = client.post("/auth/login", json={"username": "alice_chat", "password": "pw"})
    headers_alice = {"Authorization": f"Bearer {res_alice.json()['access_token']}"}
    
    res_bob = client.post("/auth/login", json={"username": "bob_chat", "password": "pw"})
    bob_id = res_bob.json()["user"]["id"]

    res_eve = client.post("/auth/login", json={"username": "eve_chat", "password": "pw"})
    headers_eve = {"Authorization": f"Bearer {res_eve.json()['access_token']}"}

    add_res = client.post(f"/api/chat/friends/add?friend_id={bob_id}", headers=headers_alice)
    assert add_res.status_code == 200
    conv_id = add_res.json()["conversation_id"]

    add_res_dup = client.post(f"/api/chat/friends/add?friend_id={bob_id}", headers=headers_alice)
    assert add_res_dup.status_code == 200

    send_res = client.post(
        f"/api/chat/messages/send?conversation_id={conv_id}&content=HelloBob", 
        headers=headers_alice
    )
    assert send_res.status_code == 200

    send_res_fail = client.post(
        f"/api/chat/messages/send?conversation_id={conv_id}&content=HackMessage", 
        headers=headers_eve
    )
    assert send_res_fail.status_code == 403