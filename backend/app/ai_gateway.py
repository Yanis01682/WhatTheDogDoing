import os
from typing import Any

import httpx
from fastapi import HTTPException

SILICONFLOW_CHAT_URL = "https://api.siliconflow.cn/v1/chat/completions"
DEFAULT_MODEL = "Qwen/Qwen2.5-7B-Instruct"
BOT_NAME = "露恩"
BOT_ALIASES = ("@露恩", "@Lune")
CONFIG_FILE_CANDIDATES = (
    "/config/SILICONFLOW_API_KEY",
    "/config/siliconflow_api_key",
    "/config/config",
    "/opt/app/config/SILICONFLOW_API_KEY",
    "/opt/app/config/siliconflow_api_key",
    "/opt/app/config/config",
)


def _read_config_value(name: str) -> str:
    configured_path = os.getenv(f"{name}_FILE", "").strip()
    candidate_paths = [configured_path] if configured_path else []
    if name == "SILICONFLOW_API_KEY":
        candidate_paths.extend(CONFIG_FILE_CANDIDATES)

    for path in candidate_paths:
        if not path:
            continue
        try:
            content = open(path, encoding="utf-8").read().strip()
        except OSError:
            continue
        if not content:
            continue
        for line in content.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if "=" in stripped:
                key, value = stripped.split("=", 1)
                if key.strip() == name:
                    return value.strip().strip('"').strip("'")
            elif name == "SILICONFLOW_API_KEY":
                return stripped
    return ""


def _get_api_key() -> str:
    api_key = os.getenv("SILICONFLOW_API_KEY", "").strip() or _read_config_value("SILICONFLOW_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="SiliconFlow API key is not configured")
    return api_key


def _chat_completion(messages: list[dict[str, str]], *, temperature: float = 0.3, max_tokens: int = 600) -> str:
    api_key = _get_api_key()
    url = os.getenv("SILICONFLOW_CHAT_URL", SILICONFLOW_CHAT_URL).strip() or SILICONFLOW_CHAT_URL
    model = os.getenv("SILICONFLOW_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    timeout = float(os.getenv("SILICONFLOW_TIMEOUT", "30"))

    try:
        response = httpx.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": False,
            },
            timeout=timeout,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:300] if exc.response is not None else str(exc)
        raise HTTPException(status_code=502, detail=f"SiliconFlow request failed: {detail}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="SiliconFlow request failed") from exc

    data: dict[str, Any] = response.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="SiliconFlow returned an invalid response") from exc

    return str(content).strip()


def translate_text(text: str, target_language: str = "简体中文") -> str:
    source = text.strip()
    if not source:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    return _chat_completion(
        [
            {
                "role": "system",
                "content": (
                    "你是 Aegis 通讯系统里的转译助手。只输出译文，不要解释、不要加引号。"
                    "保留人名、群名、代码、URL、表情和原有换行。"
                ),
            },
            {
                "role": "user",
                "content": f"请将下面内容翻译为{target_language}：\n\n{source}",
            },
        ],
        temperature=0.2,
        max_tokens=800,
    )


def mentions_bot(content: str) -> bool:
    return any(alias in content for alias in BOT_ALIASES)


def clean_bot_prompt(content: str) -> str:
    prompt = content
    for alias in BOT_ALIASES:
        prompt = prompt.replace(alias, "")
    return prompt.strip(" \n\t，,。:：")


def answer_group_prompt(prompt: str, context: list[dict[str, str]] | None = None) -> str:
    question = prompt.strip() or "请根据当前群聊上下文给大家一个简短回应。"
    context_lines = []
    for item in context or []:
        sender = item.get("sender", "群成员")
        text = item.get("text", "")
        if text:
            context_lines.append(f"{sender}: {text}")
    context_text = "\n".join(context_lines[-8:])

    return _chat_completion(
        [
            {
                "role": "system",
                "content": (
                    f"你是 Aegis 群聊中的默认助手「{BOT_NAME}」。"
                    "你的语气温和、可靠，带一点剑与骑士世界的清爽感，但不要中二或堆设定。"
                    "默认用中文，除非用户要求其他语言。控制在 3 到 6 句话。"
                ),
            },
            {
                "role": "user",
                "content": f"最近群聊上下文：\n{context_text or '暂无'}\n\n被 @ 的问题：\n{question}",
            },
        ],
        temperature=0.45,
        max_tokens=700,
    )
