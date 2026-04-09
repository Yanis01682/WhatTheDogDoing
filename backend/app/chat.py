from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import auth, models
from .database import get_db

router = APIRouter()


class FriendAddPayload(BaseModel):
    friend_id: int


class MessageSendPayload(BaseModel):
    conversation_id: int
    content: str


def _get_private_conversation_between(db: Session, user_a_id: int, user_b_id: int):
    conversations = (
        db.query(models.Conversation)
        .filter(models.Conversation.is_group.is_(False))
        .all()
    )

    for conversation in conversations:
        members = (
            db.query(models.ConversationMember)
            .filter(models.ConversationMember.conversation_id == conversation.id)
            .all()
        )
        member_ids = {member.user_id for member in members}
        if member_ids == {user_a_id, user_b_id}:
            return conversation

    return None


def _serialize_user(user: models.User):
    display_name = user.username
    return {
        "id": user.id,
        "userId": user.username,
        "accountId": str(user.id),
        "name": display_name,
        "avatar": display_name[:1].upper(),
        "signature": user.email or "",
        "status": "online",
        "group": "常用",
        "remark": "",
    }


def _serialize_message(message: models.Message, current_user_id: int, sender: Optional[models.User]):
    sender_name = sender.username if sender else "系统"
    return {
        "id": message.id,
        "text": message.content,
        "sender": "me" if message.sender_id == current_user_id else "other",
        "senderId": message.sender_id,
        "senderName": sender_name,
        "time": message.timestamp.strftime("%H:%M") if message.timestamp else "",
        "timestamp": message.timestamp.isoformat() if message.timestamp else None,
    }


def _serialize_session(db: Session, conversation: models.Conversation, current_user: models.User):
    members = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation.id)
        .all()
    )
    member_ids = [member.user_id for member in members]
    latest_message = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation.id)
        .order_by(models.Message.timestamp.desc(), models.Message.id.desc())
        .first()
    )

    title = conversation.name or "未命名会话"
    avatar = title[:1] if title else "会"
    real_name = title

    if not conversation.is_group:
        peer_id = next((member_id for member_id in member_ids if member_id != current_user.id), None)
        peer_user = db.query(models.User).filter(models.User.id == peer_id).first() if peer_id else None
        if peer_user:
            title = peer_user.username
            real_name = peer_user.username
            avatar = peer_user.username[:1].upper()

    return {
        "id": conversation.id,
        "title": title,
        "avatar": avatar,
        "lastMessage": latest_message.content if latest_message else "暂无消息",
        "time": latest_message.timestamp.strftime("%H:%M") if latest_message and latest_message.timestamp else "",
        "badge": 0,
        "online": max(len(member_ids) - 1, 0) if conversation.is_group else 1,
        "isGroup": conversation.is_group,
        "realName": real_name,
    }


@router.get("/users/search")
def search_users(
    q: str = Query("", min_length=1),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    keyword = q.strip()
    if not keyword:
        return []

    users = (
        db.query(models.User)
        .filter(models.User.id != current_user.id)
        .filter(
            or_(
                models.User.username.ilike(f"%{keyword}%"),
                models.User.email.ilike(f"%{keyword}%"),
            )
        )
        .order_by(models.User.username.asc())
        .limit(20)
        .all()
    )
    return [_serialize_user(user) for user in users]


@router.get("/friends")
def read_friends(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    friendships = (
        db.query(models.Friendship)
        .filter(models.Friendship.user_id == current_user.id, models.Friendship.status == "accepted")
        .all()
    )
    friend_ids = [friendship.friend_id for friendship in friendships]
    if not friend_ids:
        return []

    users = db.query(models.User).filter(models.User.id.in_(friend_ids)).order_by(models.User.username.asc()).all()
    return [_serialize_user(user) for user in users]


@router.get("/sessions")
def read_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    memberships = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.user_id == current_user.id)
        .all()
    )
    conversation_ids = [membership.conversation_id for membership in memberships]
    if not conversation_ids:
        return []

    conversations = db.query(models.Conversation).filter(models.Conversation.id.in_(conversation_ids)).all()
    serialized = [_serialize_session(db, conversation, current_user) for conversation in conversations]
    serialized.sort(key=lambda item: (item["time"], item["id"]), reverse=True)
    return serialized


@router.get("/sessions/{conversation_id}/messages")
def read_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    membership = (
        db.query(models.ConversationMember)
        .filter(
            models.ConversationMember.conversation_id == conversation_id,
            models.ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    messages = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation_id)
        .order_by(models.Message.timestamp.asc(), models.Message.id.asc())
        .all()
    )
    sender_ids = {message.sender_id for message in messages if message.sender_id is not None}
    users = db.query(models.User).filter(models.User.id.in_(sender_ids)).all() if sender_ids else []
    user_map = {user.id: user for user in users}
    return [_serialize_message(message, current_user.id, user_map.get(message.sender_id)) for message in messages]


@router.post("/friends/add")
def add_friend(
    payload: FriendAddPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    friend_id = payload.friend_id
    if friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as a friend")

    target_user = db.query(models.User).filter(models.User.id == friend_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        db.query(models.Friendship)
        .filter(models.Friendship.user_id == current_user.id, models.Friendship.friend_id == friend_id)
        .first()
    )
    if not existing:
        db.add(models.Friendship(user_id=current_user.id, friend_id=friend_id, status="accepted"))

    reverse_existing = (
        db.query(models.Friendship)
        .filter(models.Friendship.user_id == friend_id, models.Friendship.friend_id == current_user.id)
        .first()
    )
    if not reverse_existing:
        db.add(models.Friendship(user_id=friend_id, friend_id=current_user.id, status="accepted"))

    conversation = _get_private_conversation_between(db, current_user.id, friend_id)
    if not conversation:
        conversation = models.Conversation(is_group=False, name=None)
        db.add(conversation)
        db.flush()
        db.add_all(
            [
                models.ConversationMember(conversation_id=conversation.id, user_id=current_user.id),
                models.ConversationMember(conversation_id=conversation.id, user_id=friend_id),
            ]
        )

    db.commit()
    return {
        "message": "Friend added and conversation ready",
        "friend": _serialize_user(target_user),
        "conversation_id": conversation.id,
    }


@router.delete("/friends/{friend_id}")
def delete_friend(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    target_user = db.query(models.User).filter(models.User.id == friend_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    friendships = (
        db.query(models.Friendship)
        .filter(
            or_(
                (models.Friendship.user_id == current_user.id) & (models.Friendship.friend_id == friend_id),
                (models.Friendship.user_id == friend_id) & (models.Friendship.friend_id == current_user.id),
            )
        )
        .all()
    )
    if not friendships:
        raise HTTPException(status_code=404, detail="Friendship not found")

    conversation = _get_private_conversation_between(db, current_user.id, friend_id)

    for friendship in friendships:
        db.delete(friendship)

    if conversation:
        messages = (
            db.query(models.Message)
            .filter(models.Message.conversation_id == conversation.id)
            .all()
        )
        memberships = (
            db.query(models.ConversationMember)
            .filter(models.ConversationMember.conversation_id == conversation.id)
            .all()
        )
        for message in messages:
            db.delete(message)
        for membership in memberships:
            db.delete(membership)
        db.delete(conversation)

    db.commit()
    return {"message": "Friend deleted successfully"}


@router.post("/messages/send")
def send_message(
    payload: MessageSendPayload = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    membership = (
        db.query(models.ConversationMember)
        .filter(
            models.ConversationMember.conversation_id == payload.conversation_id,
            models.ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    new_message = models.Message(
        conversation_id=payload.conversation_id,
        sender_id=current_user.id,
        content=content,
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    return {
        "status": "sent",
        "message": _serialize_message(new_message, current_user.id, current_user),
    }
