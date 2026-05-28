import React from 'react'

/**
 * 左侧导航栏（仿微信样式）
 */
function LeftNav({
  userAvatar,
  toggleUserPanel,
  activeTab,
  setActiveTab,
  pendingRequestCount = 0,
  atMentionCount = 0, // @ 提醒计数
  favoriteCount = 0,
}) {
  return (
    <nav className="left-nav">
      <div className="left-nav-top">
        <div className="nav-avatar-wrapper" onClick={toggleUserPanel}>
          {typeof userAvatar === 'string' && (userAvatar.startsWith('data:image') || userAvatar.startsWith('/')) ? (
            <div className="nav-avatar" style={{ backgroundImage: `url(${userAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
          ) : (
            <div className="nav-avatar">
              <span>{userAvatar}</span>
            </div>
          )}
        </div>

        <div style={{ position: 'relative', width: '100%' }}>
          <button 
            className={`nav-tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveTab('chats')}
            aria-label="会话"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12 3c5.5 0 10 3.58 10 8s-4.5 8-10 8c-1.24 0-2.43-.2-3.53-.55L4 21l1.55-3.66C4.04 15.7 3 13.9 3 11c0-4.42 4.5-8 9-8z"/>
            </svg>
          </button>
          {/* @ 提醒徽章 */}
          {atMentionCount > 0 && (
            <span className="nav-tab-badge at-mention-badge">{atMentionCount > 99 ? '99+' : atMentionCount}</span>
          )}
        </div>

        <button 
          className={`nav-tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
          aria-label="通讯录"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </button>

        <div style={{ position: 'relative', width: '100%' }}>
          <button
            className={`nav-tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
            aria-label="收藏"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          </button>
          {favoriteCount > 0 && (
            <span className="nav-tab-badge">{favoriteCount > 99 ? '99+' : favoriteCount}</span>
          )}
        </div>

        <div style={{ position: 'relative', width: '100%' }}>
          <button 
            className={`nav-tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
            aria-label="待处理申请"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14l4-3h12c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 8H7v-2h10v2zm0-3H7V6h10v2z"/>
            </svg>
          </button>
          {pendingRequestCount > 0 && (
            <span className="nav-tab-badge">{pendingRequestCount > 99 ? '99+' : pendingRequestCount}</span>
          )}
        </div>

        <button 
          className={`nav-tab-btn ${activeTab === 'blacklist' ? 'active' : ''}`}
          onClick={() => setActiveTab('blacklist')}
          aria-label="黑名单"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/>
          </svg>
        </button>
      </div>

      <div className="left-nav-bottom">
        <div className="nav-menu-wrapper">
           <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" onClick={toggleUserPanel} style={{cursor:'pointer', opacity:0.6}}>
             <circle cx="12" cy="12" r="2" />
             <circle cx="12" cy="5" r="2" />
             <circle cx="12" cy="19" r="2" />
           </svg>
        </div>
      </div>
    </nav>
  )
}

export default LeftNav
