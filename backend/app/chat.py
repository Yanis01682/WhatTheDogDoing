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


class FriendRequestPayload(BaseModel):
    friend_id: int


class GroupCreatePayload(BaseModel):
    name: str
    member_ids: list[int]


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


def _ensure_private_friendship(db: Session, user_id: int, friend_id: int):
    existing = (
        db.query(models.Friendship)
        .filter(models.Friendship.user_id == user_id, models.Friendship.friend_id == friend_id)
        .first()
    )
    if existing:
        existing.status = "accepted"
        return existing

    friendship = models.Friendship(user_id=user_id, friend_id=friend_id, status="accepted")
    db.add(friendship)
    return friendship


def _serialize_user(user: models.User):
    display_name = user.username
    # 隐身状态在对方视角显示为离线
    status = user.status or "online"
    if status == "invisible":
        status = "offline"
    return {
        "id": user.id,
        "userId": user.username,
        "accountId": str(user.id),
        "name": display_name,
        "avatar": display_name[:1].upper(),
        "signature": "",
        "email": user.email or "",
        "status": status,
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


def _serialize_friend_request(friendship: models.Friendship, user: models.User, request_type: str):
    payload = _serialize_user(user)
    payload.update(
        {
            "id": friendship.id,
            "status": friendship.status,
            "type": request_type,
            "createdAt": friendship.created_at.isoformat() if friendship.created_at else None,
        }
    )
    return payload


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


@router.get("/friends/requests")
def read_friend_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    incoming = (
        db.query(models.Friendship)
        .filter(models.Friendship.friend_id == current_user.id, models.Friendship.status == "pending")
        .order_by(models.Friendship.created_at.desc(), models.Friendship.id.desc())
        .all()
    )
    outgoing = (
        db.query(models.Friendship)
        .filter(models.Friendship.user_id == current_user.id, models.Friendship.status == "pending")
        .order_by(models.Friendship.created_at.desc(), models.Friendship.id.desc())
        .all()
    )

    incoming_users = (
        db.query(models.User).filter(models.User.id.in_([item.user_id for item in incoming])).all()
        if incoming
        else []
    )
    outgoing_users = (
        db.query(models.User).filter(models.User.id.in_([item.friend_id for item in outgoing])).all()
        if outgoing
        else []
    )

    incoming_user_map = {user.id: user for user in incoming_users}
    outgoing_user_map = {user.id: user for user in outgoing_users}

    return {
        "incoming": [
            _serialize_friend_request(item, incoming_user_map[item.user_id], "incoming")
            for item in incoming
            if item.user_id in incoming_user_map
        ],
        "outgoing": [
            _serialize_friend_request(item, outgoing_user_map[item.friend_id], "outgoing")
            for item in outgoing
            if item.friend_id in outgoing_user_map
        ],
    }


@router.post("/friends/requests")
def send_friend_request(
    payload: FriendRequestPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    friend_id = payload.friend_id
    if friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as a friend")

    target_user = db.query(models.User).filter(models.User.id == friend_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    accepted_friendship = (
        db.query(models.Friendship)
        .filter(
            models.Friendship.user_id == current_user.id,
            models.Friendship.friend_id == friend_id,
            models.Friendship.status == "accepted",
        )
        .first()
    )
    if accepted_friendship:
        raise HTTPException(status_code=400, detail="Already friends")

    existing_outgoing = (
        db.query(models.Friendship)
        .filter(
            models.Friendship.user_id == current_user.id,
            models.Friendship.friend_id == friend_id,
            models.Friendship.status == "pending",
        )
        .first()
    )
    if existing_outgoing:
        raise HTTPException(status_code=400, detail="Friend request already sent")

    existing_incoming = (
        db.query(models.Friendship)
        .filter(
            models.Friendship.user_id == friend_id,
            models.Friendship.friend_id == current_user.id,
            models.Friendship.status == "pending",
        )
        .first()
    )
    if existing_incoming:
        raise HTTPException(status_code=400, detail="The other user has already sent you a request")

    request = models.Friendship(user_id=current_user.id, friend_id=friend_id, status="pending")
    db.add(request)
    db.commit()
    db.refresh(request)
    return _serialize_friend_request(request, target_user, "outgoing")


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
    if existing:
        existing.status = "accepted"
    else:
        db.add(models.Friendship(user_id=current_user.id, friend_id=friend_id, status="accepted"))

    reverse_existing = (
        db.query(models.Friendship)
        .filter(models.Friendship.user_id == friend_id, models.Friendship.friend_id == current_user.id)
        .first()
    )
    if reverse_existing:
        reverse_existing.status = "accepted"
    else:
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


@router.post("/friends/requests/{request_id}/accept")
def accept_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    request = (
        db.query(models.Friendship)
        .filter(
            models.Friendship.id == request_id,
            models.Friendship.friend_id == current_user.id,
            models.Friendship.status == "pending",
        )
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")

    target_user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    request.status = "accepted"
    _ensure_private_friendship(db, current_user.id, request.user_id)

    conversation = _get_private_conversation_between(db, current_user.id, request.user_id)
    if not conversation:
        conversation = models.Conversation(is_group=False, name=None)
        db.add(conversation)
        db.flush()
        db.add_all(
            [
                models.ConversationMember(conversation_id=conversation.id, user_id=current_user.id),
                models.ConversationMember(conversation_id=conversation.id, user_id=request.user_id),
            ]
        )

    db.commit()
    return {
        "message": "Friend request accepted",
        "friend": _serialize_user(target_user),
        "conversation_id": conversation.id,
    }


@router.post("/friends/requests/{request_id}/reject")
def reject_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    request = (
        db.query(models.Friendship)
        .filter(
            models.Friendship.id == request_id,
            models.Friendship.friend_id == current_user.id,
            models.Friendship.status == "pending",
        )
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")

    db.delete(request)
    db.commit()
    return {"message": "Friend request rejected"}


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


@router.post("/groups")
def create_group(
    payload: GroupCreatePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    group_name = payload.name.strip()
    if not group_name:
        raise HTTPException(status_code=400, detail="Group name cannot be empty")

    member_ids = list(dict.fromkeys([current_user.id, *payload.member_ids]))
    if len(member_ids) < 2:
        raise HTTPException(status_code=400, detail="Group must contain at least 2 members")

    users = db.query(models.User).filter(models.User.id.in_(member_ids)).all()
    if len(users) != len(member_ids):
        raise HTTPException(status_code=404, detail="One or more users do not exist")

    conversation = models.Conversation(is_group=True, name=group_name)
    db.add(conversation)
    db.flush()

    for member_id in member_ids:
        db.add(models.ConversationMember(conversation_id=conversation.id, user_id=member_id))

    db.commit()
    return {
        "message": "Group created successfully",
        "conversation_id": conversation.id,
    }


@router.get("/groups/{conversation_id}/members")
def read_group_members(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation or not conversation.is_group:
        raise HTTPException(status_code=404, detail="Group not found")

    membership = (
        db.query(models.ConversationMember)
        .filter(
            models.ConversationMember.conversation_id == conversation_id,
            models.ConversationMember.user_id == current_user.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    members = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .order_by(models.ConversationMember.id.asc())
        .all()
    )
    users = db.query(models.User).filter(models.User.id.in_([item.user_id for item in members])).all()
    user_map = {user.id: user for user in users}

    payload = []
    for index, member in enumerate(members):
        user = user_map.get(member.user_id)
        if not user:
            continue
        payload.append(
            {
                "id": user.id,
                "name": user.username,
                "avatar": user.username[:1].upper(),
                "role": "owner" if index == 0 else "member",
                "status": user.status or "online",  # 使用数据库中真实的在线状态
                "online": user.status != "offline" and user.status != "invisible",  # 兼容性字段
            }
        )

    return payload
