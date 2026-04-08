# backend/app/main.py
import time
import threading  # 1. 引入 threading 模块
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .auth import router as auth_router, get_current_user
from .chat import router as chat_router
from .database import engine, get_db
from . import models

app = FastAPI(title="WhatTheDogDoing API")

@app.on_event("startup")
def startup_db_client():
    # 2. 将原本阻塞主线程的代码封装进一个内部函数
    def init_db():
        retries = 30  
        while retries > 0:
            try:
                models.Base.metadata.create_all(bind=engine)
                print("Successfully connected to the database and created tables.")
                break
            except Exception as e:
                print(f"Database not ready yet, retrying... ({retries} attempts left). Error: {e}")
                retries -= 1
                time.sleep(5)
        if retries == 0:
            print("WARNING: Failed to connect to the database after multiple attempts.")
            
    # 3. 开启后台线程执行数据库初始化，立刻放行主线程！
    threading.Thread(target=init_db, daemon=True).start()

# ... 下方 app.add_middleware 及后续路由代码保持完全不变 ...

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://frontend-dyno-whatthedogdoing.app.spring26b.secoder.net",
        "https://frontend-dyno-WhatTheDogDoing.app.spring26b.secoder.net",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.get("/")
def read_root():
    return {"Hello": "WhatTheDogDoing"}

@app.get("/health")
def health():
    return {"status": "ok"}

class DeleteAccountRequest(BaseModel):
    password: str

@app.delete("/api/users/me")
def delete_account(payload: DeleteAccountRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    from .auth import verify_password
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="密码错误")
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted successfully"}

app.include_router(auth_router)
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])