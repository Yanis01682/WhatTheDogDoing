import { useEffect, useState } from 'react'

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
  // 设置好友搜索框显示状态。
  setShowFriendSearch,
  // 好友搜索关键字。
  friendSearchQuery,
  // 更新好友搜索关键字。
  setFriendSearchQuery,
  // 会话搜索框显示状态。
  showSearch,
  // 设置会话搜索框显示状态。
  setShowSearch,
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
  // 移出黑名单回调
  onRemoveFromBlacklist,
  // 从黑名单打开聊天回调
  onOpenBlacklistChat
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

  const handleComposeClick = () => {
    if (activeTab === 'friends') {
      handleOpenCreateGroup()
      return
    }
    if (activeTab === 'chats') {
      setActiveTab('friends')
      handleOpenAddFriend()
      return
    }
    setActiveTab('chats')
  }

  const handleMenuClick = (e) => {
    e.stopPropagation()
    setHeaderMenu((prev) => (
      prev
        ? null
        : {
            x: e.clientX,
            y: e.clientY,
          }
    ))
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
    if (action === 'toggle-search') {
      if (activeTab === 'friends') {
        setShowFriendSearch((prev) => !prev)
      } else {
        setShowSearch((prev) => !prev)
      }
      return
    }
    if (action === 'go-chats') {
      setActiveTab('chats')
      return
    }
    if (action === 'go-friends') {
      setActiveTab('friends')
      return
    }
    if (action === 'go-blacklist') {
      setActiveTab('blacklist')
    }
  }

  const renderSessionItem = (session) => {
    // 获取好友的在线状态（只针对个人私聊）
    let friendStatus = null
    if (!session.isGroup) {
      const friend = myFriends.find(f => f.name === session.realName || f.id === session.id || f.id.toString() === session.title)
      if (friend) {
        friendStatus = friend.status || null
      }
    }
    
    const showSessionStatusDot = !session.isGroup && Boolean(friendStatus)

    return (
      <li
        key={session.id}
        className={`session-item ${currentChat === session.id ? 'active' : ''}`}
        onClick={() => setCurrentChat(session.id)}
        onContextMenu={(e) => handleSessionContextMenu(e, session)}
      >
        <div className="avatar-wrapper">
          <div className="avatar">{session.avatar}</div>
          {showSessionStatusDot && <span className={`session-status-dot status-${friendStatus}`}></span>}
        </div>
        <div className="session-main">
          <div className="session-row">
            <p className="session-title">{session.title}</p>
            <span className="session-time">{session.time}</span>
          </div>
          <div className="session-row">
            <p className="session-meta">{session.lastMessage}</p>
            {session.badge > 0 && <span className="session-badge">{session.badge}</span>}
          </div>
        </div>
      </li>
    )
  }

  return (
    <aside
      className="panel chatlist-panel"
      style={{ width: `${chatlistWidth}px`, flex: 'none', '--chatlist-width': `${chatlistWidth}px` }}
    >
      <div className="panel-header">
        <h2>
          {activeTab === 'chats' ? '会话' : activeTab === 'friends' ? '好友' : '黑名单'}
        </h2>
        <div className="header-actions">
          <button
            className={`icon-btn ${activeTab === 'friends' && showFriendSearch ? 'active' : showSearch ? 'active' : ''}`}
            type="button"
            aria-label="搜索"
            onClick={() => {
              if (activeTab === 'friends') {
                setShowFriendSearch(!showFriendSearch)
                if (showFriendSearch) {
                  setFriendSearchQuery('')
                }
              } else {
                setShowSearch(!showSearch)
              }
            }}
          >
            🔍
          </button>
          {activeTab === 'friends' && (
            <button className="icon-btn" type="button" aria-label="添加好友" onClick={handleOpenAddFriend}>
              ➕
            </button>
          )}
          {activeTab === 'blacklist' && (
            <button className="icon-btn" type="button" aria-label="管理黑名单">
              ⚙️
            </button>
          )}
          <button
            className="icon-btn"
            type="button"
            aria-label={activeTab === 'friends' ? '创建群聊' : '新建会话'}
            onClick={handleComposeClick}
          >
            ✎
          </button>
          <button className="icon-btn" type="button" aria-label="菜单" onClick={handleMenuClick}>⋯</button>
        </div>
      </div>

      {activeTab === 'chats' && (
        <>
          {showSearch && (
            <div className="search-wrap">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="搜索会话或联系人"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  autoFocus
                />
                {searchQuery && (
                  <button className="search-clear-btn" type="button" aria-label="清空搜索" onClick={handleClearSearch}>
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

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
                              {friend.avatar}
                              <span className={`qq-status-dot ${friend.status}`}></span>
                            </div>
                            <div className="qq-friend-info">
                              <div className="qq-friend-main">
                                <p className="qq-friend-name">
                                  {friend.remark || friend.name}
                                  {friend.remark && <span className="friend-real-name">({friend.name})</span>}
                                </p>
                                <span className={`qq-status-icon ${friend.status}`}>
                                  {friend.status === 'online' ? '●' : friend.status === 'busy' ? '●' : friend.status === 'away' ? '●' : friend.status === 'invisible' ? '●' : '○'}
                                </span>
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
                    <div className="avatar">{user.avatar}</div>
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

      <div className="bottom-tab-bar">
        <button className={`tab-item ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')}>
          <span className="tab-icon">💬</span>
          <span className="tab-label">会话</span>
        </button>
        <button className={`tab-item ${activeTab === 'friends' ? 'active' : ''}`} onClick={() => setActiveTab('friends')}>
          <span className="tab-icon">👥</span>
          <span className="tab-label">好友</span>
        </button>
        <button className={`tab-item ${activeTab === 'blacklist' ? 'active' : ''}`} onClick={() => setActiveTab('blacklist')}>
          <span className="tab-icon">🚫</span>
          <span className="tab-label">黑名单</span>
        </button>
      </div>

      {headerMenu && (
        <div
          className="session-context-menu"
          style={{ top: headerMenu.y, left: headerMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="session-context-item" onClick={() => handleHeaderMenuAction('new-friend')}>
            添加好友
          </button>
          <button type="button" className="session-context-item" onClick={() => handleHeaderMenuAction('new-group')}>
            创建群聊
          </button>
          <button type="button" className="session-context-item" onClick={() => handleHeaderMenuAction('toggle-search')}>
            {activeTab === 'friends' ? (showFriendSearch ? '关闭搜索' : '搜索好友') : (showSearch ? '关闭搜索' : '搜索会话')}
          </button>
          <button type="button" className="session-context-item" onClick={() => handleHeaderMenuAction('go-chats')}>
            切换到会话
          </button>
          <button type="button" className="session-context-item" onClick={() => handleHeaderMenuAction('go-friends')}>
            切换到好友
          </button>
          <button type="button" className="session-context-item" onClick={() => handleHeaderMenuAction('go-blacklist')}>
            切换到黑名单
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
