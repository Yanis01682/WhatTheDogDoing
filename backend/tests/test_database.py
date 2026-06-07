from app.database import DEFAULT_SQLITE_URL, get_db, get_engine_kwargs, normalize_database_url


def test_normalize_database_url_falls_back_to_sqlite():
    assert normalize_database_url(None) == DEFAULT_SQLITE_URL
    assert normalize_database_url("") == DEFAULT_SQLITE_URL
    assert normalize_database_url("   ") == DEFAULT_SQLITE_URL


def test_normalize_database_url_adds_pymysql_driver():
    assert (
        normalize_database_url("mysql://user:password@db:3306/aegis")
        == "mysql+pymysql://user:password@db:3306/aegis"
    )


def test_get_engine_kwargs_for_sqlite_and_mysql():
    assert get_engine_kwargs("sqlite:///./whatthedogdoing.db") == {"connect_args": {"check_same_thread": False}}
    assert get_engine_kwargs("mysql+pymysql://user:password@db:3306/aegis") == {"pool_pre_ping": True}


def test_get_db_closes_session(monkeypatch):
    closed = {"value": False}

    class DummySession:
        def close(self):
            closed["value"] = True

    monkeypatch.setattr("app.database.SessionLocal", lambda: DummySession())

    gen = get_db()
    session = next(gen)
    assert isinstance(session, DummySession)

    try:
        next(gen)
    except StopIteration:
        pass

    assert closed["value"] is True
