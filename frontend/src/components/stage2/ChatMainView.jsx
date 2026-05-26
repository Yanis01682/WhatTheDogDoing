import { useEffect, useRef } from 'react'

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
  // 外部请求跳转到某条消息。
  jumpToMessageId,
  // 跳转请求完成后的回调。
  handleJumpHandled,
  // 点击引用消息时跳转到原消息。
  handleJumpToOriginalMessage,
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
  // 发送文件消息。
  handleSendFile,
  // 录制/停止语音。
  handleVoiceRecord,
  // 是否正在录音。
  isRecording,
  // 输入区高度拖拽状态。
  isComposingResizing,
  // 开始拖拽输入区高度。
  handleComposerResizeStart,
  // 打开图片/视频灯箱
  onOpenLightbox,
  // 打开个人信息页面。
  handleOpenProfile,
  // 未确认的群公告
  pendingAnnouncements = [],
  // 确认公告回调
  onConfirmAnnouncement,
}) {
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const previousChatRef = useRef(null)
  const shouldStickToBottomRef = useRef(true)
  const currentSession = getCurrentSession()
  const hasActiveConversation = Boolean(currentSession?.id)
  const currentMessages = messages[currentChat] || []

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const isChatChanged = previousChatRef.current !== currentChat
    if (isChatChanged) {
      container.scrollTop = container.scrollHeight
      shouldStickToBottomRef.current = true
      previousChatRef.current = currentChat
      return
    }

    if (shouldStickToBottomRef.current) {
      container.scrollTop = container.scrollHeight
    }
  }, [currentChat, currentMessages.length])

  useEffect(() => {
    if (!jumpToMessageId) return
    const container = messagesContainerRef.current
    const messageElement = container?.querySelector(`[data-message-id="${jumpToMessageId}"]`)
    if (messageElement) {
      shouldStickToBottomRef.current = false
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      messageElement.classList.add('highlighted-message')
      window.setTimeout(() => {
        messageElement.classList.remove('highlighted-message')
      }, 2000)
    }
    handleJumpHandled?.()
  }, [jumpToMessageId, handleJumpHandled])
  const replyCountMap = {}
  currentMessages.forEach((message) => {
    if (message.replyToId) {
      replyCountMap[message.replyToId] = (replyCountMap[message.replyToId] || 0) + 1
    }
  })

  const renderMessageAvatar = (avatarValue, onClick) => {
    if (typeof avatarValue === 'string' && (avatarValue.startsWith('data:image') || avatarValue.startsWith('/'))) {
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
          {typeof currentSession.avatar === 'string' && (currentSession.avatar.startsWith('data:image') || currentSession.avatar.startsWith('/'))
            ? <div className="avatar large" style={{ backgroundImage: `url(${currentSession.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            : <div className="avatar large">{currentSession.avatar}</div>}
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

      <div
        className="chat-messages"
        onClick={handleMessagesClick}
        ref={messagesContainerRef}
        onScroll={(event) => {
          const container = event.currentTarget
          const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
          shouldStickToBottomRef.current = distanceToBottom < 48
        }}
      >
        {currentMessages.map((msg, index) => {
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
            data-message-id={msg.id}
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
                      src={msg.mediaUrl.startsWith('http') ? msg.mediaUrl : msg.mediaUrl}
                      alt={msg.mediaName || '图片消息'}
                      style={{ cursor: 'zoom-in' }}
                      onClick={() => onOpenLightbox?.(msg.mediaUrl, msg.mediaName)}
                    />
                  </div>
                ) : msg.type === 'video' && msg.mediaUrl ? (
                  <div className="message-media-wrap">
                    <video 
                      className="message-media-video" 
                      src={msg.mediaUrl.startsWith('http') ? msg.mediaUrl : msg.mediaUrl}
                      controls 
                      preload="metadata"
                      style={{ cursor: 'pointer' }}
                      onDoubleClick={() => onOpenLightbox?.(msg.mediaUrl, msg.mediaName, 'video')}
                    />
                  </div>
                ) : msg.type === 'file' && msg.mediaUrl ? (
                  <div className="message-file-wrap">
                    <a href={msg.mediaUrl} download={msg.mediaName} className="message-file-link">
                      📄 {msg.mediaName || '文件'}
                    </a>
                  </div>
                ) : msg.type === 'voice' && msg.mediaUrl ? (
                  <div className="message-voice-wrap">
                    <audio controls preload="metadata" src={msg.mediaUrl} />
                  </div>
                ) : (
                  msg.text
                )}
              </div>
              {(msg.replyTo || msg.replyToId) && (
                <button
                  type="button"
                  className={`message-reply${msg.replyTo?.deleted || (!msg.replyTo && msg.replyToId) ? ' reply-deleted' : ''}`}
                  onClick={() => handleJumpToOriginalMessage?.(msg.replyTo?.id || msg.replyToId)}
                >
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
                </button>
              )}
              <div className="message-meta">
                {replyCountMap[msg.id] > 0 && (
                  <span className="reply-count-chip">被回复 {replyCountMap[msg.id]} 次</span>
                )}
                <span className="message-time">{msg.time}</span>
              </div>
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
      <footer className="composer" style={{ minHeight: `${composerHeight}px` }}>

        <div className="composer-toolbar">
          <button className="toolbar-btn" type="button" aria-label="发送图片" onClick={() => imageInputRef.current?.click()}>📷</button>
          <button className="toolbar-btn" type="button" aria-label="发送视频" onClick={() => videoInputRef.current?.click()}>🎬</button>
          <button className="toolbar-btn" type="button" aria-label="发送文件" onClick={() => fileInputRef.current?.click()}>📄</button>
          <button className={`toolbar-btn ${isRecording ? 'active' : ''}`} type="button" aria-label="语音" onClick={handleVoiceRecord}>{isRecording ? '⏹️' : '🎤'}</button>
          <button className={`toolbar-btn ${showEmojiPicker ? 'active' : ''}`} type="button" aria-label="表情" onClick={toggleEmojiPicker}>😊</button>
        </div>

        <input ref={imageInputRef} type="file" accept="image/*" className="hidden-file-input" onChange={handleSendImage} />
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden-file-input" onChange={handleSendVideo} />
        <input ref={fileInputRef} type="file" className="hidden-file-input" onChange={handleSendFile} />

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

      {pendingAnnouncements.length > 0 && (
        <div className="announcement-overlay">
          <div className="announcement-popup">
            <h3>📢 群公告</h3>
            <div className="announcement-content">{pendingAnnouncements[0].content}</div>
            <button className="announcement-confirm-btn" onClick={() => onConfirmAnnouncement(pendingAnnouncements[0].id)}>我已知晓</button>
          </div>
        </div>
      )}
    </section>
  )
}

export default ChatMainView
