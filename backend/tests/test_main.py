from fastapi.testclient import TestClient
from app.main import app  # 导入你的 FastAPI 实例

client = TestClient(app)

def test_read_root():
    """测试根路径是否返回正确"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"Hello": "WhatTheDogDoing"}