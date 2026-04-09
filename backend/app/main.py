# backend/app/main.py
import logging
import time

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from .auth import router as auth_router, get_current_user
from .chat import router as chat_router
from .database import engine, get_db
from . import models
from .models import User
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

app = FastAPI(title="WhatTheDogDoing API")

# backend/app/main.py

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # 增加下面这些，确保包含全小写版本，且没有末尾斜杠
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


@app.on_event("startup")
def initialize_database():
    last_error = None

    for attempt in range(1, 21):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            models.Base.metadata.create_all(bind=engine)
            logger.info("Database initialized successfully on attempt %s", attempt)
            return
        except SQLAlchemyError as exc:
            last_error = exc
            logger.warning("Database not ready on startup attempt %s/20: %s", attempt, exc)
            time.sleep(3)

    raise RuntimeError("Database initialization failed after multiple retries") from last_error

@app.delete("/api/users/me")
def delete_account(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted successfully"}

app.include_router(auth_router)
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
