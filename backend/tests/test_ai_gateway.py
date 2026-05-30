import httpx
import pytest
from fastapi import HTTPException

from app import ai_gateway


def test_read_config_value_reads_key_value_file(tmp_path, monkeypatch):
    config = tmp_path / "siliconflow.conf"
    config.write_text("\n# comment\nSILICONFLOW_API_KEY='from-file'\n", encoding="utf-8")
    monkeypatch.setenv("SILICONFLOW_API_KEY_FILE", str(config))

    assert ai_gateway._read_config_value("SILICONFLOW_API_KEY") == "from-file"


def test_read_config_value_reads_plain_key_and_skips_missing(tmp_path, monkeypatch):
    missing = tmp_path / "missing"
    config = tmp_path / "plain-key"
    config.write_text("\nplain-from-file\n", encoding="utf-8")
    monkeypatch.setenv("SILICONFLOW_API_KEY_FILE", str(missing))
    monkeypatch.setattr(ai_gateway, "CONFIG_FILE_CANDIDATES", (str(config),))

    assert ai_gateway._read_config_value("SILICONFLOW_API_KEY") == "plain-from-file"


def test_get_api_key_raises_when_unconfigured(monkeypatch):
    monkeypatch.delenv("SILICONFLOW_API_KEY", raising=False)
    monkeypatch.delenv("SILICONFLOW_API_KEY_FILE", raising=False)
    monkeypatch.setattr(ai_gateway, "CONFIG_FILE_CANDIDATES", ())

    with pytest.raises(HTTPException) as exc:
        ai_gateway._get_api_key()

    assert exc.value.status_code == 503


def test_chat_completion_posts_expected_payload(monkeypatch):
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "  好的  "}}]}

    def fake_post(url, headers, json, timeout):
        captured.update(url=url, headers=headers, json=json, timeout=timeout)
        return FakeResponse()

    monkeypatch.setenv("SILICONFLOW_API_KEY", "test-key")
    monkeypatch.setenv("SILICONFLOW_CHAT_URL", "https://example.test/chat")
    monkeypatch.setenv("SILICONFLOW_MODEL", "model-name")
    monkeypatch.setenv("SILICONFLOW_TIMEOUT", "3.5")
    monkeypatch.setattr(ai_gateway.httpx, "post", fake_post)

    result = ai_gateway._chat_completion([{"role": "user", "content": "hi"}], temperature=0.1, max_tokens=9)

    assert result == "好的"
    assert captured["url"] == "https://example.test/chat"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["json"]["model"] == "model-name"
    assert captured["json"]["temperature"] == 0.1
    assert captured["json"]["max_tokens"] == 9
    assert captured["timeout"] == 3.5


def test_chat_completion_maps_provider_errors(monkeypatch):
    request = httpx.Request("POST", "https://example.test/chat")
    response = httpx.Response(500, text="provider down", request=request)

    class FakeResponse:
        def raise_for_status(self):
            raise httpx.HTTPStatusError("bad", request=request, response=response)

    monkeypatch.setenv("SILICONFLOW_API_KEY", "test-key")
    monkeypatch.setattr(ai_gateway.httpx, "post", lambda *args, **kwargs: FakeResponse())

    with pytest.raises(HTTPException) as exc:
        ai_gateway._chat_completion([{"role": "user", "content": "hi"}])

    assert exc.value.status_code == 502
    assert "provider down" in exc.value.detail


def test_chat_completion_rejects_invalid_provider_payload(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": []}

    monkeypatch.setenv("SILICONFLOW_API_KEY", "test-key")
    monkeypatch.setattr(ai_gateway.httpx, "post", lambda *args, **kwargs: FakeResponse())

    with pytest.raises(HTTPException) as exc:
        ai_gateway._chat_completion([{"role": "user", "content": "hi"}])

    assert exc.value.status_code == 502
    assert "invalid response" in exc.value.detail


def test_chat_completion_maps_transport_errors(monkeypatch):
    monkeypatch.setenv("SILICONFLOW_API_KEY", "test-key")
    monkeypatch.setattr(
        ai_gateway.httpx,
        "post",
        lambda *args, **kwargs: (_ for _ in ()).throw(httpx.ConnectError("no route")),
    )

    with pytest.raises(HTTPException) as exc:
        ai_gateway._chat_completion([{"role": "user", "content": "hi"}])

    assert exc.value.status_code == 502


def test_translate_text_builds_prompt_and_rejects_empty(monkeypatch):
    captured = {}

    def fake_chat(messages, *, temperature, max_tokens):
        captured.update(messages=messages, temperature=temperature, max_tokens=max_tokens)
        return "translated"

    monkeypatch.setattr(ai_gateway, "_chat_completion", fake_chat)

    assert ai_gateway.translate_text(" hello ", "English") == "translated"
    assert captured["temperature"] == 0.2
    assert captured["max_tokens"] == 800
    assert "English" in captured["messages"][1]["content"]

    with pytest.raises(HTTPException) as exc:
        ai_gateway.translate_text("   ")

    assert exc.value.status_code == 400


def test_bot_prompt_helpers_and_context(monkeypatch):
    captured = {}

    def fake_chat(messages, *, temperature, max_tokens):
        captured.update(messages=messages, temperature=temperature, max_tokens=max_tokens)
        return "answer"

    monkeypatch.setattr(ai_gateway, "_chat_completion", fake_chat)
    context = [{"sender": f"u{i}", "text": f"m{i}"} for i in range(10)]

    assert ai_gateway.mentions_bot("hi @Lune")
    assert ai_gateway.clean_bot_prompt("@露恩： 请总结 ") == "请总结"
    assert ai_gateway.answer_group_prompt("  ", context) == "answer"
    assert "u2: m2" in captured["messages"][1]["content"]
    assert "u1: m1" not in captured["messages"][1]["content"]
    assert captured["temperature"] == 0.45
    assert captured["max_tokens"] == 700
