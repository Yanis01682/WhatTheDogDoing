from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .database import get_db
from . import models

router = APIRouter()

@router.get("/sessions")
def read_sessions(db: Session = Depends(get_db)):
    # 先查数据库里的会话
    sessions = db.query(models.ChatSession).all()
    return sessions