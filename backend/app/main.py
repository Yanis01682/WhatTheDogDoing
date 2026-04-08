# backend/app/main.py
import time
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

from .auth import router as auth_router, get_current_user
from .chat import router as chat_router
from .database import engine, get_db
from . import models

app = FastAPI(title="WhatTheDogDoing API")

# 【核心修复】：解决后端比数据库启动快导致的崩溃死锁问题
@app.on_event("startup")
def startup_db_client():
    retries = 10  # 最多重试10次，每次等3秒
    while retries > 0:
        try:
            models.Base.metadata.create_all(bind=engine)
            print("Successfully connected to the database and created tables.")
            break
        except OperationalError:
            print(f"Database not ready yet, retrying... ({retries} attempts left)")
            retries -= 1
            time.sleep(3)
    if retries == 0:
        print("WARNING: Failed to connect to the database after multiple attempts.")

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