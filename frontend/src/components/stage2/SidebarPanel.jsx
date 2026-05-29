import { useEffect, useState } from 'react'

function renderAvatar(av, className) {
  if (typeof av === 'string' && (av.startsWith('data:image') || av.startsWith('/'))) {
    return (
      <div
        className={className}
        style={{ backgroundImage: `url(${av})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
    )
  }
  return <div className={className}><span>{av || '?'}</span></div>
}

/**
 * 左侧面板组件。
 * 功能：会话/好友 tab 切换、搜索筛选、分组折叠、打开私聊和创建群聊入口。
 */
function SidebarPanel({
  // 当前激活标签：chats 或 friends。
  activeTab,
  // 切换标签页。
  setActiveTab,
  // 好友搜索框显示状态。
  showFriendSearch,
  // 好友搜索关键字。
  friendSearchQuery,
  // 更新好友搜索关键字。
  setFriendSearchQuery,
  // 会话搜索关键字。
  searchQuery,
  // 会话搜索输入处理函数。
  handleSearchChange,
  // 清空会话搜索词。
  handleClearSearch,
  // 打开添加好友弹窗。
  handleOpenAddFriend,
  // 打开创建群聊弹窗。
  handleOpenCreateGroup,
  // 会话筛选维度：all/personal/group。
  sessionFilter,
  // 更新会话筛选条件。
  setSessionFilter,
  // 运行期创建的会话（置顶展示）。
  dynamicSessions,
  // 默认会话列表。
  sessions,
  // 当前选中的会话 id。
  currentChat,
  // 切换当前会话。
  setCurrentChat,
  // 好友列表数据源。
  myFriends,
  // 好友分组配置。
  customGroups,
  // 当前折叠的分组名数组。
  collapsedGroups,
  // 切换分组折叠状态。
  toggleGroupCollapse,
  // 手动收纳的群聊 id 列表。
  archivedGroupIds,
  // 切换群聊收纳状态（加入/移出）。
  onToggleGroupArchive,
  // 从好友列表打开私聊的回调。
  onOpenFriendChat,
  // 左侧栏宽度（像素）。
  chatlistWidth,
  // 置顶聊天 ID 列表
  pinnedChatIds,
  // 切换会话置顶状态
  onTogglePinChat,
  // 黑名单列表
  blacklist,
  // 收藏消息列表
  favoriteItems = [],
  // 账号笔记列表
  noteItems = [],
  selectedNoteId,
  // 打开收藏的原消息
  onOpenFavorite,
  // 移除收藏
  onRemoveFavorite,
  onStartNewNote,
  onSelectNote,
  onDeleteNote,
  // 移出黑名单回调
  onRemoveFromBlacklist,
  // 从黑名单打开聊天回调
  onOpenBlacklistChat,
  // 待我审批的好友申请列表
  friendRequestList = [],
  // 待审批的群邀请申请
  groupInviteRequests = [],
  // 接受好友申请
  handleAcceptRequest,
  // 拒绝好友申请
  handleRejectRequest,
  // 接受群邀请申请
  handleApproveGroupInviteRequest,
  // 拒绝群邀请申请
  handleRejectGroupInviteRequest,
}) {
  const [isGroupFolderOpen, setIsGroupFolderOpen] = useState(false)
  const [sessionContextMenu, setSessionContextMenu] = useState(null)
  const [headerMenu, setHeaderMenu] = useState(null)

  useEffect(() => {
    const closeMenu = () => {
      setSessionContextMenu(null)
      setHeaderMenu(null)
    }
    document.addEventListener('click', closeMenu)
    return () => document.removeEventListener('click', closeMenu)
  }, [])

  // 从会话列表中过滤掉黑名单用户
  const isBlacklisted = (session) => {
    if (session.isGroup) return false // 群聊不受黑名单影响
    const userId = session.realName || session.title
    return blacklist.some(u => (u.name === userId) || (u.id && session.id === u.id))
  }

  const filteredSessions = [...dynamicSessions, ...sessions].filter((session) => {
    // 过滤黑名单用户
    if (isBlacklisted(session)) return false
    if (sessionFilter === 'personal' && session.isGroup) return false
    if (sessionFilter === 'group' && !session.isGroup) return false
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const title = session.title.toLowerCase()
      const lastMessage = session.lastMessage.toLowerCase()
      return title.includes(query) || lastMessage.includes(query)
    }
    return true
  })

  // 置顶聊天排序：置顶的排在前面
  filteredSessions.sort((a, b) => {
    const aPinned = pinnedChatIds.includes(a.id)
    const bPinned = pinnedChatIds.includes(b.id)
    if (aPinned && !bPinned) return -1
    if (!aPinned && bPinned) return 1
    return 0
  })

  const shouldArchiveGroup = (session) => session.isGroup && archivedGroupIds.includes(session.id)

  const archivedGroupSessions = filteredSessions.filter(shouldArchiveGroup)
  const normalSessions = filteredSessions.filter((session) => !shouldArchiveGroup(session))
  const sidebarSearchValue = activeTab === 'friends' ? friendSearchQuery : activeTab === 'requests' ? '' : searchQuery
  const sidebarPlaceholder = activeTab === 'requests' ? '申请列表无需搜索' : activeTab === 'favorites' ? '搜索收藏' : activeTab === 'notes' ? '搜索笔记' : '搜索'
  const showHeaderAddButton = activeTab === 'chats' || activeTab === 'friends'
  const favoriteSearchText = searchQuery.trim().toLowerCase()
  const filteredFavoriteItems = favoriteItems.filter((item) => {
    if (!favoriteSearchText) return true
    return [item.sessionTitle, item.senderName, item.text, item.mediaName, item.previewText]
      .some((value) => String(value || '').toLowerCase().includes(favoriteSearchText))
  })
  const filteredNoteItems = noteItems.filter((item) => {
    if (!favoriteSearchText) return true
    return [item.title, item.content].some((value) => String(value || '').toLowerCase().includes(favoriteSearchText))
  })

  const handleSessionContextMenu = (e, session) => {
    e.preventDefault()
    e.stopPropagation()
    setSessionContextMenu({
      x: e.clientX,
      y: e.clientY,
      sessionId: session.id,
      isArchived: archivedGroupIds.includes(session.id),
      isGroup: session.isGroup,
      isPinned: pinnedChatIds.includes(session.id)
    })
  }

  const handleToggleArchiveFromMenu = () => {
    if (!sessionContextMenu) return
    onToggleGroupArchive(sessionContextMenu.sessionId)
    setSessionContextMenu(null)
  }

  const handleTogglePinFromMenu = () => {
    if (!sessionContextMenu) return
    onTogglePinChat(sessionContextMenu.sessionId)
    setSessionContextMenu(null)
  }


  const handleHeaderMenuAction = (action) => {
    setHeaderMenu(null)
    if (action === 'new-friend') {
      setActiveTab('friends')
      handleOpenAddFriend()
      return
    }
    if (action === 'new-group') {
      setActiveTab('friends')
      handleOpenCreateGroup()
      return
    }
  }

  const getFavoritePreview = (item) => {
    if (item.previewText) return item.previewText
    if (item.type === 'image') return `[图片]${item.mediaName ? ` ${item.mediaName}` : ''}`
    if (item.type === 'video') return `[视频]${item.mediaName ? ` ${item.mediaName}` : ''}`
    if (item.type === 'file') return `[文件]${item.mediaName ? ` ${item.mediaName}` : ''}`
    if (item.type === 'voice') return '[语音]'
    if (item.type === 'forward') return `[聊天记录]${item.forwardTitle ? ` ${item.forwardTitle}` : ''}`
    return item.text || '消息'
  }

  const formatFavoriteSavedAt = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const formatNoteTime = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const renderSessionItem = (session) => {
    return (
      <li
        key={session.id}
        className={`session-item ${currentChat === session.id ? 'active' : ''} ${pinnedChatIds?.includes(session.id) ? 'pinned' : ''}`}
        onClick={() => setCurrentChat(currentChat === session.id ? null : session.id)}
        onContextMenu={(e) => handleSessionContextMenu(e, session)}
      >
        <div className="avatar-wrapper">
          {renderAvatar(session.avatar, 'avatar')}
        </div>
        <div className="session-main">
          <div className="session-row">
            <p className="session-title">{session.title}</p>
            <span className="session-time">{session.time}</span>
          </div>
          <div className="session-row">
            <p className={`session-meta ${session.lastMessage?.includes('@我') ? 'at-mention' : ''}`}>{session.lastMessage}</p>
            {session.badge > 0 && <span className="session-badge">{session.badge}</span>}
          </div>
        </div>
      </li>
    )
  }

  return (
    <aside
      className="panel chatlist-panel"
      style={{ width: `${chatlistWidth}px`, minWidth: '200px', flex: 'none', overflow: 'hidden', '--chatlist-width': `${chatlistWidth}px` }}
    >
      <div className="panel-header wechat-panel-header">
        <div className="wechat-search-wrapper">
          <span className="wechat-search-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input
            type="text"
            className="wechat-search-input"
            placeholder={sidebarPlaceholder}
            autoComplete="off"
            value={sidebarSearchValue}
            onChange={(e) => {
              if (activeTab === 'friends') {
                setFriendSearchQuery(e.target.value)
              } else if (activeTab !== 'requests') {
                handleSearchChange(e)
              }
            }}
            disabled={activeTab === 'requests'}
          />
          {sidebarSearchValue && (
            <button
              className="wechat-search-clear"
              type="button"
              aria-label="清空搜索"
              onClick={() => {
                if (activeTab === 'friends') {
                  setFriendSearchQuery('')
                } else if (activeTab !== 'requests') {
                  handleClearSearch()
                }
              }}
            >✕</button>
          )}
        </div>
        {showHeaderAddButton && (
        <div className="wechat-add-btn-wrapper">
          <button 
            className="wechat-add-btn" 
            onClick={(e) => {
              e.stopPropagation()
              setHeaderMenu(prev => prev ? null : { x: 0, y: 0 })
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
        </div>
        )}
      </div>

      {activeTab === 'chats' && (
        <>

          <div className="session-tabs">
            <button className={`tab-btn ${sessionFilter === 'all' ? 'active' : ''}`} onClick={() => setSessionFilter('all')} type="button">全部</button>
            <button className={`tab-btn ${sessionFilter === 'personal' ? 'active' : ''}`} onClick={() => setSessionFilter('personal')} type="button">个人</button>
            <button className={`tab-btn ${sessionFilter === 'group' ? 'active' : ''}`} onClick={() => setSessionFilter('group')} type="button">群聊</button>
          </div>

          <ul className="session-list">
            {normalSessions.map(renderSessionItem)}

            {archivedGroupSessions.length > 0 && (
              <li className="group-folder" key="group-folder">
                <button
                  type="button"
                  className="group-folder-header"
                  onClick={() => setIsGroupFolderOpen((prev) => !prev)}
                >
                  <span className={`group-folder-arrow ${isGroupFolderOpen ? 'open' : ''}`}>›</span>
                  <span className="group-folder-title">群聊收纳</span>
                  <span className="group-folder-count">{archivedGroupSessions.length}</span>
                </button>

                {isGroupFolderOpen && (
                  <ul className="group-folder-list">
                    {archivedGroupSessions.map(renderSessionItem)}
                  </ul>
                )}
              </li>
            )}
          </ul>
        </>
      )}

      {activeTab === 'friends' && (
        <div className="friends-container">
          {showFriendSearch && (
            <div className="friend-search-wrap">
              <div className="friend-search-input-wrapper">
                <input
                  type="text"
                  placeholder="搜索好友（支持姓名、备注、分组）"
                  value={friendSearchQuery}
                  onChange={(e) => setFriendSearchQuery(e.target.value)}
                  autoFocus
                />
                {friendSearchQuery && (
                  <button className="friend-search-clear-btn" type="button" aria-label="清空搜索" onClick={() => setFriendSearchQuery('')}>
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {myFriends.length > 0 ? (
            <div className="qq-friends-list">
              {customGroups.map((groupName) => {
                const groupFriends = myFriends.filter((f) => {
                  if (f.group !== groupName) return false
                  if (friendSearchQuery.trim()) {
                    const query = friendSearchQuery.toLowerCase().trim()
                    return (
                      f.name.toLowerCase().includes(query) ||
                      (f.remark && f.remark.toLowerCase().includes(query)) ||
                      f.group.toLowerCase().includes(query)
                    )
                  }
                  return true
                })

                if (groupFriends.length === 0) return null
                const isCollapsed = collapsedGroups.includes(groupName)

                return (
                  <div key={groupName} className="friends-group">
                    <div className="friends-group-header" onClick={() => toggleGroupCollapse(groupName)}>
                      <span className={`group-arrow ${isCollapsed ? '' : 'expanded'}`}>›</span>
                      <span className="group-name">{groupName}</span>
                      <span className="group-count">{groupFriends.length}</span>
                    </div>
                    {!isCollapsed && (
                      <ul className="friends-group-list">
                        {groupFriends.map((friend) => (
                          <li
                            key={friend.id}
                            className="qq-friend-item"
                            onClick={() => onOpenFriendChat(friend)}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              console.log('右键菜单:', friend.name)
                            }}
                          >
                            <div className="qq-friend-avatar">
                              {renderAvatar(friend.avatar, 'qq-friend-avatar-img')}
                            </div>
                            <div className="qq-friend-info">
                              <div className="qq-friend-main">
                                <p className="qq-friend-name">
                                  {friend.remark || friend.name}
                                  {friend.remark && <span className="friend-real-name">({friend.name})</span>}
                                </p>

                              </div>
                              <p className="qq-friend-signature">{friend.signature || '这个人很懒，什么都没写~'}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-friends-hint">
              <p>暂无好友</p>
              <button onClick={handleOpenAddFriend}>添加好友</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'favorites' && (
        <div className="favorites-container">
          {filteredFavoriteItems.length > 0 ? (
            <ul className="favorite-list">
              {filteredFavoriteItems.map((item) => (
                <li key={item.id} className="favorite-item">
                  <button type="button" className="favorite-main" onClick={() => onOpenFavorite?.(item)}>
                    <div className="favorite-row">
                      <span className="favorite-title">{item.sessionTitle || '聊天'}</span>
                      <span className="favorite-time">{item.time || formatFavoriteSavedAt(item.savedAt)}</span>
                    </div>
                    <p className="favorite-preview">{getFavoritePreview(item)}</p>
                    <div className="favorite-meta">
                      <span>{item.senderName || '未知用户'}</span>
                      <span>{formatFavoriteSavedAt(item.savedAt)}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="favorite-remove"
                    aria-label="取消收藏"
                    title="取消收藏"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveFavorite?.(item.id)
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-favorites">
              <p>{favoriteItems.length === 0 ? '暂无收藏' : '没有匹配的收藏'}</p>
              <span>右键消息后选择“收藏”</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="notes-container">
          <div className="notes-toolbar">
            <div>
              <p className="notes-title">Aegis 笔记</p>
              <span>{noteItems.length} 条账号记录</span>
            </div>
            <button type="button" className="note-new-btn" onClick={onStartNewNote}>新建</button>
          </div>

          {filteredNoteItems.length > 0 ? (
            <ul className="note-list">
              {filteredNoteItems.map((note) => (
                <li key={note.id} className={`note-item ${selectedNoteId === note.id ? 'active' : ''}`}>
                  <button type="button" className="note-main" onClick={() => onSelectNote?.(note)}>
                    <div className="note-row">
                      <span className="note-title">{note.title || '无标题笔记'}</span>
                      <span className="note-time">{formatNoteTime(note.updatedAt || note.createdAt)}</span>
                    </div>
                    <p>{note.content || '空白笔记'}</p>
                  </button>
                  <button
                    type="button"
                    className="note-delete"
                    aria-label="删除笔记"
                    onClick={() => onDeleteNote?.(note.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-favorites">
              <p>{noteItems.length === 0 ? '暂无笔记' : '没有匹配的笔记'}</p>
              <span>把骑士团线索、誓约草稿或行动备忘留在右侧书页</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="friends-container">
          {groupInviteRequests.length > 0 && (
            <div className="friend-requests-section" style={{ margin: '0 0 8px 0', padding: '8px 12px' }}>
              <h4>群申请待审批 ({groupInviteRequests.length})</h4>
              {groupInviteRequests.map((request) => (
                <div key={request.id} className="request-item">
                  {renderAvatar(request.inviteeAvatar, 'request-avatar')}
                  <div className="request-info">
                    <p className="request-name">{request.groupName}</p>
                    <p className="request-message">{request.requesterName} 申请邀请 {request.inviteeName} 入群</p>
                  </div>
                  <div className="request-actions">
                    <button className="accept-btn" onClick={() => handleApproveGroupInviteRequest(request.id, request.conversationId)}>接受</button>
                    <button className="reject-btn" onClick={() => handleRejectGroupInviteRequest(request.id)}>拒绝</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {friendRequestList.length > 0 && (
            <div className="friend-requests-section" style={{ margin: '0 0 8px 0', padding: '8px 12px' }}>
              <h4>好友申请待审批 ({friendRequestList.length})</h4>
              {friendRequestList.map((request) => (
                <div key={request.id} className="request-item">
                  {renderAvatar(request.avatar, 'request-avatar')}
                  <div className="request-info">
                    <p className="request-name">{request.name}</p>
                    <p className="request-message">想添加你为好友</p>
                  </div>
                  <div className="request-actions">
                    <button className="accept-btn" onClick={() => handleAcceptRequest(request.id)}>接受</button>
                    <button className="reject-btn" onClick={() => handleRejectRequest(request.id)}>拒绝</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {groupInviteRequests.length === 0 && friendRequestList.length === 0 && (
            <div className="empty-friends-hint">
              <p>暂无待处理申请</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'blacklist' && (
        <div className="blacklist-container">
          {blacklist.length === 0 ? (
            <div className="empty-list">
              <p>暂无黑名单用户</p>
            </div>
          ) : (
            <ul className="blacklist-list">
              {blacklist.map(user => (
                <li key={user.id} className="blacklist-item" onClick={() => onOpenBlacklistChat(user)}>
                  <div className="avatar-wrapper">
                    {renderAvatar(user.avatar, 'avatar')}
                    <button 
                      className="remove-btn" 
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFromBlacklist(user.id)
                      }}
                      title="移出黑名单"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="user-info">
                    <p className="name">{user.name}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {headerMenu && (
        <div
          className="session-context-menu header-context-menu"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="header-context-title">Aegis Actions</div>
          <button type="button" className="session-context-item" onClick={() => handleHeaderMenuAction('new-group')}>
            <span className="context-item-mark">✦</span>
            <span>
              <strong>发起群聊</strong>
              <small>召集新的同行者</small>
            </span>
          </button>
          <button type="button" className="session-context-item" onClick={() => handleHeaderMenuAction('new-friend')}>
            <span className="context-item-mark">◇</span>
            <span>
              <strong>添加好友</strong>
              <small>建立新的誓约联系</small>
            </span>
          </button>
        </div>
      )}

      {sessionContextMenu && (
        <div
          className="session-context-menu"
          style={{ top: sessionContextMenu.y, left: sessionContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="session-context-item" onClick={handleTogglePinFromMenu}>
            {sessionContextMenu.isPinned ? '取消置顶' : '置顶会话'}
          </button>
          {sessionContextMenu.isGroup && (
            <button type="button" className="session-context-item" onClick={handleToggleArchiveFromMenu}>
              {sessionContextMenu.isArchived ? '移出收纳' : '加入收纳'}
            </button>
          )}
        </div>
      )}
    </aside>
  )
}

export default SidebarPanel
