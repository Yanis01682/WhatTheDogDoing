# backend/app/main.py
from fastapi import FastAPI
from .auth import router as auth_router
from .chat import router as chat_router

# 引入数据库配置和模型，用于启动时自动建表
# 注意：前提是你按照上面的建议创建了 database.py
from .database import engine
from . import models

# 自动在数据库中生成 models.py 里定义的表 (如 users, messages)
models.Base.metadata.create_all(bind=engine)

# 初始化 FastAPI 实例
app = FastAPI(title="WhatTheDogDoing API")

# 根路由测试
@app.get("/")
def read_root():
    return {"Hello": "WhatTheDogDoing"}

# 挂载你的用户认证路由
app.include_router(auth_router)
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])

# 以后 wjq 写好消息模块后，也可以继续在这里挂载他的路由，例如：
# from .messages import router as msg_router
# app.include_router(msg_router)