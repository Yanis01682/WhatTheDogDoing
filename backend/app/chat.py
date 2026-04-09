from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import get_db
from typing import List
from app import models, auth

router = APIRouter()

@router.get("/sessions")
def read_sessions(db: Session = Depends(get_db)):
    # ChatSession not yet implemented, return empty list
    return []

@router.post("/friends/add")
def add_friend(friend_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    existing = db.query(models.Friendship).filter(
        models.Friendship.user_id == current_user.id,
        models.Friendship.friend_id == friend_id
    ).first()
    if existing:
        return {"message": "Already friends"}

    new_friendship = models.Friendship(user_id=current_user.id, friend_id=friend_id, status="accepted")
    db.add(new_friendship)
    
    new_conv = models.Conversation(is_group=False, name=f"Chat between {current_user.id} and {friend_id}")
    db.add(new_conv)
    db.flush() # 获取新对话的 ID

    member1 = models.ConversationMember(conversation_id=new_conv.id, user_id=current_user.id)
    member2 = models.ConversationMember(conversation_id=new_conv.id, user_id=friend_id)
    db.add_all([member1, member2])
    
    db.commit()
    return {"message": "Friend added and conversation created", "conversation_id": new_conv.id}

@router.post("/messages/send")
def send_message(conversation_id: int, content: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    is_member = db.query(models.ConversationMember).filter(
        models.ConversationMember.conversation_id == conversation_id,
        models.ConversationMember.user_id == current_user.id
    ).first()
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    new_msg = models.Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=content
    )
    db.add(new_msg)
    db.commit()
    return {"status": "sent"}