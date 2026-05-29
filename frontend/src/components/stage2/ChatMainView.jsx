import { useEffect, useRef } from 'react'
import { getForwardMessageLabel, normalizeForwardData } from '../../utils/forwardData'

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
  // 发起井字棋。
  handleStartTicTacToe,
  // 打开棋局。
  handleOpenTicTacToeGame,
  // 当前是否有可返回棋局。
  hasActiveTicTacToeGame,
  // 是否正在录音。
  isRecording,
  // 打开图片/视频灯箱
  onOpenLightbox,
  // 打开个人信息页面。
  handleOpenProfile,
  // 未确认的群公告
  pendingAnnouncements = [],
  // 确认公告回调
  onConfirmAnnouncement,
  // @ 成员选择器显示状态
  showMentionPicker,
  // 隐藏 @ 成员选择器
  hideMentionPicker,
  // 选择 @ 成员
  handleSelectMention,
  // 获取过滤后的成员列表
  getFilteredMentionMembers,
  // 选中索引
  selectedMentionIndex,
  // 设置选中索引
  setSelectedMentionIndex,
  // 多选模式相关
  isMultiSelectMode,
  selectedMessages,
  toggleMessageSelection,
  exitMultiSelectMode,
  startForward,
  // 转发详情
  handleOpenForwardDetail,
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
  const renderGameCard = (msg) => (
    <button
      type="button"
      className="game-card"
      onClick={(event) => {
        event.stopPropagation()
        handleOpenTicTacToeGame?.(msg.gameData?.gameId)
      }}
    >
      <span className="game-card-icon">井</span>
      <span>
        <strong>井字棋邀请</strong>
        <small>{msg.sender === 'me' ? '等待好友应战' : '点击查看棋局'}</small>
      </span>
    </button>
  )
  const renderForwardCard = (forwardData) => {
    const normalizedForwardData = normalizeForwardData(forwardData)

    if (!normalizedForwardData) {
      return <span>[聊天记录]</span>
    }

    const previewMessages = normalizedForwardData.messages.slice(0, 4)
    return (
      <div
        className="forward-card"
        onClick={(e) => {
          e.stopPropagation()
          handleOpenForwardDetail?.(normalizedForwardData)
        }}
      >
        <div className="forward-card-title">{normalizedForwardData.title}</div>
        <div className="forward-card-previews">
          {previewMessages.map((fm, fi) => (
            <div key={fi} className="forward-preview-item">
              <span className="forward-preview-sender">{fm.senderName}:</span>
              <span className="forward-preview-text">{getForwardMessageLabel(fm)}</span>
            </div>
          ))}
          {normalizedForwardData.messages.length > 4 && (
            <div className="forward-preview-more">共 {normalizedForwardData.messages.length} 条消息</div>
          )}
        </div>
      </div>
    )
  }
  
  // 调试信息
  console.log('ChatMainView render:')
  console.log('- showMentionPicker:', showMentionPicker)
  console.log('- currentSession.isGroup:', currentSession?.isGroup)
  console.log('- currentChat:', currentChat)
  console.log('- groupMembers[currentChat]:', groupMembers[currentChat])
  console.log('- groupMembers[currentChat]?.length:', (groupMembers[currentChat] || []).length)

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
      handleJumpHandled()
    }
  }, [jumpToMessageId, handleJumpHandled])

  // 处理输入框键盘事件（@ 选择器）
  const handleInputKeyDown = (e) => {
    if (!showMentionPicker) return

    const filteredMembers = getFilteredMentionMembers()
    if (filteredMembers.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedMentionIndex(prev => (prev + 1) % filteredMembers.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      handleSelectMention(filteredMembers[selectedMentionIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      hideMentionPicker()
    }
  }

  // 计算选择器位置
  const getPickerStyle = () => {
    const textarea = document.querySelector('.composer-input')
    if (!textarea) return {}
    
    const rect = textarea.getBoundingClientRect()
    return {
      position: 'fixed',
      bottom: window.innerHeight - rect.top + 8,
      left: rect.left,
      width: Math.min(300, rect.width), // 最大宽度 300px
    }
  }

  // 高亮显示消息中的 @ 用户名
  const highlightMentions = (text, mentionedUserIds) => {
    if (!text || !mentionedUserIds) return text
    
    const members = groupMembers[currentChat] || []
    const mentionedIds = mentionedUserIds.split(',').map(id => parseInt(id))
    
    let result = text
    mentionedIds.forEach(userId => {
      const member = members.find(m => m.id === userId)
      if (member) {
        const name = member.groupNickname || member.nickname || member.username || ''
        if (name) {
          const regex = new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')
          result = result.replace(regex, `<span class="mention-highlight">@${name}</span>`)
        }
      }
    })
    
    return <span dangerouslySetInnerHTML={{ __html: result }} />
  }

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
            className={`message ${msg.sender === 'me' ? 'outgoing' : msg.sender === 'system' ? 'system-message' : 'incoming'} ${msg.replyTo || msg.replyToId ? 'has-reply' : ''} ${isMultiSelectMode && selectedMessages.some(m => m.id === msg.id) ? 'selected' : ''}`}
            onContextMenu={(e) => handleMessageContextMenu(e, msg)}
            onClick={() => isMultiSelectMode && toggleMessageSelection(msg)}
            style={{ cursor: isMultiSelectMode ? 'pointer' : 'default' }}
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
                ) : msg.type === 'forward' ? (
                  renderForwardCard(msg.forwardData)
                ) : msg.type === 'game' ? (
                  renderGameCard(msg)
                ) : (
                  highlightMentions(msg.text, msg.mentionedUserIds)
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

      {isMultiSelectMode && (
        <div className="multiselect-toolbar">
          <div className="multiselect-info">
            <span>已选择 {selectedMessages.length} 条消息</span>
          </div>
          <div className="multiselect-actions">
            <button className="multiselect-btn" onClick={startForward} disabled={selectedMessages.length === 0}>
              转发
            </button>
            <button className="multiselect-btn cancel" onClick={exitMultiSelectMode}>
              取消
            </button>
          </div>
        </div>
      )}

      <footer className="composer" style={{ minHeight: `${composerHeight}px` }}>

        <div className="composer-toolbar">
          <button className="toolbar-btn" type="button" aria-label="发送图片" onClick={() => imageInputRef.current?.click()}>📷</button>
          <button className="toolbar-btn" type="button" aria-label="发送视频" onClick={() => videoInputRef.current?.click()}>🎬</button>
          <button className="toolbar-btn" type="button" aria-label="发送文件" onClick={() => fileInputRef.current?.click()}>📄</button>
          <button className={`toolbar-btn ${isRecording ? 'active' : ''}`} type="button" aria-label="语音" onClick={handleVoiceRecord}>{isRecording ? '⏹️' : '🎤'}</button>
          <button className={`toolbar-btn ${showEmojiPicker ? 'active' : ''}`} type="button" aria-label="表情" onClick={toggleEmojiPicker}>😊</button>
          <button className="game-launch-btn" type="button" aria-label="发起井字棋对弈" onClick={handleStartTicTacToe} disabled={!hasActiveConversation || currentSession?.isGroup}>
            <span className="game-launch-icon">井</span>
            <span>对弈</span>
          </button>
          {hasActiveTicTacToeGame && (
            <button className="toolbar-text-btn" type="button" onClick={() => handleOpenTicTacToeGame?.()}>
              返回棋局
            </button>
          )}
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
          onKeyDown={handleInputKeyDown}
          disabled={!hasActiveConversation}
          rows="3"
        />

        <div className="composer-actions">
          <button className="send-btn" onClick={handleSendMessage} disabled={!hasActiveConversation}>发送</button>
        </div>

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

      {/* @ 成员选择器 */}
      {showMentionPicker && currentSession?.isGroup && (
        <div className="mention-picker-overlay" style={getPickerStyle()}>
          <div className="mention-picker-list">
            {getFilteredMentionMembers().map((member, index) => (
              <div
                key={member.id}
                className={`mention-picker-item ${index === selectedMentionIndex ? 'selected' : ''}`}
                onClick={() => handleSelectMention(member)}
                onMouseEnter={() => setSelectedMentionIndex(index)}
              >
                <div
                  className="mention-picker-avatar"
                  style={{
                    backgroundImage: (member.avatar && member.avatar.length > 1 && member.avatar !== '/default-avatar.png') ? `url(${member.avatar})` : 'none',
                  }}
                >
                  {(() => {
                    const name = member.displayName || member.groupNickname || member.name || '?'
                    return name[0] ? name[0].toUpperCase() : '?'
                  })()}
                </div>
                <div className="mention-picker-info">
                  <div className="mention-picker-name">
                    {member.displayName || member.groupNickname || member.name}
                  </div>
                  {member.groupNickname && member.displayName && member.groupNickname !== member.displayName && (
                    <div className="mention-picker-remark">{member.displayName}</div>
                  )}
                </div>
              </div>
            ))}
            {getFilteredMentionMembers().length === 0 && (
              <div className="mention-picker-item" style={{ cursor: 'default', color: '#999' }}>
                没有找到匹配的成员
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export default ChatMainView
