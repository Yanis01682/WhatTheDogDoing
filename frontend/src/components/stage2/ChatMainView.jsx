import { useRef } from 'react'

/**
 * 聊天主窗体组件。
 * 包含：聊天头部、消息流、输入区和回复预览，所有状态由父组件托管。
 */
function ChatMainView({
  // 读取当前会话对象。
  getCurrentSession,
  // 群成员数据，用于统计在线人数。
  groupMembers,
  // 当前会话 id。
  currentChat,
  // 当前用户头像（文字或 base64 图片）。
  userAvatar,
  // 点击对方头像打开详情页。
  handleOpenPeerProfile,
  // 打开成员列表弹窗。
  handleOpenMemberList,
  // 打开聊天详情弹窗。
  handleOpenChatDetail,
  // 打开查找消息弹窗。
  handleOpenSearchMessage,
  // 全量消息映射（按会话 id）。
  messages,
  // 点击消息列表时执行的处理函数（用于关闭右键菜单）。
  handleMessagesClick,
  // 消息右键菜单触发函数。
  handleMessageContextMenu,
  // 输入区高度。
  composerHeight,
  // 当前回复目标消息。
  replyToMessage,
  // 取消回复。
  cancelReply,
  // 表情面板显示状态。
  showEmojiPicker,
  // 切换表情面板显示。
  toggleEmojiPicker,
  // 输入框文本。
  messageInput,
  // 更新输入框文本。
  setMessageInput,
  // 键盘回车发送逻辑。
  handleKeyPress,
  // 发送消息逻辑。
  handleSendMessage,
  // 发送图片消息。
  handleSendImage,
  // 发送视频消息。
  handleSendVideo,
  // 输入区高度拖拽状态。
  isComposingResizing,
  // 开始拖拽输入区高度。
  handleComposerResizeStart,
  // 打开个人信息页面。
  handleOpenProfile
}) {
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const currentSession = getCurrentSession()
  const hasActiveConversation = Boolean(currentSession?.id)

  const renderMessageAvatar = (avatarValue, onClick) => {
    if (typeof avatarValue === 'string' && avatarValue.startsWith('data:image')) {
      return (
        <div className="message-avatar-wrapper">
          <div
            className="message-avatar"
            onClick={onClick}
            style={{
              backgroundImage: `url(${avatarValue})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              cursor: onClick ? 'pointer' : 'default'
            }}
          ></div>
        </div>
      )
    }

    return (
      <div className="message-avatar-wrapper">
        <div className="message-avatar" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
          {avatarValue || '用'}
        </div>
      </div>
    )
  }

  if (!hasActiveConversation) {
    return (
      <section className="panel chat-panel empty-wechat-panel">
      </section>
    )
  }

  return (
    <section className="panel chat-panel">
      <header className="chat-topbar">
        <div className="chat-user">
          <div className="avatar large">{currentSession.avatar}</div>
          <div>
            <h2>{currentSession.title}</h2>
            {currentSession.isGroup && (
              <span className="online-status clickable" onClick={handleOpenMemberList} style={{ cursor: 'pointer' }}>
                {(groupMembers[currentChat] || []).length}位成员
              </span>
            )}
          </div>
        </div>
        <div className="chat-actions">
          <button className="icon-btn" type="button" aria-label="搜索消息" onClick={handleOpenSearchMessage} disabled={!hasActiveConversation}>🔍</button>
          <button className="icon-btn" type="button" aria-label="更多操作" onClick={handleOpenChatDetail} disabled={!hasActiveConversation}>⋯</button>
        </div>
      </header>

      <div className="chat-messages" onClick={handleMessagesClick}>
        {messages[currentChat]?.map((msg, index) => {
          // 在群聊中，根据消息发送者 ID 获取真实的成员头像和名称
          let peerAvatar = currentSession.avatar
          if (currentSession.isGroup && msg.sender !== 'me' && msg.sender !== 'system') {
            const members = groupMembers[currentChat] || []
            const member = members.find((m) => m.id === msg.senderId) || members.find((m) => m.name === msg.senderName)
            if (member) {
              peerAvatar = member.avatar || currentSession.avatar
            }
          }

          return (
          <div
            key={msg.id}
            data-message-index={index}
            className={`message ${msg.sender === 'me' ? 'outgoing' : msg.sender === 'system' ? 'system-message' : 'incoming'} ${msg.replyTo || msg.replyToId ? 'has-reply' : ''}`}
            onContextMenu={(e) => handleMessageContextMenu(e, msg)}
          >
            {msg.sender !== 'system' && (
              msg.sender === 'me'
                ? renderMessageAvatar(userAvatar, handleOpenProfile)
                : renderMessageAvatar(peerAvatar, () => handleOpenPeerProfile(msg))
            )}
            <div className="message-content">
              <div className="bubble">
                {msg.type === 'image' && msg.mediaUrl ? (
                  <div className="message-media-wrap">
                    <img 
                      className="message-media-image" 
                      src={msg.mediaUrl.startsWith('http') ? msg.mediaUrl : `http://localhost:8000${msg.mediaUrl}`}
                      alt={msg.mediaName || '图片消息'} 
                    />
                  </div>
                ) : msg.type === 'video' && msg.mediaUrl ? (
                  <div className="message-media-wrap">
                    <video 
                      className="message-media-video" 
                      src={msg.mediaUrl.startsWith('http') ? msg.mediaUrl : `http://localhost:8000${msg.mediaUrl}`}
                      controls 
                      preload="metadata" 
                    />
                  </div>
                ) : (
                  msg.text
                )}
              </div>
              {(msg.replyTo || msg.replyToId) && (
                <div className={`message-reply${msg.replyTo?.deleted || (!msg.replyTo && msg.replyToId) ? ' reply-deleted' : ''}`}>
                  {msg.replyTo?.deleted || (!msg.replyTo && msg.replyToId) ? (
                    <span className="reply-text reply-deleted-text">
                      {msg.replyTo?.deletedLabel || '该消息已撤回'}
                    </span>
                  ) : (
                    <>
                      <span className="reply-label">
                        回复 {msg.replyTo.senderName || (msg.replyTo.sender === 'me' ? '我' : '对方')}:
                      </span>
                      <span className="reply-text">{msg.replyTo.text}</span>
                    </>
                  )}
                </div>
              )}
              <span className="message-time">{msg.time}</span>
            </div>
          </div>
          )
        })}
      </div>

      {replyToMessage && (
        <div className="reply-preview">
          <div className="reply-preview-content">
            <span className="reply-preview-label">
              回复 {replyToMessage.senderName || (replyToMessage.sender === 'me' ? '我' : '对方')}:
            </span>
            <span className="reply-preview-text">{replyToMessage.text}</span>
          </div>
          <button className="cancel-reply-btn" type="button" aria-label="取消回复" onClick={cancelReply}>✕</button>
        </div>
      )}
      <footer className="composer" style={{ height: `${composerHeight}px` }}>

        <div className="composer-toolbar">
          <button className="toolbar-btn" type="button" aria-label="发送图片" onClick={() => imageInputRef.current?.click()}>📷</button>
          <button className="toolbar-btn" type="button" aria-label="发送视频" onClick={() => videoInputRef.current?.click()}>🎬</button>
          <button className={`toolbar-btn ${showEmojiPicker ? 'active' : ''}`} type="button" aria-label="表情" onClick={toggleEmojiPicker}>😊</button>
        </div>

        <input ref={imageInputRef} type="file" accept="image/*" className="hidden-file-input" onChange={handleSendImage} />
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden-file-input" onChange={handleSendVideo} />

        <textarea
          className="composer-input"
          placeholder="输入消息... (Shift+Enter 换行)"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={!hasActiveConversation}
          rows="3"
        />

        <div className="composer-actions">
          <button className="send-btn" onClick={handleSendMessage} disabled={!hasActiveConversation}>发送</button>
        </div>

        <div className={`composer-resize-handle ${isComposingResizing ? 'resizing' : ''}`} onMouseDown={handleComposerResizeStart}></div>
      </footer>
    </section>
  )
}

export default ChatMainView
