from datetime import datetime

from sqlalchemy import Text, Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.mysql import MEDIUMTEXT as _MySQLMEDIUMTEXT
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="offline")
    last_status = Column(String, default="online")  # 记录上次登出前的在线状态，用于登录后恢复
    nickname = Column(String(64), nullable=True)
    gender = Column(String(16), nullable=True)
    phone = Column(String(32), nullable=True)
    bio = Column(String(500), nullable=True)
    avatar = Column(Text().with_variant(_MySQLMEDIUMTEXT(), 'mysql'), nullable=True)  # 头像：SQLite TEXT / MySQL MEDIUMTEXT


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    is_group = Column(Boolean, default=False, nullable=False)
    name = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ConversationMember(Base):
    __tablename__ = "conversation_members"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    read_index = Column(Integer, default=0, nullable=False)
    role = Column(String(16), default="member", nullable=False)  # owner / admin / member
    group_nickname = Column(String(64), nullable=True)  # 在本群的昵称


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reply_to_id = Column(Integer, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True, index=True)
    message_type = Column(String(20), nullable=False, default="text")  # text, image
    content = Column(String(2000), nullable=True)  # 文本内容，图片消息时可为空
    media_url = Column(String(500), nullable=True)  # 图片URL路径
    media_data = Column(Text().with_variant(_MySQLMEDIUMTEXT(), 'mysql'), nullable=True)  # 持久化图片内容
    media_name = Column(String(200), nullable=True)  # 原始文件名
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ConversationPin(Base):
    __tablename__ = "conversation_pins"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    friend_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(32), default="pending")
    remark = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class GroupAnnouncement(Base):
    __tablename__ = "group_announcements"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    publisher_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    content = Column(String(1000), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class GroupInviteRequest(Base):
    __tablename__ = "group_invite_requests"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    invitee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String(32), default="pending", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
