from datetime import datetime, timezone, timedelta
import asyncio
import base64
import json
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, UploadFile, File, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import ai_gateway, auth, models
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
ERR_INVITE_NON_FRIEND = "You can only invite your friends to a group"

CHINA_TZ = timezone(timedelta(hours=8))


class FriendAddPayload(BaseModel):
    friend_id: int


class MessageSendPayload(BaseModel):
    conversation_id: int
    content: str
    reply_to_id: Optional[int] = None


class MessageTranslatePayload(BaseModel):
    target_language: str = "简体中文"


class FriendRequestPayload(BaseModel):
    friend_id: int


class ForwardMessagePayload(BaseModel):
    conversation_id: int
    forward_title: str
    forward_messages: list[dict]


class FriendRemarkPayload(BaseModel):
    remark: str


class FriendGroupPayload(BaseModel):
    group_name: str


class GroupCreatePayload(BaseModel):
    name: str
    member_ids: list[int]


class GroupRenamePayload(BaseModel):
    name: str


class GroupInvitePayload(BaseModel):
    member_ids: list[int]


class GroupInviteRequestPayload(BaseModel):
    invitee_id: int


class GroupAnnouncementPayload(BaseModel):
    content: str


class ConversationMutePayload(BaseModel):
    muted: bool


class UserNotePayload(BaseModel):
    title: str
    content: str


class MomentPostPayload(BaseModel):
    content: str = ""
    image_url: Optional[str] = None


class MomentCommentPayload(BaseModel):
    content: str


class TicTacToeInvitePayload(BaseModel):
    conversation_id: int


class TicTacToeMovePayload(BaseModel):
    index: int


class ConnectionManager:
    _loop: asyncio.AbstractEventLoop | None = None

    def __init__(self):
        # 存储 active 链接: {user_id: [websocket1, websocket2]}
        self.active_connections: dict[int, list[WebSocket]] = {}
        # 长轮询队列: {user_id: [asyncio.Queue, ...]}
        self.poll_queues: dict[int, list[asyncio.Queue]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_notification(self, user_id: int, payload: dict):
        # 发送到 WebSocket 连接
        sockets = list(self.active_connections.get(user_id, []))
        # 发送到长轮询队列
        queues = list(self.poll_queues.get(user_id, []))
        
        if not sockets and not queues:
            print(f"⚠️ 用户 {user_id} 没有活动的 WebSocket 连接")
            return

        print(f"📨 向用户 {user_id} 发送 {len(sockets)} 个WS + {len(queues)} 个轮询: {payload}")
        message = json.dumps(payload)
        disconnected = []
        for socket in sockets:
            try:
                await socket.send_text(message)
                print(f"✅ 消息发送成功到用户 {user_id}")
            except Exception as e:
                print(f"❌ 消息发送失败到用户 {user_id}: {e}")
                disconnected.append(socket)

        for socket in disconnected:
            self.disconnect(socket, user_id)

        # 推送到长轮询队列
        for q in queues:
            await q.put(payload)

    async def notify_users(self, user_ids: list[int] | set[int], payload: dict):
        tasks = [
            self.send_notification(user_id, payload)
            for user_id in set(user_ids)
            if user_id is not None
        ]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

manager = ConnectionManager()


def _dispatch_notification(user_ids: list[int] | set[int], payload: dict):
    print(f"📤 发送通知给 {len(set(user_ids))} 个用户: {payload}")
    # 优先使用 WebSocket 连接管理器中缓存的主循环（sync endpoint 也可以推送）
    loop = ConnectionManager._loop
    if loop is None:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            print("⚠️ 没有运行中的事件循环，无法发送通知")
            return

    if loop.is_running():
        asyncio.run_coroutine_threadsafe(manager.notify_users(user_ids, payload), loop)
    else:
        loop.run_until_complete(manager.notify_users(user_ids, payload))

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


def _parse_mentioned_users(content: str, conversation_id: int, db: Session):
    """
    从消息内容中解析被 @ 的用户 ID 列表
    支持格式：@用户名 或 @userId
    返回：(清理后的内容, 逗号分隔的用户ID字符串)
    """
    import re
    
    # 获取群聊所有成员
    members = (
        db.query(models.ConversationMember, models.User)
        .join(models.User, models.ConversationMember.user_id == models.User.id)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    )
    
    mentioned_ids = set()
    cleaned_content = content
    
    for member, user in members:
        # 匹配 @昵称 或 @username
        nickname = user.nickname or user.username
        username = user.username
        
        # 尝试匹配 @昵称
        pattern_nickname = re.compile(r'@' + re.escape(nickname) + r'(?:\s|$|，|,|。|！|？)', re.UNICODE)
        matches = pattern_nickname.findall(cleaned_content)
        if matches:
            mentioned_ids.add(user.id)
        
        # 尝试匹配 @username（如果不同）
        if username != nickname:
            pattern_username = re.compile(r'@' + re.escape(username) + r'(?:\s|$|，|,|。|！|？)', re.UNICODE)
            matches = pattern_username.findall(cleaned_content)
            if matches:
                mentioned_ids.add(user.id)
    
    # 将用户ID列表转换为逗号分隔的字符串
    mentioned_ids_str = ','.join(str(uid) for uid in sorted(mentioned_ids)) if mentioned_ids else None
    
    return cleaned_content, mentioned_ids_str


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


def _serialize_user_note(note: models.UserNote):
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "createdAt": note.created_at.isoformat() if note.created_at else None,
        "updatedAt": note.updated_at.isoformat() if note.updated_at else None,
    }


def _get_friend_ids(db: Session, user_id: int):
    rows = (
        db.query(models.Friendship.friend_id)
        .filter(models.Friendship.user_id == user_id, models.Friendship.status == "accepted")
        .all()
    )
    return {row[0] for row in rows}


def _can_view_moment(db: Session, post: models.MomentPost, user_id: int):
    return True


def _get_visible_moment_or_404(db: Session, post_id: int, user_id: int):
    post = db.query(models.MomentPost).filter(models.MomentPost.id == post_id).first()
    if not post or not _can_view_moment(db, post, user_id):
        raise HTTPException(status_code=404, detail="Moment not found")
    return post


def _serialize_moment(db: Session, post: models.MomentPost, current_user_id: int):
    user_ids = {post.user_id}
    likes = db.query(models.MomentLike).filter(models.MomentLike.post_id == post.id).all()
    comments = (
        db.query(models.MomentComment)
        .filter(models.MomentComment.post_id == post.id)
        .order_by(models.MomentComment.created_at.asc(), models.MomentComment.id.asc())
        .all()
    )
    user_ids.update(like.user_id for like in likes)
    user_ids.update(comment.user_id for comment in comments)
    users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()
    user_map = {user.id: user for user in users}

    def public_user(user_id):
        user = user_map.get(user_id)
        name = (user.nickname or user.username) if user else "未知成员"
        return {"id": user_id, "name": name, "avatar": user.avatar if user and user.avatar else "/aegis-avatar-warden-v2.png"}

    return {
        "id": post.id,
        "author": public_user(post.user_id),
        "content": post.content,
        "imageUrl": post.image_url,
        "createdAt": post.created_at.isoformat() if post.created_at else None,
        "likedByMe": any(like.user_id == current_user_id for like in likes),
        "likes": [public_user(like.user_id) for like in likes],
        "comments": [
            {
                "id": comment.id,
                "author": public_user(comment.user_id),
                "content": comment.content,
                "createdAt": comment.created_at.isoformat() if comment.created_at else None,
            }
            for comment in comments
        ],
    }


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


def _format_display_datetime(timestamp):
    if not timestamp:
        return None
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


def _serialize_user(user: models.User, remark: Optional[str] = None, group_name: Optional[str] = None):
    display_name = user.nickname or user.username
    return {
        "id": user.id,
        "userId": user.username,
        "accountId": str(user.id),
        "name": display_name,
        "avatar": user.avatar or '/aegis-avatar-warden-v2.png',
        "signature": user.bio or "",
        "email": user.email or "",
        "group": group_name or "我的好友",
        "remark": remark or "",
    }


def _serialize_reply_reference(reply_message: models.Message, current_user_id: int, sender: Optional[models.User]):
    sender_name = (sender.nickname or sender.username) if sender else "系统"
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
    sender_name = ai_gateway.BOT_NAME if message.message_type == "bot" else ((sender.nickname or sender.username) if sender else "系统")
    # 确保 message_type 有默认值
    msg_type = message.message_type if message.message_type else "text"
    if msg_type == "system":
        msg_sender = "system"
    elif message.sender_id == current_user_id:
        msg_sender = "me"
    else:
        msg_sender = "other"
    payload = {
        "id": message.id,
        "text": message.content,
        "type": msg_type,
        "sender": msg_sender,
        "senderId": message.sender_id,
        "senderName": sender_name,
        "time": _format_message_time(message.timestamp),
        "timestamp": message.timestamp.isoformat() if message.timestamp else None,
        "replyToId": message.reply_to_id,
        "mentionedUserIds": message.mentioned_user_ids,
    }
    # 添加图片消息的媒体信息
    if msg_type == "image" and (message.media_data or message.media_url):
        payload["mediaUrl"] = message.media_data or message.media_url
        payload["mediaName"] = message.media_name
    # 添加视频消息的媒体信息
    if msg_type == "video" and message.media_url:
        payload["mediaUrl"] = message.media_url
        payload["mediaName"] = message.media_name
    # 添加文件消息的媒体信息
    if msg_type == "file" and message.media_url:
        payload["mediaUrl"] = message.media_url
        payload["mediaName"] = message.media_name
    # 添加语音消息的媒体信息
    if msg_type == "voice" and message.media_url:
        payload["mediaUrl"] = message.media_url
        payload["mediaName"] = message.media_name
    if reply_message:
        payload["replyTo"] = _serialize_reply_reference(reply_message, current_user_id, reply_sender)
    if msg_type == "forward" and message.media_data:
        payload["forwardData"] = json.loads(message.media_data)
    if msg_type == "game" and message.media_data:
        payload["gameData"] = json.loads(message.media_data)
    return payload


def _serialize_notification_message(message: models.Message, sender_name: str):
    return {
        "id": message.id,
        "text": message.content,
        "type": message.message_type or "text",
        "senderId": message.sender_id,
        "senderName": sender_name,
        "time": _format_message_time(message.timestamp),
        "timestamp": message.timestamp.isoformat() if message.timestamp else None,
        "replyToId": message.reply_to_id,
        "mentionedUserIds": message.mentioned_user_ids,
    }


def _get_recent_text_context(db: Session, conversation_id: int, skip_message_id: int | None = None):
    rows = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation_id)
        .order_by(models.Message.timestamp.desc(), models.Message.id.desc())
        .limit(10)
        .all()
    )
    sender_ids = {message.sender_id for message in rows if message.sender_id is not None}
    users = db.query(models.User).filter(models.User.id.in_(sender_ids)).all() if sender_ids else []
    user_map = {user.id: user for user in users}
    context = []
    for message in reversed(rows):
        if skip_message_id is not None and message.id == skip_message_id:
            continue
        if (message.message_type or "text") not in ("text", "bot") or not message.content:
            continue
        if message.message_type == "bot":
            sender = ai_gateway.BOT_NAME
        else:
            user = user_map.get(message.sender_id)
            sender = (user.nickname or user.username) if user else "群成员"
        context.append({"sender": sender, "text": message.content})
    return context


def _create_group_bot_reply_if_needed(db: Session, conversation_id: int, content: str, source_message_id: int | None = None):
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation or not conversation.is_group or not ai_gateway.mentions_bot(content):
        return None

    prompt = ai_gateway.clean_bot_prompt(content)
    context = _get_recent_text_context(db, conversation_id, skip_message_id=source_message_id)
    try:
        answer = ai_gateway.answer_group_prompt(prompt, context)
    except HTTPException as exc:
        answer = f"{ai_gateway.BOT_NAME}暂时无法连上星流书库：{exc.detail}"

    bot_message = models.Message(
        conversation_id=conversation_id,
        sender_id=None,
        message_type="bot",
        content=answer,
    )
    db.add(bot_message)
    db.commit()
    db.refresh(bot_message)
    return bot_message


def _get_private_game_players(db: Session, conversation_id: int, current_user_id: int):
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation or conversation.is_group:
        raise HTTPException(status_code=400, detail="Tic-tac-toe can only be started in a private chat")
    _ensure_conversation_membership(db, conversation_id, current_user_id)
    members = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    )
    if len(members) != 2:
        raise HTTPException(status_code=400, detail="Private chat must have exactly two players")
    peer_id = next(member.user_id for member in members if member.user_id != current_user_id)
    return [member.user_id for member in members], peer_id


def _serialize_tic_tac_toe_game(db: Session, game: models.TicTacToeGame, current_user_id: int | None = None):
    user_ids = [uid for uid in [game.inviter_id, game.invitee_id, game.x_user_id, game.o_user_id, game.turn_user_id, game.winner_user_id] if uid]
    users = db.query(models.User).filter(models.User.id.in_(set(user_ids))).all() if user_ids else []
    user_map = {user.id: user for user in users}

    def name_for(user_id):
        user = user_map.get(user_id)
        return (user.nickname or user.username) if user else "未知成员"

    return {
        "id": game.id,
        "conversationId": game.conversation_id,
        "status": game.status,
        "board": list(game.board),
        "inviterId": game.inviter_id,
        "inviteeId": game.invitee_id,
        "xUserId": game.x_user_id,
        "oUserId": game.o_user_id,
        "turnUserId": game.turn_user_id,
        "winnerUserId": game.winner_user_id,
        "inviterName": name_for(game.inviter_id),
        "inviteeName": name_for(game.invitee_id),
        "xName": name_for(game.x_user_id),
        "oName": name_for(game.o_user_id),
        "currentUserMark": "X" if current_user_id == game.x_user_id else ("O" if current_user_id == game.o_user_id else None),
        "createdAt": game.created_at.isoformat() if game.created_at else None,
        "updatedAt": game.updated_at.isoformat() if game.updated_at else None,
    }


def _notify_tic_tac_toe(db: Session, game: models.TicTacToeGame, member_ids: list[int]):
    _dispatch_notification(
        member_ids,
        {
            "type": "game_updated",
            "conversationId": game.conversation_id,
            "game": _serialize_tic_tac_toe_game(db, game),
        },
    )


def _winning_mark(board: str):
    for a, b, c in [(0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6)]:
        if board[a] != "." and board[a] == board[b] == board[c]:
            return board[a]
    return None


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

    result = [
        _serialize_message(
            message,
            current_user_id,
            users_by_id.get(message.sender_id),
            reply_map.get(message.reply_to_id),
            users_by_id.get(reply_map[message.reply_to_id].sender_id) if message.reply_to_id in reply_map else None,
        )
        for message in messages
    ]
    return result


def _serialize_session(db: Session, conversation: models.Conversation, current_user: models.User):
    members = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation.id)
        .all()
    )
    current_membership = next((member for member in members if member.user_id == current_user.id), None)
    member_ids = [member.user_id for member in members]
    latest_message = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation.id)
        .order_by(models.Message.timestamp.desc(), models.Message.id.desc())
        .first()
    )
    unread_count = 0
    if current_membership is not None:
        unread_count = (
            db.query(models.Message)
            .filter(
                models.Message.conversation_id == conversation.id,
                models.Message.id > (current_membership.read_index or 0),
                or_(models.Message.sender_id.is_(None), models.Message.sender_id != current_user.id),
            )
            .count()
        )

    title = conversation.name or "未命名会话"
    avatar = '/aegis-avatar-group.png'
    real_name = title

    if not conversation.is_group:
        peer_id = next((member_id for member_id in member_ids if member_id != current_user.id), None)
        peer_user = db.query(models.User).filter(models.User.id == peer_id).first() if peer_id else None
        if peer_user:
            title = peer_user.nickname or peer_user.username
            real_name = peer_user.username
            avatar = peer_user.avatar or '/aegis-avatar-warden-v2.png'

    payload = {
        "id": conversation.id,
        "title": title,
        "avatar": avatar,
        "lastMessage": latest_message.content if latest_message else "暂无消息",
        "time": _format_message_time(latest_message.timestamp) if latest_message else "",
        "timestamp": latest_message.timestamp.isoformat() if latest_message and latest_message.timestamp else None,
        "badge": unread_count,
        "isGroup": conversation.is_group,
        "realName": real_name,
        "isPinned": _is_session_pinned(db, conversation.id, current_user.id),
        "isMuted": bool(current_membership.mute_notifications) if current_membership is not None else False,
    }
    if payload["isMuted"]:
        payload["badge"] = 0
    if not conversation.is_group and peer_id is not None:
        payload["peerUserId"] = peer_id
    return payload


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


def _serialize_group_invite_request(
    invite_request: models.GroupInviteRequest,
    requester: models.User,
    invitee: models.User,
    conversation: models.Conversation,
):
    return {
        "id": invite_request.id,
        "conversationId": invite_request.conversation_id,
        "groupName": conversation.name or f"群聊 {conversation.id}",
        "requesterId": invite_request.requester_id,
        "requesterName": requester.nickname or requester.username,
        "requesterAvatar": requester.avatar or "/aegis-avatar-warden-v2.png",
        "inviteeId": invite_request.invitee_id,
        "inviteeName": invitee.nickname or invitee.username,
        "inviteeAvatar": invitee.avatar or "/aegis-avatar-warden-v2.png",
        "status": invite_request.status,
        "createdAt": invite_request.created_at.isoformat() if invite_request.created_at else None,
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
    if not friendships:
        return []

    friend_meta = {
        friendship.friend_id: {
            "remark": friendship.remark,
            "group_name": friendship.group_name,
        }
        for friendship in friendships
    }
    users = db.query(models.User).filter(models.User.id.in_(friend_meta.keys())).order_by(models.User.username.asc()).all()
    return [
        _serialize_user(user, friend_meta[user.id]["remark"], friend_meta[user.id]["group_name"])
        for user in users
    ]


@router.get("/moments")
def read_moments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    posts = (
        db.query(models.MomentPost)
        .order_by(models.MomentPost.created_at.desc(), models.MomentPost.id.desc())
        .limit(50)
        .all()
    )
    return [_serialize_moment(db, post, current_user.id) for post in posts]


@router.post("/moments")
def create_moment(
    payload: MomentPostPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    content = payload.content.strip()
    image_url = (payload.image_url or "").strip()
    if not content and not image_url:
        raise HTTPException(status_code=400, detail="Moment content or image is required")
    post = models.MomentPost(
        user_id=current_user.id,
        content=content[:1000],
        image_url=image_url or None,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _serialize_moment(db, post, current_user.id)


@router.post("/moments/upload-image")
async def upload_moment_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
):
    allowed_image_types = {
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/gif",
        "image/webp",
        "image/bmp",
    }
    if file.content_type not in allowed_image_types:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size cannot exceed 5MB")

    media_data = f"data:{file.content_type};base64,{base64.b64encode(content).decode('ascii')}"
    return {"imageUrl": media_data}


@router.post("/moments/{post_id}/like")
def toggle_moment_like(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    post = _get_visible_moment_or_404(db, post_id, current_user.id)
    existing = (
        db.query(models.MomentLike)
        .filter(models.MomentLike.post_id == post_id, models.MomentLike.user_id == current_user.id)
        .first()
    )
    if existing:
        db.delete(existing)
    else:
        db.add(models.MomentLike(post_id=post_id, user_id=current_user.id))
    db.commit()
    return _serialize_moment(db, post, current_user.id)


@router.post("/moments/{post_id}/comments")
def create_moment_comment(
    post_id: int,
    payload: MomentCommentPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    post = _get_visible_moment_or_404(db, post_id, current_user.id)
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    db.add(models.MomentComment(post_id=post_id, user_id=current_user.id, content=content[:500]))
    db.commit()
    db.refresh(post)
    return _serialize_moment(db, post, current_user.id)


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
    _dispatch_notification(
        [current_user.id, friend_id],
        {
            "type": "friend_request_updated",
            "friendRequestId": request.id,
        },
    )
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
    try:
        serialized = [_serialize_session(db, conversation, current_user) for conversation in conversations]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Session serialization error: {str(exc)}")
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


@router.put("/sessions/{conversation_id}/mute")
def update_session_mute(
    conversation_id: int,
    payload: ConversationMutePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    membership = _ensure_conversation_membership(db, conversation_id, current_user.id)
    membership.mute_notifications = payload.muted
    db.commit()
    return {
        "message": "Session mute status updated",
        "conversation_id": conversation_id,
        "isMuted": membership.mute_notifications,
    }


@router.get("/notes")
def read_user_notes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    notes = (
        db.query(models.UserNote)
        .filter(models.UserNote.user_id == current_user.id)
        .order_by(models.UserNote.updated_at.desc(), models.UserNote.id.desc())
        .all()
    )
    return [_serialize_user_note(note) for note in notes]


@router.post("/notes")
def create_user_note(
    payload: UserNotePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    note = models.UserNote(
        user_id=current_user.id,
        title=payload.title.strip() or "无标题笔记",
        content=payload.content.strip(),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _serialize_user_note(note)


@router.put("/notes/{note_id}")
def update_user_note(
    note_id: int,
    payload: UserNotePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    note = (
        db.query(models.UserNote)
        .filter(models.UserNote.id == note_id, models.UserNote.user_id == current_user.id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    note.title = payload.title.strip() or "无标题笔记"
    note.content = payload.content.strip()
    db.commit()
    db.refresh(note)
    return _serialize_user_note(note)


@router.delete("/notes/{note_id}")
def delete_user_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    note = (
        db.query(models.UserNote)
        .filter(models.UserNote.id == note_id, models.UserNote.user_id == current_user.id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully"}


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
    membership = _get_member_or_403(db, conversation_id, current_user.id)
    if messages:
        latest_message_id = messages[-1].id
        if (membership.read_index or 0) < latest_message_id:
            membership.read_index = latest_message_id
            db.commit()
    sender_ids = {message.sender_id for message in messages if message.sender_id is not None}
    users = db.query(models.User).filter(models.User.id.in_(sender_ids)).all() if sender_ids else []
    user_map = {user.id: user for user in users}
    return _serialize_messages(db, messages, current_user.id, user_map)


@router.post("/messages/{message_id}/translate")
def translate_message(
    message_id: int,
    payload: MessageTranslatePayload = Body(default=MessageTranslatePayload()),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    message = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    _ensure_conversation_membership(db, message.conversation_id, current_user.id)
    if (message.message_type or "text") not in ("text", "bot") or not message.content:
        raise HTTPException(status_code=400, detail="Only text messages can be translated")

    translation = ai_gateway.translate_text(message.content, payload.target_language.strip() or "简体中文")
    return {
        "messageId": message.id,
        "source": message.content,
        "translation": translation,
        "targetLanguage": payload.target_language.strip() or "简体中文",
    }


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
    _dispatch_notification(
        [current_user.id, request.user_id],
        {
            "type": "friend_request_updated",
            "conversationId": conversation.id,
        },
    )
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
    _dispatch_notification(
        [current_user.id, request.user_id],
        {
            "type": "friend_request_updated",
            "friendRequestId": request_id,
        },
    )
    return {"message": "Friend request rejected"}


@router.put("/friends/{friend_id}/remark")
def update_friend_remark(
    friend_id: int,
    payload: FriendRemarkPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """更新好友备注"""
    friendship = (
        db.query(models.Friendship)
        .filter(models.Friendship.user_id == current_user.id, models.Friendship.friend_id == friend_id)
        .first()
    )
    if not friendship:
        raise HTTPException(status_code=404, detail="Not your friend or friendship not found")
    
    friendship.remark = payload.remark.strip()
    db.commit()
    return {"message": "Remark updated", "remark": friendship.remark}


@router.put("/friends/{friend_id}/group")
def update_friend_group(
    friend_id: int,
    payload: FriendGroupPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    friendship = (
        db.query(models.Friendship)
        .filter(models.Friendship.user_id == current_user.id, models.Friendship.friend_id == friend_id)
        .first()
    )
    if not friendship:
        raise HTTPException(status_code=404, detail="Not your friend or friendship not found")

    group_name = payload.group_name.strip()
    friendship.group_name = group_name or "我的好友"
    db.commit()
    return {"message": "Friend group updated", "group": friendship.group_name}


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

    # 解析 @ 用户
    cleaned_content, mentioned_user_ids = _parse_mentioned_users(content, payload.conversation_id, db)
    print(f"🔍 解析 @ 用户: content='{content}', cleaned='{cleaned_content}', mentioned_ids={mentioned_user_ids}")
    print(f"🔍 解析 @ 用户: content='{content}', cleaned='{cleaned_content}', mentioned_ids={mentioned_user_ids}")

    new_message = models.Message(
        conversation_id=payload.conversation_id,
        sender_id=current_user.id,
        reply_to_id=payload.reply_to_id,
        content=cleaned_content,
        mentioned_user_ids=mentioned_user_ids,
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    member_ids = [
        item.user_id
        for item in db.query(models.ConversationMember.user_id)
        .filter(models.ConversationMember.conversation_id == payload.conversation_id)
        .all()
    ]
    _dispatch_notification(
        member_ids,
        {
            "type": "conversation_updated",
            "conversationId": payload.conversation_id,
            "messageId": new_message.id,
            "message": _serialize_notification_message(new_message, current_user.nickname or current_user.username),
        },
    )
    print(f"📤 发送通知: conversationId={payload.conversation_id}, mentionedUserIds={new_message.mentioned_user_ids}")
    bot_message = _create_group_bot_reply_if_needed(db, payload.conversation_id, content, new_message.id)
    if bot_message:
        _dispatch_notification(
            member_ids,
            {
                "type": "conversation_updated",
                "conversationId": payload.conversation_id,
                "messageId": bot_message.id,
                "message": _serialize_notification_message(bot_message, ai_gateway.BOT_NAME),
            },
        )
    return {
        "status": "sent",
        "message": _serialize_message(new_message, current_user.id, current_user, reply_message, reply_sender),
    }


@router.get("/games/tictactoe/active")
def get_active_tic_tac_toe_game(
    conversation_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _ensure_conversation_membership(db, conversation_id, current_user.id)
    game = (
        db.query(models.TicTacToeGame)
        .filter(
            models.TicTacToeGame.conversation_id == conversation_id,
            models.TicTacToeGame.status.in_(["pending", "active"]),
        )
        .order_by(models.TicTacToeGame.id.desc())
        .first()
    )
    return _serialize_tic_tac_toe_game(db, game, current_user.id) if game else None


@router.post("/games/tictactoe/invite")
def invite_tic_tac_toe_game(
    payload: TicTacToeInvitePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    member_ids, peer_id = _get_private_game_players(db, payload.conversation_id, current_user.id)
    existing = (
        db.query(models.TicTacToeGame)
        .filter(
            models.TicTacToeGame.conversation_id == payload.conversation_id,
            models.TicTacToeGame.status.in_(["pending", "active"]),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="There is already an active tic-tac-toe game")

    game = models.TicTacToeGame(
        conversation_id=payload.conversation_id,
        inviter_id=current_user.id,
        invitee_id=peer_id,
        x_user_id=current_user.id,
        o_user_id=peer_id,
        turn_user_id=current_user.id,
    )
    db.add(game)
    db.flush()
    game_data = {"kind": "tic_tac_toe", "gameId": game.id}
    message = models.Message(
        conversation_id=payload.conversation_id,
        sender_id=current_user.id,
        message_type="game",
        content="发起了一局井字棋",
        media_data=json.dumps(game_data),
    )
    db.add(message)
    db.commit()
    db.refresh(game)
    db.refresh(message)
    _dispatch_notification(
        member_ids,
        {
            "type": "conversation_updated",
            "conversationId": payload.conversation_id,
            "messageId": message.id,
            "message": _serialize_message(message, current_user.id, current_user),
        },
    )
    _notify_tic_tac_toe(db, game, member_ids)
    return _serialize_tic_tac_toe_game(db, game, current_user.id)


@router.post("/games/tictactoe/{game_id}/accept")
def accept_tic_tac_toe_game(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    game = db.query(models.TicTacToeGame).filter(models.TicTacToeGame.id == game_id).first()
    if not game or game.invitee_id != current_user.id or game.status != "pending":
        raise HTTPException(status_code=404, detail="Pending tic-tac-toe invite not found")
    member_ids, _ = _get_private_game_players(db, game.conversation_id, current_user.id)
    game.status = "active"
    db.commit()
    db.refresh(game)
    _notify_tic_tac_toe(db, game, member_ids)
    return _serialize_tic_tac_toe_game(db, game, current_user.id)


@router.post("/games/tictactoe/{game_id}/move")
def play_tic_tac_toe_move(
    game_id: int,
    payload: TicTacToeMovePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    game = db.query(models.TicTacToeGame).filter(models.TicTacToeGame.id == game_id).first()
    if not game or game.status != "active":
        raise HTTPException(status_code=404, detail="Active tic-tac-toe game not found")
    member_ids, _ = _get_private_game_players(db, game.conversation_id, current_user.id)
    if game.turn_user_id != current_user.id:
        raise HTTPException(status_code=400, detail="It is not your turn")
    if payload.index < 0 or payload.index > 8 or game.board[payload.index] != ".":
        raise HTTPException(status_code=400, detail="Invalid move")

    mark = "X" if current_user.id == game.x_user_id else "O"
    board = game.board[:payload.index] + mark + game.board[payload.index + 1:]
    game.board = board
    winner = _winning_mark(board)
    if winner:
        game.status = "x_win" if winner == "X" else "o_win"
        game.winner_user_id = game.x_user_id if winner == "X" else game.o_user_id
        game.turn_user_id = None
    elif "." not in board:
        game.status = "draw"
        game.turn_user_id = None
    else:
        game.turn_user_id = game.o_user_id if mark == "X" else game.x_user_id
    db.commit()
    db.refresh(game)
    _notify_tic_tac_toe(db, game, member_ids)
    return _serialize_tic_tac_toe_game(db, game, current_user.id)


@router.post("/games/tictactoe/{game_id}/resign")
def resign_tic_tac_toe_game(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    game = db.query(models.TicTacToeGame).filter(models.TicTacToeGame.id == game_id).first()
    if not game or game.status not in ["pending", "active"]:
        raise HTTPException(status_code=404, detail="Tic-tac-toe game not found")
    member_ids, peer_id = _get_private_game_players(db, game.conversation_id, current_user.id)
    if current_user.id not in [game.inviter_id, game.invitee_id]:
        raise HTTPException(status_code=403, detail="Not a player in this game")
    game.status = "cancelled" if game.status == "pending" else ("o_win" if current_user.id == game.x_user_id else "x_win")
    game.winner_user_id = None if game.status == "cancelled" else peer_id
    game.turn_user_id = None
    db.commit()
    db.refresh(game)
    _notify_tic_tac_toe(db, game, member_ids)
    return _serialize_tic_tac_toe_game(db, game, current_user.id)


@router.post("/messages/send-forward")
def send_forward_message(
    payload: ForwardMessagePayload = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """发送合并转发消息
    
    将多条选中的消息打包成一条合并转发消息发送到目标会话。
    消息类型为 "forward"，content 存储标题文本，media_data 存储转发消息列表的 JSON。
    """
    _ensure_conversation_membership(db, payload.conversation_id, current_user.id)

    if not payload.forward_messages:
        raise HTTPException(status_code=400, detail="转发消息列表不能为空")

    forward_data = {
        "title": payload.forward_title,
        "messages": payload.forward_messages,
    }
    forward_data_json = json.dumps(forward_data, ensure_ascii=False)

    new_message = models.Message(
        conversation_id=payload.conversation_id,
        sender_id=current_user.id,
        message_type="forward",
        content=payload.forward_title,
        media_data=forward_data_json,
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    member_ids = [
        item.user_id
        for item in db.query(models.ConversationMember.user_id)
        .filter(models.ConversationMember.conversation_id == payload.conversation_id)
        .all()
    ]
    _dispatch_notification(
        member_ids,
        {
            "type": "conversation_updated",
            "conversationId": payload.conversation_id,
            "messageId": new_message.id,
            "message": {
                "id": new_message.id,
                "text": new_message.content,
                "type": new_message.message_type or "forward",
                "senderId": current_user.id,
                "senderName": current_user.nickname or current_user.username,
                "time": _format_message_time(new_message.timestamp),
                "timestamp": new_message.timestamp.isoformat() if new_message.timestamp else None,
                "forwardData": forward_data,
            },
        },
    )
    return {
        "status": "sent",
        "message": _serialize_message(new_message, current_user.id, current_user),
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
    
    # 获取回复消息（如果有）
    reply_message = _get_reply_message_or_400(db, conversation_id, reply_to_id)
    reply_sender = None
    if reply_message and reply_message.sender_id is not None:
        reply_sender = db.query(models.User).filter(models.User.id == reply_message.sender_id).first()
    
    # 创建图片消息
    media_data = f"data:{file.content_type};base64,{base64.b64encode(content).decode('ascii')}"
    new_message = models.Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        reply_to_id=reply_to_id,
        message_type="image",
        content="[图片]",
        media_data=media_data,
        media_name=file.filename,
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    member_ids = [
        item.user_id
        for item in db.query(models.ConversationMember.user_id)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    ]
    _dispatch_notification(
        member_ids,
        {
            "type": "conversation_updated",
            "conversationId": conversation_id,
            "messageId": new_message.id,
        },
    )
    
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
    member_ids = [
        item.user_id
        for item in db.query(models.ConversationMember.user_id)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    ]
    _dispatch_notification(
        member_ids,
        {
            "type": "conversation_updated",
            "conversationId": conversation_id,
            "messageId": new_message.id,
        },
    )
    
    return {
        "status": "sent",
        "message": _serialize_message(new_message, current_user.id, current_user, reply_message, reply_sender),
    }


@router.post("/messages/send-file")
async def send_file_message(
    file: UploadFile = File(...),
    conversation_id: int = Query(...),
    reply_to_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """发送文件消息，最大 20MB"""
    MAX_FILE_SIZE = 20 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过 20MB")

    _ensure_conversation_membership(db, conversation_id, current_user.id)

    ext = os.path.splitext(file.filename or "file")[1] or ".bin"
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    upload_dir = os.path.join(os.path.dirname(__file__), '..', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_filename)
    with open(file_path, 'wb') as f:
        f.write(content)

    reply_message = _get_reply_message_or_400(db, conversation_id, reply_to_id)
    reply_sender = None
    if reply_message and reply_message.sender_id is not None:
        reply_sender = db.query(models.User).filter(models.User.id == reply_message.sender_id).first()

    new_message = models.Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        reply_to_id=reply_to_id,
        message_type="file",
        content="[文件]",
        media_url=f"/uploads/{unique_filename}",
        media_name=file.filename,
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    member_ids = [
        item.user_id
        for item in db.query(models.ConversationMember.user_id)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    ]
    _dispatch_notification(member_ids, {"type": "conversation_updated", "conversationId": conversation_id, "messageId": new_message.id})

    return {
        "status": "sent",
        "message": _serialize_message(new_message, current_user.id, current_user, reply_message, reply_sender),
    }


@router.post("/messages/send-voice")
async def send_voice_message(
    file: UploadFile = File(...),
    conversation_id: int = Query(...),
    reply_to_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """发送语音消息，最大 2MB"""
    ALLOWED_AUDIO_TYPES = {'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/mp3'}
    content_type_base = (file.content_type or '').split(';')[0].strip()
    if content_type_base not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail="不支持的音频格式")

    MAX_FILE_SIZE = 2 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="语音大小不能超过 2MB")

    _ensure_conversation_membership(db, conversation_id, current_user.id)

    ext = content_type_base.split('/')[-1].replace('mpeg', 'mp3')
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    upload_dir = os.path.join(os.path.dirname(__file__), '..', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_filename)
    with open(file_path, 'wb') as f:
        f.write(content)

    reply_message = _get_reply_message_or_400(db, conversation_id, reply_to_id)
    reply_sender = None
    if reply_message and reply_message.sender_id is not None:
        reply_sender = db.query(models.User).filter(models.User.id == reply_message.sender_id).first()

    new_message = models.Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        reply_to_id=reply_to_id,
        message_type="voice",
        content="[语音]",
        media_url=f"/uploads/{unique_filename}",
        media_name=file.filename,
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    member_ids = [
        item.user_id
        for item in db.query(models.ConversationMember.user_id)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    ]
    _dispatch_notification(member_ids, {"type": "conversation_updated", "conversationId": conversation_id, "messageId": new_message.id})

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

    conversation_id = message.conversation_id
    member_ids = [
        item.user_id
        for item in db.query(models.ConversationMember.user_id)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    ]
    db.delete(message)
    db.commit()
    _dispatch_notification(
        member_ids,
        {
            "type": "conversation_updated",
            "conversationId": conversation_id,
            "messageId": message_id,
        },
    )
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

    # Verify that all invited members (except self) are friends
    other_member_ids = [uid for uid in payload.member_ids if uid != current_user.id]
    if other_member_ids:
        accepted_friend_ids = {
            fs.friend_id
            for fs in db.query(models.Friendship)
            .filter(
                models.Friendship.user_id == current_user.id,
                models.Friendship.friend_id.in_(other_member_ids),
                models.Friendship.status == "accepted",
            )
            .all()
        }
        non_friend_ids = [uid for uid in other_member_ids if uid not in accepted_friend_ids]
        if non_friend_ids:
            raise HTTPException(status_code=403, detail=ERR_INVITE_NON_FRIEND)

    conversation = models.Conversation(is_group=True, name=group_name)
    db.add(conversation)
    db.flush()

    for member_id in member_ids:
        role = "owner" if member_id == current_user.id else "member"
        db.add(models.ConversationMember(conversation_id=conversation.id, user_id=member_id, role=role))

    # 系统消息：创建群聊
    invited_users = db.query(models.User).filter(models.User.id.in_(member_ids)).all()
    invited_names = [u.nickname or u.username for u in invited_users if u.id != current_user.id]
    creator_name = current_user.nickname or current_user.username
    sys_text = f'"{creator_name}"邀请"{"、".join(invited_names)}"加入了群聊'
    db.add(models.Message(conversation_id=conversation.id, sender_id=None, message_type="system", content=sys_text))

    db.commit()
    return {
        "message": "Group created successfully",
        "conversation_id": conversation.id,
    }


def _get_member_or_403(db: Session, conversation_id: int, user_id: int) -> models.ConversationMember:
    """获取成员记录，不存在则 403"""
    m = db.query(models.ConversationMember).filter(
        models.ConversationMember.conversation_id == conversation_id,
        models.ConversationMember.user_id == user_id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail=ERR_NOT_MEMBER_CONVERSATION)
    return m


def _ensure_group_manager(member: models.ConversationMember):
    if member.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owner or admin can perform this action")


@router.put("/groups/{conversation_id}")
def rename_group(
    conversation_id: int,
    payload: GroupRenamePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    conversation = _get_group_or_404(db, conversation_id)
    my_member = _get_member_or_403(db, conversation_id, current_user.id)

    if my_member.role != "owner":
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


@router.get("/groups/{conversation_id}/announcements")
def read_group_announcements(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _get_group_or_404(db, conversation_id)
    _get_member_or_403(db, conversation_id, current_user.id)

    announcements = (
        db.query(models.GroupAnnouncement)
        .filter(models.GroupAnnouncement.conversation_id == conversation_id)
        .order_by(models.GroupAnnouncement.created_at.desc(), models.GroupAnnouncement.id.desc())
        .all()
    )
    publisher_ids = {item.publisher_id for item in announcements if item.publisher_id is not None}
    publishers = db.query(models.User).filter(models.User.id.in_(publisher_ids)).all() if publisher_ids else []
    publisher_map = {user.id: user for user in publishers}

    return [
        {
            "id": item.id,
            "content": item.content,
            "publisherName": (publisher_map[item.publisher_id].nickname or publisher_map[item.publisher_id].username)
            if item.publisher_id in publisher_map
            else "系统",
            "createdAt": _format_display_datetime(item.created_at),
        }
        for item in announcements
    ]


@router.post("/groups/{conversation_id}/announcements")
def create_group_announcement(
    conversation_id: int,
    payload: GroupAnnouncementPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _get_group_or_404(db, conversation_id)
    my_member = _get_member_or_403(db, conversation_id, current_user.id)
    _ensure_group_manager(my_member)

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Announcement content cannot be empty")

    announcement = models.GroupAnnouncement(
        conversation_id=conversation_id,
        publisher_id=current_user.id,
        content=content,
    )
    db.add(announcement)
    db.flush()

    # 系统消息：发布群公告
    publisher_name = current_user.nickname or current_user.username
    sys_text = f'"{publisher_name}"发布了新公告：{content}'
    sys_msg = models.Message(conversation_id=conversation_id, sender_id=None, message_type="system", content=sys_text)
    db.add(sys_msg)

    db.commit()
    db.refresh(announcement)
    db.refresh(sys_msg)

    # 实时推送：让所有成员看到系统消息+公告弹窗
    member_ids = [
        item.user_id
        for item in db.query(models.ConversationMember.user_id)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    ]
    _dispatch_notification(
        member_ids,
        {
            "type": "conversation_updated",
            "conversationId": conversation_id,
            "messageId": sys_msg.id,
            "message": {
                "id": sys_msg.id,
                "text": sys_msg.content,
                "type": "system",
                "senderId": None,
                "senderName": None,
                "time": _format_message_time(sys_msg.timestamp),
                "timestamp": sys_msg.timestamp.isoformat() if sys_msg.timestamp else None,
                "replyToId": None,
            },
            "announcement": {
                "id": announcement.id,
                "content": announcement.content,
                "publisherName": publisher_name,
            },
        },
    )
    return {
        "message": "Announcement published successfully",
        "announcement": {
            "id": announcement.id,
            "content": announcement.content,
            "publisherName": current_user.nickname or current_user.username,
            "createdAt": _format_display_datetime(announcement.created_at),
        },
    }


@router.get("/groups/{conversation_id}/announcements/unconfirmed")
def get_unconfirmed_announcements(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """获取当前用户未确认的群公告"""
    _get_group_or_404(db, conversation_id)
    _get_member_or_403(db, conversation_id, current_user.id)

    confirmed_ids = {
        c.announcement_id
        for c in db.query(models.AnnouncementConfirmation)
        .filter(models.AnnouncementConfirmation.user_id == current_user.id)
        .all()
    }
    announcements = (
        db.query(models.GroupAnnouncement)
        .filter(models.GroupAnnouncement.conversation_id == conversation_id)
        .order_by(models.GroupAnnouncement.created_at.desc())
        .all()
    )
    unconfirmed = [a for a in announcements if a.id not in confirmed_ids]
    if not unconfirmed:
        return []

    publisher_ids = {a.publisher_id for a in unconfirmed if a.publisher_id}
    publishers = db.query(models.User).filter(models.User.id.in_(publisher_ids)).all() if publisher_ids else []
    pub_map = {u.id: u for u in publishers}
    return [
        {
            "id": a.id,
            "content": a.content,
            "publisherName": (pub_map[a.publisher_id].nickname or pub_map[a.publisher_id].username) if a.publisher_id in pub_map else "系统",
            "createdAt": _format_display_datetime(a.created_at),
        }
        for a in unconfirmed
    ]


@router.post("/groups/{conversation_id}/announcements/{announcement_id}/confirm")
def confirm_announcement(
    conversation_id: int,
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """确认群公告"""
    _get_group_or_404(db, conversation_id)
    _get_member_or_403(db, conversation_id, current_user.id)

    existing = db.query(models.AnnouncementConfirmation).filter(
        models.AnnouncementConfirmation.announcement_id == announcement_id,
        models.AnnouncementConfirmation.user_id == current_user.id,
    ).first()
    if not existing:
        db.add(models.AnnouncementConfirmation(announcement_id=announcement_id, user_id=current_user.id))
        db.commit()
    return {"message": "Confirmed"}


@router.post("/groups/{conversation_id}/invite")
def invite_group_members(
    conversation_id: int,
    payload: GroupInvitePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """邀请成员加入群聊"""
    _get_group_or_404(db, conversation_id)
    _get_member_or_403(db, conversation_id, current_user.id)

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

    # 验证所有被邀请者都是当前用户的好友（accepted 状态）
    accepted_friend_ids = {
        fs.friend_id
        for fs in db.query(models.Friendship)
        .filter(
            models.Friendship.user_id == current_user.id,
            models.Friendship.friend_id.in_(payload.member_ids),
            models.Friendship.status == "accepted",
        )
        .all()
    }
    non_friend_ids = [uid for uid in payload.member_ids if uid not in accepted_friend_ids]
    if non_friend_ids:
        raise HTTPException(status_code=403, detail=ERR_INVITE_NON_FRIEND)

    # 过滤掉已经在群里的成员
    new_member_ids = [uid for uid in payload.member_ids if uid not in existing_member_ids]

    if not new_member_ids:
        raise HTTPException(status_code=400, detail="All selected users are already in the group")

    # 添加新成员
    for member_id in new_member_ids:
        db.add(models.ConversationMember(conversation_id=conversation_id, user_id=member_id))

    # 系统消息：邀请成员
    new_users = db.query(models.User).filter(models.User.id.in_(new_member_ids)).all()
    new_names = [u.nickname or u.username for u in new_users]
    inviter_name = current_user.nickname or current_user.username
    sys_text = f'"{inviter_name}"邀请"{"、".join(new_names)}"加入了群聊'
    sys_msg = models.Message(conversation_id=conversation_id, sender_id=None, message_type="system", content=sys_text)
    db.add(sys_msg)

    db.commit()
    db.refresh(sys_msg)
    # 通知所有成员（包括新加入的）
    all_member_ids = existing_member_ids | set(new_member_ids)
    _dispatch_notification(all_member_ids, {"type": "conversation_updated", "conversationId": conversation_id, "messageId": sys_msg.id})
    return {
        "message": "Members invited successfully",
        "conversation_id": conversation_id,
        "invited_count": len(new_member_ids),
    }


@router.post("/groups/{conversation_id}/invite-requests")
def create_group_invite_request(
    conversation_id: int,
    payload: GroupInviteRequestPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    conversation = _get_group_or_404(db, conversation_id)
    _get_member_or_403(db, conversation_id, current_user.id)

    invitee_id = payload.invitee_id
    _ensure_not_self_friend(current_user.id, invitee_id)
    invitee = _get_user_or_404(db, invitee_id)

    existing_member_ids = {
        item.user_id
        for item in db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    }
    if invitee_id in existing_member_ids:
        raise HTTPException(status_code=400, detail="Target user is already in the group")

    accepted_friend = (
        db.query(models.Friendship)
        .filter(
            models.Friendship.user_id == current_user.id,
            models.Friendship.friend_id == invitee_id,
            models.Friendship.status == "accepted",
        )
        .first()
    )
    if not accepted_friend:
        raise HTTPException(status_code=403, detail=ERR_INVITE_NON_FRIEND)

    existing_request = (
        db.query(models.GroupInviteRequest)
        .filter(
            models.GroupInviteRequest.conversation_id == conversation_id,
            models.GroupInviteRequest.invitee_id == invitee_id,
            models.GroupInviteRequest.status == "pending",
        )
        .first()
    )
    if existing_request:
        raise HTTPException(status_code=400, detail="An invite request for this user is already pending")

    invite_request = models.GroupInviteRequest(
        conversation_id=conversation_id,
        requester_id=current_user.id,
        invitee_id=invitee_id,
    )
    db.add(invite_request)
    db.commit()
    db.refresh(invite_request)
    manager_ids = [
        item.user_id
        for item in db.query(models.ConversationMember.user_id)
        .filter(
            models.ConversationMember.conversation_id == conversation_id,
            models.ConversationMember.role.in_(("owner", "admin")),
        )
        .all()
    ]
    _dispatch_notification(
        manager_ids,
        {
            "type": "group_invite_request_updated",
            "conversationId": conversation_id,
            "requestId": invite_request.id,
        },
    )
    return {
        "message": "Invite request submitted successfully",
        "request": _serialize_group_invite_request(invite_request, current_user, invitee, conversation),
    }


@router.get("/groups/invite-requests")
def read_group_invite_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    memberships = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.user_id == current_user.id)
        .all()
    )
    manageable_group_ids = [
        item.conversation_id
        for item in memberships
        if item.role in ("owner", "admin")
    ]
    if not manageable_group_ids:
        return []

    requests = (
        db.query(models.GroupInviteRequest)
        .filter(
            models.GroupInviteRequest.conversation_id.in_(manageable_group_ids),
            models.GroupInviteRequest.status == "pending",
        )
        .order_by(models.GroupInviteRequest.created_at.desc(), models.GroupInviteRequest.id.desc())
        .all()
    )
    if not requests:
        return []

    requester_ids = {item.requester_id for item in requests}
    invitee_ids = {item.invitee_id for item in requests}
    conversation_ids = {item.conversation_id for item in requests}
    users = db.query(models.User).filter(models.User.id.in_(requester_ids | invitee_ids)).all()
    user_map = {user.id: user for user in users}
    conversations = db.query(models.Conversation).filter(models.Conversation.id.in_(conversation_ids)).all()
    conversation_map = {conversation.id: conversation for conversation in conversations}

    return [
        _serialize_group_invite_request(
            item,
            user_map[item.requester_id],
            user_map[item.invitee_id],
            conversation_map[item.conversation_id],
        )
        for item in requests
        if item.requester_id in user_map and item.invitee_id in user_map and item.conversation_id in conversation_map
    ]


@router.post("/groups/invite-requests/{request_id}/approve")
def approve_group_invite_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    invite_request = db.query(models.GroupInviteRequest).filter(models.GroupInviteRequest.id == request_id).first()
    if not invite_request or invite_request.status != "pending":
        raise HTTPException(status_code=404, detail="Invite request not found")

    my_member = _get_member_or_403(db, invite_request.conversation_id, current_user.id)
    _ensure_group_manager(my_member)

    existing_member = (
        db.query(models.ConversationMember)
        .filter(
            models.ConversationMember.conversation_id == invite_request.conversation_id,
            models.ConversationMember.user_id == invite_request.invitee_id,
        )
        .first()
    )
    if not existing_member:
        db.add(models.ConversationMember(conversation_id=invite_request.conversation_id, user_id=invite_request.invitee_id))

    invite_request.status = "approved"
    invite_request.reviewer_id = current_user.id
    invite_request.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    _dispatch_notification(
        [current_user.id, invite_request.requester_id, invite_request.invitee_id],
        {
            "type": "group_invite_request_updated",
            "conversationId": invite_request.conversation_id,
            "requestId": invite_request.id,
        },
    )
    return {"message": "Invite request approved successfully"}


@router.post("/groups/invite-requests/{request_id}/reject")
def reject_group_invite_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    invite_request = db.query(models.GroupInviteRequest).filter(models.GroupInviteRequest.id == request_id).first()
    if not invite_request or invite_request.status != "pending":
        raise HTTPException(status_code=404, detail="Invite request not found")

    my_member = _get_member_or_403(db, invite_request.conversation_id, current_user.id)
    _ensure_group_manager(my_member)

    invite_request.status = "rejected"
    invite_request.reviewer_id = current_user.id
    invite_request.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    _dispatch_notification(
        [current_user.id, invite_request.requester_id, invite_request.invitee_id],
        {
            "type": "group_invite_request_updated",
            "conversationId": invite_request.conversation_id,
            "requestId": invite_request.id,
        },
    )
    return {"message": "Invite request rejected successfully"}


@router.get("/groups/{conversation_id}/members")
def read_group_members(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _get_group_or_404(db, conversation_id)
    _get_member_or_403(db, conversation_id, current_user.id)

    members = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .order_by(models.ConversationMember.id.asc())
        .all()
    )
    users = db.query(models.User).filter(models.User.id.in_([item.user_id for item in members])).all()
    user_map = {user.id: user for user in users}

    role_order = {"owner": 0, "admin": 1, "member": 2}
    payload_list = []
    for member in members:
        user = user_map.get(member.user_id)
        if not user:
            continue
        display_name = member.group_nickname or user.nickname or user.username
        payload_list.append(
            {
                "id": user.id,
                "name": user.username,
                "displayName": display_name,
                "groupNickname": member.group_nickname or "",
                "avatar": user.avatar or "/aegis-avatar-warden-v2.png",
                "role": member.role or "member",
            }
        )
    payload_list.sort(key=lambda x: role_order.get(x["role"], 2))
    return payload_list


@router.post("/groups/{conversation_id}/exit")
def exit_group(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    conversation = _get_group_or_404(db, conversation_id)
    membership = _get_member_or_403(db, conversation_id, current_user.id)

    # 群主不能直接退出，必须先转让群主
    if membership.role == "owner":
        raise HTTPException(status_code=403, detail=ERR_OWNER_CANNOT_LEAVE)

    user_name = current_user.nickname or current_user.username
    # 收集退出前的成员 ID（含自己）用于通知
    pre_exit_member_ids = {
        m.user_id for m in db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    }
    pre_exit_member_ids.add(current_user.id)

    db.delete(membership)
    db.flush()

    remaining_members = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    )

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
    else:
        sys_msg = models.Message(conversation_id=conversation_id, sender_id=None, message_type="system", content=f'"{user_name}"退出了群聊')
        db.add(sys_msg)
        db.commit()
        db.refresh(sys_msg)
        _dispatch_notification(pre_exit_member_ids, {"type": "conversation_updated", "conversationId": conversation_id, "messageId": sys_msg.id})

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
    """解散群聊 - 只有群主可以执行"""
    conversation = _get_group_or_404(db, conversation_id)
    my_member = _get_member_or_403(db, conversation_id, current_user.id)

    if my_member.role != "owner":
        raise HTTPException(status_code=403, detail=ERR_ONLY_OWNER_CAN_DISMISS)

    messages = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation_id)
        .all()
    )
    for message in messages:
        db.delete(message)

    members = (
        db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    )
    for member in members:
        db.delete(member)

    db.delete(conversation)
    db.commit()

    return {
        "message": "Group dismissed successfully",
        "conversation_id": conversation_id,
    }


@router.post("/groups/{conversation_id}/transfer")
def transfer_group_ownership(
    conversation_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """转让群主 - 只有群主可执行"""
    _get_group_or_404(db, conversation_id)
    my_member = _get_member_or_403(db, conversation_id, current_user.id)
    if my_member.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can transfer ownership")

    new_owner_id = payload.get("new_owner_id")
    if not new_owner_id:
        raise HTTPException(status_code=400, detail="new_owner_id is required")
    if new_owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot transfer ownership to yourself")

    new_owner_member = db.query(models.ConversationMember).filter(
        models.ConversationMember.conversation_id == conversation_id,
        models.ConversationMember.user_id == new_owner_id,
    ).first()
    if not new_owner_member:
        raise HTTPException(status_code=404, detail="Target user is not in the group")

    my_member.role = "member"
    new_owner_member.role = "owner"
    new_owner_user = db.query(models.User).filter(models.User.id == new_owner_id).first()
    new_owner_name = new_owner_user.nickname or new_owner_user.username if new_owner_user else str(new_owner_id)
    sys_msg = models.Message(conversation_id=conversation_id, sender_id=None, message_type="system", content=f'"{new_owner_name}"已成为新群主')
    db.add(sys_msg)
    db.commit()
    db.refresh(sys_msg)
    member_ids = {
        m.user_id for m in db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    }
    _dispatch_notification(member_ids, {"type": "conversation_updated", "conversationId": conversation_id, "messageId": sys_msg.id})
    return {"message": "Ownership transferred successfully"}


@router.post("/groups/{conversation_id}/kick")
def kick_group_member(
    conversation_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """踢人 - 群主可踢任何人，管理员可踢普通成员"""
    _get_group_or_404(db, conversation_id)
    my_member = _get_member_or_403(db, conversation_id, current_user.id)

    if my_member.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owner or admin can kick members")

    target_id = payload.get("user_id")
    if not target_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    if target_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot kick yourself")

    target_member = db.query(models.ConversationMember).filter(
        models.ConversationMember.conversation_id == conversation_id,
        models.ConversationMember.user_id == target_id,
    ).first()
    if not target_member:
        raise HTTPException(status_code=404, detail="Target user is not in the group")

    if my_member.role == "admin" and target_member.role in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admins can only kick regular members")

    target_user = db.query(models.User).filter(models.User.id == target_id).first()
    target_name = target_user.nickname or target_user.username if target_user else str(target_id)
    db.delete(target_member)
    sys_msg = models.Message(conversation_id=conversation_id, sender_id=None, message_type="system", content=f'"{target_name}"被移出了群聊')
    db.add(sys_msg)
    db.commit()
    db.refresh(sys_msg)
    # 通知剩余成员和被踢者
    remaining_ids = {
        m.user_id for m in db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    }
    remaining_ids.add(target_id)
    _dispatch_notification(remaining_ids, {"type": "conversation_updated", "conversationId": conversation_id, "messageId": sys_msg.id})
    return {"message": "Member kicked successfully"}


@router.put("/groups/{conversation_id}/admin")
def set_group_admin(
    conversation_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """设置/取消管理员 - 只有群主可执行"""
    _get_group_or_404(db, conversation_id)
    my_member = _get_member_or_403(db, conversation_id, current_user.id)
    if my_member.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can set admins")

    target_id = payload.get("user_id")
    is_admin = payload.get("is_admin", True)
    if not target_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    if target_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    target_member = db.query(models.ConversationMember).filter(
        models.ConversationMember.conversation_id == conversation_id,
        models.ConversationMember.user_id == target_id,
    ).first()
    if not target_member:
        raise HTTPException(status_code=404, detail="Target user is not in the group")

    target_member.role = "admin" if is_admin else "member"
    target_user = db.query(models.User).filter(models.User.id == target_id).first()
    target_name = target_user.nickname or target_user.username if target_user else str(target_id)
    action = "成为了管理员" if is_admin else "被取消了管理员"
    sys_msg = models.Message(conversation_id=conversation_id, sender_id=None, message_type="system", content=f'"{target_name}"{action}')
    db.add(sys_msg)
    db.commit()
    db.refresh(sys_msg)
    member_ids = {
        m.user_id for m in db.query(models.ConversationMember)
        .filter(models.ConversationMember.conversation_id == conversation_id)
        .all()
    }
    _dispatch_notification(member_ids, {"type": "conversation_updated", "conversationId": conversation_id, "messageId": sys_msg.id})
    return {"message": "Role updated successfully", "role": target_member.role}


@router.put("/groups/{conversation_id}/nickname")
def update_group_nickname(
    conversation_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """修改我在本群的昵称"""
    _get_group_or_404(db, conversation_id)
    my_member = _get_member_or_403(db, conversation_id, current_user.id)

    nickname = payload.get("nickname", "").strip()
    my_member.group_nickname = nickname if nickname else None
    db.commit()
    return {"message": "Group nickname updated", "group_nickname": my_member.group_nickname or ""}


from fastapi.responses import JSONResponse


@router.get("/poll/{user_id}")
async def long_poll_endpoint(user_id: int, timeout: int = Query(default=25, le=55)):
    """HTTP 长轮询端点，作为 WebSocket 的降级方案"""
    queue = asyncio.Queue()
    if user_id not in manager.poll_queues:
        manager.poll_queues[user_id] = []
    manager.poll_queues[user_id].append(queue)
    try:
        notifications = []
        try:
            msg = await asyncio.wait_for(queue.get(), timeout=timeout)
            notifications.append(msg)
            # 取出队列中所有已有的消息
            while not queue.empty():
                notifications.append(queue.get_nowait())
        except asyncio.TimeoutError:
            pass
        return JSONResponse(notifications)
    finally:
        if user_id in manager.poll_queues:
            if queue in manager.poll_queues[user_id]:
                manager.poll_queues[user_id].remove(queue)
            if not manager.poll_queues[user_id]:
                del manager.poll_queues[user_id]


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    print(f"🔌 WebSocket 连接请求: user_id={user_id}, client={websocket.client}")
    await manager.connect(websocket, user_id)
    print(f"✅ WebSocket 连接成功: user_id={user_id}")
    try:
        while True:
            data = await websocket.receive_text()
            # 支持通过 WebSocket 发送消息
            try:
                payload = json.loads(data)
                if payload.get("action") == "send_message":
                    conv_id = payload["conversation_id"]
                    content = (payload.get("content") or "").strip()
                    if not content:
                        continue
                    # 验证成员身份
                    membership = db.query(models.ConversationMember).filter(
                        models.ConversationMember.conversation_id == conv_id,
                        models.ConversationMember.user_id == user_id
                    ).first()
                    if not membership:
                        continue
                    sender = db.query(models.User).filter(models.User.id == user_id).first()
                    # 解析 @ 用户
                    cleaned_content, mentioned_user_ids = _parse_mentioned_users(content, conv_id, db)
                    new_message = models.Message(
                        conversation_id=conv_id,
                        sender_id=user_id,
                        reply_to_id=payload.get("reply_to_id"),
                        content=cleaned_content,
                        mentioned_user_ids=mentioned_user_ids,
                    )
                    db.add(new_message)
                    db.commit()
                    db.refresh(new_message)
                    member_ids = [
                        m.user_id for m in db.query(models.ConversationMember.user_id)
                        .filter(models.ConversationMember.conversation_id == conv_id).all()
                    ]
                    sender_name = (sender.nickname or sender.username) if sender else "系统"
                    await manager.notify_users(member_ids, {
                        "type": "conversation_updated",
                        "conversationId": conv_id,
                        "messageId": new_message.id,
                        "message": _serialize_notification_message(new_message, sender_name),
                    })
                    bot_message = _create_group_bot_reply_if_needed(db, conv_id, content, new_message.id)
                    if bot_message:
                        await manager.notify_users(member_ids, {
                            "type": "conversation_updated",
                            "conversationId": conv_id,
                            "messageId": bot_message.id,
                            "message": _serialize_notification_message(bot_message, ai_gateway.BOT_NAME),
                        })
            except (json.JSONDecodeError, KeyError):
                pass
    except WebSocketDisconnect:
        # --- 核心逻辑：用户关闭网页会触发这里 ---
        print(f"❌ WebSocket 断开: user_id={user_id}")
        manager.disconnect(websocket, user_id)
        
        # 重新获取 user 实例防止 session 异常
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user:
            # 只有当用户不是“隐身”时，才自动设为离线
            # 这样隐身用户关了网页，在别人眼里依然是离线（符合逻辑）
            if user.status != "invisible":
                user.status = "offline"
                db.commit()
    finally:
        db.close()
