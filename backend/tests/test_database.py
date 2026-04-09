from app.database import DEFAULT_SQLITE_URL, get_engine_kwargs, normalize_database_url


def test_normalize_database_url_falls_back_to_sqlite():
    assert normalize_database_url(None) == DEFAULT_SQLITE_URL
    assert normalize_database_url("") == DEFAULT_SQLITE_URL


def test_normalize_database_url_adds_pymysql_driver():
    assert (
        normalize_database_url("mysql://root:123456@mysql-db:3306/whatthedogdoing")
        == "mysql+pymysql://root:123456@mysql-db:3306/whatthedogdoing"
    )


def test_get_engine_kwargs_for_sqlite_and_mysql():
    assert get_engine_kwargs("sqlite:///./whatthedogdoing.db") == {"connect_args": {"check_same_thread": False}}
    assert get_engine_kwargs("mysql+pymysql://root:123456@mysql-db:3306/whatthedogdoing") == {"pool_pre_ping": True}
