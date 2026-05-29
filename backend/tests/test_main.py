from types import SimpleNamespace

from fastapi.testclient import TestClient
from app import main
from app.main import app  # 导入你的 FastAPI 实例

client = TestClient(app)

def test_read_root():
    """测试根路径是否返回正确"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"Hello": "Aegis"}


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_initialize_database_runs_sqlite_migrations(monkeypatch):
    executed_sql = []
    missing_selects = {
        "SELECT status FROM users LIMIT 1",
        "SELECT nickname FROM users LIMIT 1",
        "SELECT gender FROM users LIMIT 1",
        "SELECT phone FROM users LIMIT 1",
        "SELECT bio FROM users LIMIT 1",
        "SELECT last_status FROM users LIMIT 1",
        "SELECT avatar FROM users LIMIT 1",
        "SELECT reply_to_id FROM messages LIMIT 1",
        "SELECT message_type FROM messages LIMIT 1",
        "SELECT media_url FROM messages LIMIT 1",
        "SELECT media_data FROM messages LIMIT 1",
        "SELECT media_name FROM messages LIMIT 1",
        "SELECT mentioned_user_ids FROM messages LIMIT 1",
        "SELECT remark FROM friendships LIMIT 1",
        "SELECT read_index FROM conversation_members LIMIT 1",
        "SELECT role FROM conversation_members LIMIT 1",
        "SELECT group_nickname FROM conversation_members LIMIT 1",
        "SELECT is_group FROM conversations LIMIT 1",
        "SELECT 1 FROM conversation_pins LIMIT 1",
    }

    class FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, statement):
            sql = str(statement)
            executed_sql.append(sql)
            if sql in missing_selects:
                raise Exception("missing")

        def commit(self):
            executed_sql.append("COMMIT")

    class FakeEngine:
        dialect = SimpleNamespace(name="sqlite")

        def connect(self):
            return FakeConnection()

    monkeypatch.setattr(main, "engine", FakeEngine())
    monkeypatch.setattr(main.models.Base.metadata, "create_all", lambda bind: executed_sql.append("CREATE_ALL"))
    monkeypatch.setattr(main.time, "sleep", lambda _seconds: None)

    main.initialize_database()

    assert "CREATE_ALL" in executed_sql
    assert any("ALTER TABLE users ADD COLUMN status" in sql for sql in executed_sql)
    assert any("ALTER TABLE messages ADD COLUMN media_data TEXT" in sql for sql in executed_sql)
    assert any("ALTER TABLE messages ADD COLUMN mentioned_user_ids" in sql for sql in executed_sql)
    assert any("ALTER TABLE conversation_members ADD COLUMN role" in sql for sql in executed_sql)
    assert any("CREATE TABLE conversation_pins" in sql for sql in executed_sql)
