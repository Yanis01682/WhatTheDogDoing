/**
 * 顶部导航组件。
 * 负责品牌区、在线状态切换、头像入口，不持有业务状态。
 */
function TopBar({
  // 状态菜单展开/收起状态。
  showStatusMenu,
  // 更新状态菜单显示状态。
  setShowStatusMenu,
  // 根据状态值返回展示图标。
  getStatusIcon,
  // 根据状态值返回展示文案。
  getStatusText,
  // 当前用户在线状态值。
  userStatus,
  // 修改在线状态的回调。
  handleChangeStatus,
  // 打开个人面板回调。
  toggleUserPanel,
  // 用户头像（文字或 base64 图像）。
  userAvatar
}) {
  return (
    <header className="im-topbar">
      <div className="brand">
        <span className="brand-dot" aria-hidden="true"></span>
        <div>
          <p className="brand-title">WhatTheDogDoing</p>
          <p className="brand-sub">IM Workspace</p>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="status-selector" onClick={() => setShowStatusMenu(!showStatusMenu)}>
          <span className="status-icon">{getStatusIcon(userStatus)}</span>
          <span className="status-text">{getStatusText(userStatus)}</span>
          <span className={`status-arrow ${showStatusMenu ? 'active' : ''}`}>›</span>

          {showStatusMenu && (
            <div className="status-menu">
              <div className="status-menu-item" onClick={() => handleChangeStatus('online')}>
                <span className="status-menu-icon">🟢</span>
                <span className="status-menu-text">在线</span>
                {userStatus === 'online' && <span className="status-menu-check">✓</span>}
              </div>
              <div className="status-menu-item" onClick={() => handleChangeStatus('busy')}>
                <span className="status-menu-icon">🔴</span>
                <span className="status-menu-text">忙碌</span>
                {userStatus === 'busy' && <span className="status-menu-check">✓</span>}
              </div>
              <div className="status-menu-item" onClick={() => handleChangeStatus('away')}>
                <span className="status-menu-icon">🟡</span>
                <span className="status-menu-text">离开</span>
                {userStatus === 'away' && <span className="status-menu-check">✓</span>}
              </div>
              <div className="status-menu-item" onClick={() => handleChangeStatus('invisible')}>
                <span className="status-menu-icon">🌙</span>
                <span className="status-menu-text">隐身</span>
                {userStatus === 'invisible' && <span className="status-menu-check">✓</span>}
              </div>
              <div className="status-menu-item" onClick={() => handleChangeStatus('offline')}>
                <span className="status-menu-icon">⚫</span>
                <span className="status-menu-text">离线</span>
                {userStatus === 'offline' && <span className="status-menu-check">✓</span>}
              </div>
            </div>
          )}
        </div>

        <div className="user-avatar-wrapper" onClick={toggleUserPanel}>
          {typeof userAvatar === 'string' && userAvatar.startsWith('data:image') ? (
            <div className="user-avatar" style={{ backgroundImage: `url(${userAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
          ) : (
            <div className="user-avatar">
              <span>{userAvatar}</span>
            </div>
          )}
          <span className="user-status-dot"></span>
        </div>
      </div>
    </header>
  )
}

export default TopBar
