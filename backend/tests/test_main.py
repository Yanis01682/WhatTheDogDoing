from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_root():
    """测试：根路径访问正常"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"Hello": "WhatTheDogDoing"}

def test_health_check():
    """测试：健康检查接口"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}