from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .database import get_db

router = APIRouter()

@router.get("/sessions")
def read_sessions(db: Session = Depends(get_db)):
    # ChatSession not yet implemented, return empty list
    return []