# backend/app/main.py
import logging
import time
import os

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import or_, text
from sqlalchemy.exc import SQLAlchemyError
from .auth import UserStatus, router as auth_router, get_current_user
from .chat import router as chat_router
from .database import engine, get_db
from . import models
from .models import User
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

app = FastAPI(title="WhatTheDogDoing API")

# backend/app/main.py

# 挂载静态文件目录（用于上传的图片）
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Hello": "WhatTheDogDoing"}

@app.get("/health")
def health():
    return {"status": "ok"}


def _delete_conversation_with_related_data(db: Session, conversation_id: int):
    db.query(models.ConversationPin).filter(models.ConversationPin.conversation_id == conversation_id).delete()
    db.query(models.Message).filter(models.Message.conversation_id == conversation_id).delete()
    db.query(models.ConversationMember).filter(models.ConversationMember.conversation_id == conversation_id).delete()
    db.query(models.Conversation).filter(models.Conversation.id == conversation_id).delete()


@app.on_event("startup")
def initialize_database():
    last_error = None

    for attempt in range(1, 21):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            models.Base.metadata.create_all(bind=engine)
            # 兼容旧数据库：若 users.status 列不存在则补加
            with engine.connect() as connection:
                try:
                    connection.execute(text("SELECT status FROM users LIMIT 1"))
                except Exception:
                    connection.execute(text("ALTER TABLE users ADD COLUMN status VARCHAR(32) DEFAULT 'offline'"))
                    connection.commit()
                    logger.info("Migrated: added users.status column")
            with engine.connect() as connection:
                for col, definition in [
                    ("nickname", "VARCHAR(64)"),
                    ("gender", "VARCHAR(16)"),
                    ("phone", "VARCHAR(32)"),
                    ("bio", "VARCHAR(500)"),
                ]:
                    try:
                        connection.execute(text(f"SELECT {col} FROM users LIMIT 1"))
                    except Exception:
                        connection.execute(text(f"ALTER TABLE users ADD COLUMN {col} {definition}"))
                        connection.commit()
                        logger.info("Migrated: added users.%s column", col)
            with engine.connect() as connection:
                try:
                    connection.execute(text("SELECT reply_to_id FROM messages LIMIT 1"))
                except Exception:
                    connection.execute(text("ALTER TABLE messages ADD COLUMN reply_to_id INTEGER"))
                    connection.commit()
                    logger.info("Migrated: added messages.reply_to_id column")
            logger.info("Database initialized successfully on attempt %s", attempt)
            return
        except SQLAlchemyError as exc:
            last_error = exc
            logger.warning("Database not ready on startup attempt %s/20: %s", attempt, exc)
            time.sleep(3)

    raise RuntimeError("Database initialization failed after multiple retries") from last_error

@app.delete("/api/users/me")
def delete_account(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memberships = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.user_id == current_user.id)
        .all()
    )

    private_conversation_ids = []
    group_conversation_ids = []
    for membership in memberships:
        conversation = (
            db.query(models.Conversation)
            .filter(models.Conversation.id == membership.conversation_id)
            .first()
        )
        if not conversation:
            continue
        if conversation.is_group:
            group_conversation_ids.append(conversation.id)
        else:
            private_conversation_ids.append(conversation.id)

    for conversation_id in set(private_conversation_ids):
        _delete_conversation_with_related_data(db, conversation_id)

    db.query(models.Friendship).filter(
        or_(
            models.Friendship.user_id == current_user.id,
            models.Friendship.friend_id == current_user.id,
        )
    ).delete()

    db.query(models.ConversationPin).filter(models.ConversationPin.user_id == current_user.id).delete()
    db.query(models.Message).filter(models.Message.sender_id == current_user.id).delete()
    db.query(models.ConversationMember).filter(models.ConversationMember.user_id == current_user.id).delete()

    for conversation_id in set(group_conversation_ids):
        remaining_member_count = (
            db.query(models.ConversationMember)
            .filter(models.ConversationMember.conversation_id == conversation_id)
            .count()
        )
        if remaining_member_count == 0:
            _delete_conversation_with_related_data(db, conversation_id)

    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted successfully"}

@app.put("/api/users/me/status")
def update_status(
    new_status: UserStatus, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 更新状态
    current_user.status = new_status
    db.commit()
    db.refresh(current_user)
    return {"status": current_user.status}

app.include_router(auth_router)
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
