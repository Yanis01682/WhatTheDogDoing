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
  handleComposerResizeStart
}) {
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)

  const renderMessageAvatar = (avatarValue, onClick) => {
    if (typeof avatarValue === 'string' && avatarValue.startsWith('data:image')) {
      return (
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
      )
    }

    return (
      <div className="message-avatar" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
        {avatarValue || '用'}
      </div>
    )
  }

  return (
    <section className="panel chat-panel">
      <header className="chat-topbar">
        <div className="chat-user">
          <div className="avatar large">{getCurrentSession().avatar}</div>
          <div>
            <h2>{getCurrentSession().title}</h2>
            {getCurrentSession().isGroup ? (
              (() => {
                const members = groupMembers[currentChat] || []
                const onlineCount = members.filter((m) => m.online).length
                return onlineCount > 0 ? (
                  <span className="online-status clickable" onClick={handleOpenMemberList} style={{ cursor: 'pointer' }}>
                    <span className="online-dot"></span>
                    {onlineCount}人在线
                  </span>
                ) : (
                  <span className="online-status">离线</span>
                )
              })()
            ) : (
              <span className="online-status">
                <span className={`online-dot ${getCurrentSession().online > 0 ? 'online' : 'offline'}`}></span>
                {getCurrentSession().online > 0 ? '在线' : '离线'}
              </span>
            )}
          </div>
        </div>
        <div className="chat-actions">
          <button className="icon-btn" type="button" aria-label="搜索消息">🔍</button>
          <button className="icon-btn" type="button" aria-label="更多操作" onClick={handleOpenChatDetail}>⋯</button>
        </div>
      </header>

      <div className="chat-messages" onClick={handleMessagesClick}>
        {messages[currentChat]?.map((msg, index) => (
          <div
            key={msg.id}
            data-message-index={index}
            className={`message ${msg.sender === 'me' ? 'outgoing' : msg.sender === 'system' ? 'system-message' : 'incoming'} ${msg.replyTo ? 'has-reply' : ''}`}
            onContextMenu={(e) => handleMessageContextMenu(e, msg)}
          >
            {msg.sender !== 'system' && (
              msg.sender === 'me'
                ? renderMessageAvatar(userAvatar)
                : renderMessageAvatar(getCurrentSession().avatar, () => handleOpenPeerProfile(msg))
            )}
            <div className="message-content">
              {msg.replyTo && (
                <div className="message-reply">
                  <span className="reply-label">
                    {msg.replyTo.sender === 'me' ? '回复自己' : '回复'} {msg.replyTo.sender === 'other' ? '对方' : msg.replyTo.sender}:
                  </span>
                  <span className="reply-text">{msg.replyTo.text}</span>
                </div>
              )}
              <div className="bubble">
                {msg.type === 'image' && msg.mediaUrl ? (
                  <div className="message-media-wrap">
                    <img className="message-media-image" src={msg.mediaUrl} alt={msg.mediaName || '图片消息'} />
                  </div>
                ) : msg.type === 'video' && msg.mediaUrl ? (
                  <div className="message-media-wrap">
                    <video className="message-media-video" src={msg.mediaUrl} controls preload="metadata" />
                  </div>
                ) : (
                  msg.text
                )}
              </div>
              <span className="message-time">{msg.time}</span>
            </div>
          </div>
        ))}
      </div>

      <footer className="composer" style={{ height: `${composerHeight}px` }}>
        {replyToMessage && (
          <div className="reply-preview">
            <div className="reply-preview-content">
              <span className="reply-preview-label">
                {replyToMessage.sender === 'me' ? '回复自己' : '回复'} {replyToMessage.sender === 'other' ? '对方' : replyToMessage.sender}:
              </span>
              <span className="reply-preview-text">{replyToMessage.text}</span>
            </div>
            <button className="cancel-reply-btn" type="button" aria-label="取消回复" onClick={cancelReply}>✕</button>
          </div>
        )}

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
          rows="3"
        />

        <div className="composer-actions">
          <button className="send-btn" onClick={handleSendMessage}>发送</button>
        </div>

        <div className={`composer-resize-handle ${isComposingResizing ? 'resizing' : ''}`} onMouseDown={handleComposerResizeStart}></div>
      </footer>
    </section>
  )
}

export default ChatMainView
