# backend/app/chat.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .database import get_db
from . import models, auth # 使用相对导入，修复可能的模块引用问题

router = APIRouter()

@router.get("/sessions")
def read_sessions(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """获取当前用户参与的所有会话列表"""
    # 查找用户参与的所有会话记录
    memberships = db.query(models.ConversationMember).filter(
        models.ConversationMember.user_id == current_user.id
    ).all()
    
    conv_ids = [m.conversation_id for m in memberships]
    if not conv_ids:
        return []

    # 按照更新时间倒序获取会话
    conversations = db.query(models.Conversation).filter(
        models.Conversation.id.in_(conv_ids)
    ).order_by(models.Conversation.updated_at.desc()).all()
    
    result = []
    for conv in conversations:
        title = conv.name
        # 如果是私聊，前端显示的标题应该是对方的名字
        if not conv.is_group:
            other_member = db.query(models.ConversationMember).filter(
                models.ConversationMember.conversation_id == conv.id,
                models.ConversationMember.user_id != current_user.id
            ).first()
            if other_member:
                other_user = db.query(models.User).filter(models.User.id == other_member.user_id).first()
                title = other_user.nickname or other_user.username if other_user else "未知用户"

        result.append({
            "id": conv.id,
            "is_group": conv.is_group,
            "title": title,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None
        })
        
    return result

@router.get("/friends")
def get_friends(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """获取当前用户的好友列表"""
    # 获取我发起的且状态为已通过的好友
    friends_initiated = db.query(models.User).join(
        models.Friendship, models.Friendship.friend_id == models.User.id
    ).filter(
        models.Friendship.user_id == current_user.id,
        models.Friendship.status == "accepted"
    ).all()
    
    # 获取向我发起且状态为已通过的好友
    friends_received = db.query(models.User).join(
        models.Friendship, models.Friendship.user_id == models.User.id
    ).filter(
        models.Friendship.friend_id == current_user.id,
        models.Friendship.status == "accepted"
    ).all()
    
    # 合并并去重
    all_friends = {f.id: f for f in friends_initiated + friends_received}.values()
    
    return [
        {
            "id": f.id,
            "username": f.username,
            "nickname": f.nickname,
            "bio": f.bio
        } for f in all_friends
    ]

@router.post("/friends/add")
def add_friend(friend_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """直接添加好友并创建私聊会话（目前为简化逻辑，直接 accepted）"""
    if friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能添加自己为好友")

    # 检查是否已经是好友
    existing = db.query(models.Friendship).filter(
        ((models.Friendship.user_id == current_user.id) & (models.Friendship.friend_id == friend_id)) |
        ((models.Friendship.user_id == friend_id) & (models.Friendship.friend_id == current_user.id))
    ).first()
    
    if existing:
        return {"message": "Already friends or requested"}

    # 创建好友关系
    new_friendship = models.Friendship(user_id=current_user.id, friend_id=friend_id, status="accepted")
    db.add(new_friendship)
    
    # 创建两人间的私聊会话
    new_conv = models.Conversation(is_group=False, name=f"Private Chat")
    db.add(new_conv)
    db.flush() # 获取新对话的 ID 且不提交事务

    member1 = models.ConversationMember(conversation_id=new_conv.id, user_id=current_user.id)
    member2 = models.ConversationMember(conversation_id=new_conv.id, user_id=friend_id)
    db.add_all([member1, member2])
    
    db.commit()
    return {"message": "Friend added and conversation created", "conversation_id": new_conv.id}

@router.post("/messages/send")
def send_message(conversation_id: int, content: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """发送消息"""
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
    
    # 更新会话的最后活跃时间
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if conv:
        # SQLAlchemy onupdate 会自动更新更新时间
        conv.name = conv.name 
        
    db.commit()
    return {"status": "sent", "message_id": new_msg.id}

@router.get("/messages")
def get_messages(conversation_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """获取指定会话的历史消息记录"""
    # 1. 校验权限：当前用户必须是该会话的成员
    is_member = db.query(models.ConversationMember).filter(
        models.ConversationMember.conversation_id == conversation_id,
        models.ConversationMember.user_id == current_user.id
    ).first()
    
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    # 2. 获取消息记录（按创建时间升序排列，即旧消息在前，新消息在底）
    messages = db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id
    ).order_by(models.Message.created_at.asc()).all()

    # 3. 格式化返回数据
    return [
        {
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "sender_id": msg.sender_id,
            "content": msg.content,
            "created_at": msg.created_at.isoformat() if msg.created_at else None
        } for msg in messages
    ]