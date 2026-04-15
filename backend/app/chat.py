from datetime import timezone, timedelta
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import auth, models
from .database import get_db

router = APIRouter()

ERR_CANNOT_ADD_SELF = "Cannot add yourself as a friend"
ERR_USER_NOT_FOUND = "User not found"
ERR_NOT_MEMBER_CONVERSATION = "Not a member of this conversation"
ERR_FRIEND_REQUEST_NOT_FOUND = "Friend request not found"
ERR_FRIENDSHIP_NOT_FOUND = "Friendship not found"
ERR_MESSAGE_CONTENT_EMPTY = "Message content cannot be empty"
ERR_GROUP_NAME_EMPTY = "Group name cannot be empty"
ERR_GROUP_NOT_FOUND = "Group not found"
ERR_NOT_MEMBER_GROUP = "Not a member of this group"
ERR_ONLY_OWNER_CAN_RENAME = "Only group owner can rename group"
ERR_OWNER_CANNOT_LEAVE = "Owner cannot leave the group, please transfer ownership first"
ERR_ONLY_OWNER_CAN_DISMISS = "Only group owner can dismiss the group"

CHINA_TZ = timezone(timedelta(hours=8))


class FriendAddPayload(BaseModel):
    friend_id: int


class MessageSendPayload(BaseModel):
    conversation_id: int
    content: str
    reply_to_id: Optional[int] = None


class FriendRequestPayload(BaseModel):
    friend_id: int


class GroupCreatePayload(BaseModel):
    name: str
    member_ids: list[int]


class GroupRenamePayload(BaseModel):
    name: str


class GroupInvitePayload(BaseModel):
    member_ids: list[int]


class GroupInvitePayload(BaseModel):
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


def _ensure_not_self_friend(current_user_id: int, friend_id: int):
    if friend_id == current_user_id:
        raise HTTPException(status_code=400, detail=ERR_CANNOT_ADD_SELF)


def _get_user_or_404(db: Session, user_id: int):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=ERR_USER_NOT_FOUND)
    return user


def _get_pending_friend_request_or_404(db: Session, request_id: int, current_user_id: int):
    request = (
        db.query(models.Friendship)
        .filter(
            models.Friendship.id == request_id,
            models.Friendship.friend_id == current_user_id,
            models.Friendship.status == "pending",
        )
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail=ERR_FRIEND_REQUEST_NOT_FOUND)
    return request


def _ensure_bidirectional_friendship(db: Session, user_id: int, friend_id: int):
    _ensure_private_friendship(db, user_id, friend_id)
    _ensure_private_friendship(db, friend_id, user_id)


def _get_group_or_404(db: Session, conversation_id: int):
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation or not conversation.is_group:
        raise HTTPException(status_code=404, detail=ERR_GROUP_NOT_FOUND)
    return conversation


def _get_conversation_membership_or_403(db: Session, conversation_id: int, user_id: int, detail: str):
    membership = (
        db.query(models.ConversationMember)
        .filter(
            models.ConversationMember.conversation_id == conversation_id,
            models.ConversationMember.user_id == user_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail=detail)
    return membership


def _ensure_group_membership(db: Session, conversation_id: int, user_id: int):
    return _get_conversation_membership_or_403(db, conversation_id, user_id, ERR_NOT_MEMBER_GROUP)


def _ensure_conversation_membership(db: Session, conversation_id: int, user_id: int):
    return _get_conversation_membership_or_403(db, conversation_id, user_id, ERR_NOT_MEMBER_CONVERSATION)


def _create_private_conversation(db: Session, user_a_id: int, user_b_id: int):
    conversation = models.Conversation(is_group=False, name=None)
    db.add(conversation)
    db.flush()
    db.add_all(
        [
            models.ConversationMember(conversation_id=conversation.id, user_id=user_a_id),
            models.ConversationMember(conversation_id=conversation.id, user_id=user_b_id),
        ]
    )
    return conversation


def _get_or_create_private_conversation(db: Session, user_a_id: int, user_b_id: int):
    conversation = _get_private_conversation_between(db, user_a_id, user_b_id)
    if conversation:
        return conversation
    return _create_private_conversation(db, user_a_id, user_b_id)


def _format_message_time(timestamp):
    if not timestamp:
        return ""
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    timestamp = timestamp.astimezone(CHINA_TZ)
    return timestamp.strftime("%Y年%m月%d日 %H:%M")


def _is_session_pinned(db: Session, conversation_id: int, user_id: int):
    return (
        db.query(models.ConversationPin)
        .filter(
            models.ConversationPin.conversation_id == conversation_id,
            models.ConversationPin.user_id == user_id,
        )
        .first()
        is not None
    )


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


def _serialize_reply_reference(reply_message: models.Message, current_user_id: int, sender: Optional[models.User]):
    sender_name = sender.username if sender else "系统"
    return {
        "id": reply_message.id,
        "text": reply_message.content,
        "sender": "me" if reply_message.sender_id == current_user_id else "other",
        "senderId": reply_message.sender_id,
        "senderName": sender_name,
    }


def _serialize_message(
    message: models.Message,
    current_user_id: int,
    sender: Optional[models.User],
    reply_message: Optional[models.Message] = None,
    reply_sender: Optional[models.User] = None,
):
    sender_name = sender.username if sender else "系统"
    # 确保 message_type 有默认值
    msg_type = message.message_type if message.message_type else "text"
    payload = {
        "id": message.id,
        "text": message.content,
        "type": msg_type,
        "sender": "me" if message.sender_id == current_user_id else "other",
        "senderId": message.sender_id,
        "senderName": sender_name,
        "time": _format_message_time(message.timestamp),
        "timestamp": message.timestamp.isoformat() if message.timestamp else None,
        "replyToId": message.reply_to_id,
    }
    # 添加图片消息的媒体信息
    if msg_type == "image" and message.media_url:
        payload["mediaUrl"] = message.media_url
        payload["mediaName"] = message.media_name
    # 添加视频消息的媒体信息
    if msg_type == "video" and message.media_url:
        payload["mediaUrl"] = message.media_url
        payload["mediaName"] = message.media_name
    if reply_message:
        payload["replyTo"] = _serialize_reply_reference(reply_message, current_user_id, reply_sender)
    return payload


def _get_reply_message_or_400(db: Session, conversation_id: int, reply_to_id: Optional[int]):
    if reply_to_id is None:
        return None

    reply_message = db.query(models.Message).filter(models.Message.id == reply_to_id).first()
    if not reply_message:
        raise HTTPException(status_code=404, detail="Reply message not found")
    if reply_message.conversation_id != conversation_id:
        raise HTTPException(status_code=400, detail="Reply message must belong to the same conversation")
    return reply_message



def _serialize_messages(
    db: Session,
    messages: list[models.Message],
    current_user_id: int,
    users_by_id: dict[int, models.User],
):
    reply_ids = {message.reply_to_id for message in messages if message.reply_to_id is not None}
    reply_messages = (
        db.query(models.Message).filter(models.Message.id.in_(reply_ids)).all()
        if reply_ids
        else []
    )
    reply_map = {message.id: message for message in reply_messages}

    reply_sender_ids = {message.sender_id for message in reply_messages if message.sender_id is not None}
    missing_reply_sender_ids = [sender_id for sender_id in reply_sender_ids if sender_id not in users_by_id]
    if missing_reply_sender_ids:
        reply_senders = db.query(models.User).filter(models.User.id.in_(missing_reply_sender_ids)).all()
        for user in reply_senders:
            users_by_id[user.id] = user

    return [
        _serialize_message(
            message,
            current_user_id,
            users_by_id.get(message.sender_id),
            reply_map.get(message.reply_to_id),
            users_by_id.get(reply_map[message.reply_to_id].sender_id) if message.reply_to_id in reply_map else None,
        )
        for message in messages
    ]


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
    online_count = 0

    if conversation.is_group:
        member_users = db.query(models.User).filter(models.User.id.in_(member_ids)).all() if member_ids else []
        online_count = sum(
            1
            for user in member_users
            if (user.status or "offline") not in ("offline", "invisible")
        )
    else:
        peer_id = next((member_id for member_id in member_ids if member_id != current_user.id), None)
        peer_user = db.query(models.User).filter(models.User.id == peer_id).first() if peer_id else None
        if peer_user:
            title = peer_user.username
            real_name = peer_user.username
            avatar = peer_user.username[:1].upper()
            online_count = 0 if peer_user.status in ("offline", "invisible") else 1

    return {
        "id": conversation.id,
        "title": title,
        "avatar": avatar,
        "lastMessage": latest_message.content if latest_message else "暂无消息",
        "time": _format_message_time(latest_message.timestamp) if latest_message else "",
        "timestamp": latest_message.timestamp.isoformat() if latest_message and latest_message.timestamp else None,
        "badge": 0,
        "online": online_count,
        "isGroup": conversation.is_group,
        "realName": real_name,
        "isPinned": _is_session_pinned(db, conversation.id, current_user.id),
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
    _ensure_not_self_friend(current_user.id, friend_id)

    target_user = _get_user_or_404(db, friend_id)

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
    serialized.sort(key=lambda item: (item["isPinned"], item["timestamp"] or "", item["id"]), reverse=True)
    return serialized


@router.post("/sessions/{conversation_id}/pin")
def pin_session(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _ensure_conversation_membership(db, conversation_id, current_user.id)

    pin = (
        db.query(models.ConversationPin)
        .filter(
            models.ConversationPin.conversation_id == conversation_id,
            models.ConversationPin.user_id == current_user.id,
        )
        .first()
    )
    if not pin:
        db.add(models.ConversationPin(conversation_id=conversation_id, user_id=current_user.id))
        db.commit()

    return {"message": "Session pinned successfully", "conversation_id": conversation_id, "isPinned": True}


@router.delete("/sessions/{conversation_id}/pin")
def unpin_session(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _ensure_conversation_membership(db, conversation_id, current_user.id)

    pin = (
        db.query(models.ConversationPin)
        .filter(
            models.ConversationPin.conversation_id == conversation_id,
            models.ConversationPin.user_id == current_user.id,
        )
        .first()
    )
    if pin:
        db.delete(pin)
        db.commit()

    return {"message": "Session unpinned successfully", "conversation_id": conversation_id, "isPinned": False}


@router.get("/sessions/{conversation_id}/messages")
def read_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _ensure_conversation_membership(db, conversation_id, current_user.id)

    messages = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation_id)
        .order_by(models.Message.timestamp.asc(), models.Message.id.asc())
        .all()
    )
    sender_ids = {message.sender_id for message in messages if message.sender_id is not None}
    users = db.query(models.User).filter(models.User.id.in_(sender_ids)).all() if sender_ids else []
    user_map = {user.id: user for user in users}
    return _serialize_messages(db, messages, current_user.id, user_map)


@router.post("/friends/add")
def add_friend(
    payload: FriendAddPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    friend_id = payload.friend_id
    _ensure_not_self_friend(current_user.id, friend_id)

    target_user = _get_user_or_404(db, friend_id)

    _ensure_bidirectional_friendship(db, current_user.id, friend_id)

    conversation = _get_or_create_private_conversation(db, current_user.id, friend_id)

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
    request = _get_pending_friend_request_or_404(db, request_id, current_user.id)

    target_user = _get_user_or_404(db, request.user_id)

    request.status = "accepted"
    _ensure_bidirectional_friendship(db, current_user.id, request.user_id)

    conversation = _get_or_create_private_conversation(db, current_user.id, request.user_id)

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
    request = _get_pending_friend_request_or_404(db, request_id, current_user.id)

    db.delete(request)
    db.commit()
    return {"message": "Friend request rejected"}


@router.delete("/friends/{friend_id}")
def delete_friend(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    target_user = _get_user_or_404(db, friend_id)

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
        raise HTTPException(status_code=404, detail=ERR_FRIENDSHIP_NOT_FOUND)

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
    _ensure_conversation_membership(db, payload.conversation_id, current_user.id)

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail=ERR_MESSAGE_CONTENT_EMPTY)

    reply_message = _get_reply_message_or_400(db, payload.conversation_id, payload.reply_to_id)
    reply_sender = None
    if reply_message and reply_message.sender_id is not None:
        reply_sender = db.query(models.User).filter(models.User.id == reply_message.sender_id).first()

    new_message = models.Message(
        conversation_id=payload.conversation_id,
        sender_id=current_user.id,
        reply_to_id=payload.reply_to_id,
        content=content,
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    return {
        "status": "sent",
        "message": _serialize_message(new_message, current_user.id, current_user, reply_message, reply_sender),
    }


@router.post("/messages/send-image")
async def send_image_message(
    file: UploadFile = File(...),
    conversation_id: int = Query(...),
    reply_to_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """发送图片消息
    
    支持的图片格式：PNG, JPEG, JPG, GIF, WEBP, BMP
    最大文件大小：5MB
    """
    # 验证文件类型
    ALLOWED_IMAGE_TYPES = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/bmp': 'bmp',
    }
    
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"不支持的图片格式。支持的格式：{', '.join(ALLOWED_IMAGE_TYPES.keys())}"
        )
    
    # 验证文件大小（5MB）
    MAX_FILE_SIZE = 5 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="图片大小不能超过 5MB")
    
    # 验证是否为会话成员
    _ensure_conversation_membership(db, conversation_id, current_user.id)
    
    # 生成唯一的文件名
    ext = ALLOWED_IMAGE_TYPES[file.content_type]
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    
    # 确保上传目录存在
    upload_dir = os.path.join(os.path.dirname(__file__), '..', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    
    # 保存文件
    file_path = os.path.join(upload_dir, unique_filename)
    with open(file_path, 'wb') as f:
        f.write(content)
    
    # 获取回复消息（如果有）
    reply_message = _get_reply_message_or_400(db, conversation_id, reply_to_id)
    reply_sender = None
    if reply_message and reply_message.sender_id is not None:
        reply_sender = db.query(models.User).filter(models.User.id == reply_message.sender_id).first()
    
    # 创建图片消息
    media_url = f"/uploads/{unique_filename}"
    new_message = models.Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        reply_to_id=reply_to_id,
        message_type="image",
        content="[图片]",
        media_url=media_url,
        media_name=file.filename,
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    return {
        "status": "sent",
        "message": _serialize_message(new_message, current_user.id, current_user, reply_message, reply_sender),
    }


@router.post("/messages/send-video")
async def send_video_message(
    file: UploadFile = File(...),
    conversation_id: int = Query(...),
    reply_to_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """发送视频消息
    
    支持的视频格式：MP4, WebM, AVI, MOV, MKV, FLV, WMV, M4V, 3GP, OGG
    最大文件大小：50MB
    """
    # 验证文件类型
    ALLOWED_VIDEO_TYPES = {
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/x-msvideo': 'avi',
        'video/avi': 'avi',
        'video/quicktime': 'mov',
        'video/x-matroska': 'mkv',
        'video/x-flv': 'flv',
        'video/x-ms-wmv': 'wmv',
        'video/x-m4v': 'm4v',
        'video/3gpp': '3gp',
        'video/ogg': 'ogg',
    }
    
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"不支持的视频格式。支持的格式：{', '.join(ALLOWED_VIDEO_TYPES.keys())}"
        )
    
    # 验证文件大小（50MB）
    MAX_FILE_SIZE = 50 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="视频大小不能超过 50MB")
    
    # 验证是否为会话成员
    _ensure_conversation_membership(db, conversation_id, current_user.id)
    
    # 生成唯一的文件名
    ext = ALLOWED_VIDEO_TYPES[file.content_type]
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    
    # 确保上传目录存在
    upload_dir = os.path.join(os.path.dirname(__file__), '..', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    
    # 保存文件
    file_path = os.path.join(upload_dir, unique_filename)
    with open(file_path, 'wb') as f:
        f.write(content)
    
    # 获取回复消息（如果有）
    reply_message = _get_reply_message_or_400(db, conversation_id, reply_to_id)
    reply_sender = None
    if reply_message and reply_message.sender_id is not None:
        reply_sender = db.query(models.User).filter(models.User.id == reply_message.sender_id).first()
    
    # 创建视频消息
    media_url = f"/uploads/{unique_filename}"
    new_message = models.Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        reply_to_id=reply_to_id,
        message_type="video",
        content="[视频]",
        media_url=media_url,
        media_name=file.filename,
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    return {
        "status": "sent",
        "message": _serialize_message(new_message, current_user.id, current_user, reply_message, reply_sender),
    }


@router.delete("/messages/{message_id}")
def revoke_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    message = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    _ensure_conversation_membership(db, message.conversation_id, current_user.id)

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the sender can revoke this message")

    db.delete(message)
    db.commit()
    return {"message": "Message revoked successfully", "message_id": message_id}


@router.post("/groups")
def create_group(
    payload: GroupCreatePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    group_name = payload.name.strip()
    if not group_name:
        raise HTTPException(status_code=400, detail=ERR_GROUP_NAME_EMPTY)

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


@router.put("/groups/{conversation_id}")
def rename_group(
    conversation_id: int,
    payload: GroupRenamePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    conversation = _get_group_or_404(db, conversation_id)
    _ensure_group_membership(db, conversation_id, current_user.id)

    owner_membership = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .order_by(models.ConversationMember.id.asc())
        .first()
    )
    if not owner_membership or owner_membership.user_id != current_user.id:
        raise HTTPException(status_code=403, detail=ERR_ONLY_OWNER_CAN_RENAME)

    group_name = payload.name.strip()
    if not group_name:
        raise HTTPException(status_code=400, detail=ERR_GROUP_NAME_EMPTY)

    conversation.name = group_name
    db.commit()

    return {
        "message": "Group renamed successfully",
        "conversation_id": conversation.id,
        "title": conversation.name,
    }


@router.post("/groups/{conversation_id}/invite")
def invite_group_members(
    conversation_id: int,
    payload: GroupInvitePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """邀请成员加入群聊"""
    _get_group_or_404(db, conversation_id)
    _ensure_group_membership(db, conversation_id, current_user.id)

    if not payload.member_ids:
        raise HTTPException(status_code=400, detail="No members to invite")

    # 获取当前群成员 ID 列表
    existing_members = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    )
    existing_member_ids = {member.user_id for member in existing_members}

    # 验证要邀请的用户都存在
    users = db.query(models.User).filter(models.User.id.in_(payload.member_ids)).all()
    if len(users) != len(payload.member_ids):
        raise HTTPException(status_code=404, detail="One or more users do not exist")

    # 过滤掉已经在群里的成员
    new_member_ids = [uid for uid in payload.member_ids if uid not in existing_member_ids]

    if not new_member_ids:
        raise HTTPException(status_code=400, detail="All selected users are already in the group")

    # 添加新成员
    for member_id in new_member_ids:
        db.add(models.ConversationMember(conversation_id=conversation_id, user_id=member_id))

    db.commit()
    return {
        "message": "Members invited successfully",
        "conversation_id": conversation_id,
        "invited_count": len(new_member_ids),
    }


@router.get("/groups/{conversation_id}/members")
def read_group_members(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _get_group_or_404(db, conversation_id)
    _ensure_group_membership(db, conversation_id, current_user.id)

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


@router.post("/groups/{conversation_id}/exit")
def exit_group(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    conversation = _get_group_or_404(db, conversation_id)
    membership = _ensure_group_membership(db, conversation_id, current_user.id)

    # 群主不能直接退出，必须先转让群主
    owner_membership = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .order_by(models.ConversationMember.id.asc())
        .first()
    )
    if owner_membership and owner_membership.user_id == current_user.id:
        raise HTTPException(status_code=403, detail=ERR_OWNER_CANNOT_LEAVE)

    # 删除群成员记录
    db.delete(membership)

    # 检查群内是否还有其他成员
    remaining_members = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    )

    # 如果群内没有其他成员了，解散群聊（删除群消息和会话）
    if not remaining_members:
        messages = (
            db.query(models.Message)
            .filter(models.Message.conversation_id == conversation_id)
            .all()
        )
        for message in messages:
            db.delete(message)
        db.delete(conversation)

    db.commit()
    return {
        "message": "Successfully left the group",
        "conversation_id": conversation_id,
    }


@router.delete("/groups/{conversation_id}")
def dismiss_group(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """解散群聊 - 只有群主可以执行
    
    解散后会：
    1. 删除所有群消息
    2. 删除所有群成员记录
    3. 删除所有置顶记录
    4. 删除群聊会话
    """
    conversation = _get_group_or_404(db, conversation_id)
    
    # 验证当前用户是群成员
    _ensure_group_membership(db, conversation_id, current_user.id)
    
    # 验证当前用户是群主（第一个加入的成员）
    owner_membership = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .order_by(models.ConversationMember.id.asc())
        .first()
    )
    
    if not owner_membership or owner_membership.user_id != current_user.id:
        raise HTTPException(status_code=403, detail=ERR_ONLY_OWNER_CAN_DISMISS)
    
    # 1. 删除所有群消息
    messages = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation_id)
        .all()
    )
    for message in messages:
        db.delete(message)
    
    # 2. 删除所有群成员记录（包括置顶记录会通过 CASCADE 自动删除）
    members = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    )
    for member in members:
        db.delete(member)
    
    # 3. 删除群聊会话
    db.delete(conversation)
    
    db.commit()
    
    return {
        "message": "Group dismissed successfully",
        "conversation_id": conversation_id,
    }
