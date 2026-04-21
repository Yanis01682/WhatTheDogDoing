/**
 * 全局弹层容器组件。
 * 负责渲染聊天页所有 overlay/modal，包括：表情面板、右键菜单、好友申请、聊天详情、成员管理等。
 * 说明：该组件仅做展示与事件转发，不持有业务状态，所有数据来自 App。
 */
import { useState } from 'react'

/**
 * Render an avatar: if the value is a base64 data URL, display it as an
 * image background; otherwise render the text initial inside a span.
 */
function renderAvatar(av, className) {
  if (typeof av === 'string' && av.startsWith('data:image')) {
    return (
      <div
        className={className}
        style={{ backgroundImage: `url(${av})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
    )
  }
  return <div className={className}><span>{av || '?'}</span></div>
}

function Overlays({
  // 表情面板显示控制。
  showEmojiPicker,
  closeEmojiPicker,
  handleEmojiSelect,
  // 消息右键菜单状态与动作。
  contextMenu,
  closeContextMenu: _closeContextMenu,
  handleReplyMessage,
  handleRevokeMessage,
  handleDeleteMessage,
  // 群成员弹层。
  showMemberModal,
  closeMemberModal,
  sessions,
  currentChat,
  getCurrentOwner,
  myRole,
  groupMembers,
  handleMakeAdmin,
  handleRemoveMember,
  // 用户侧边面板与个人信息。
  showUserPanel,
  closeUserPanel,
  userAvatar,
  profileData,

  handleOpenProfile,
  toggleNightMode,
  isNightMode,
  handleLogout,
  handleDeleteAccount,
  handleOpenChangePassword,
  showChangePasswordModal,
  handleCloseChangePassword,
  changePasswordForm,
  handleChangePasswordInput,
  handleSubmitChangePassword,
  showLogoutConfirm,
  confirmLogout,
  cancelLogout,
  showProfileModal,
  setShowProfileModal,
  showPeerProfileModal,
  peerProfile,
  handleClosePeerProfile,
  handleStartChatWithPeer,
  handleAddPeerAsFriend,
  isEditingProfile,
  handleEditProfile,
  handleProfileChange,
  handleCancelProfile,
  handleSaveProfile,
  handleChangeAvatar,
  // 聊天详情及群操作。
  showChatDetail,
  handleCloseChatDetail,
  getCurrentSession,
  handleOpenChatDetailPeerProfile,
  handleOpenOwnerProfile,
  handleOpenMemberProfile,
  handleOpenSearchMessage,
  isEditingAnnouncement,
  groupAnnouncement,
  groupAnnouncementHistory,
  showAnnouncementHistoryModal,
  userRole,
  canRenameCurrentGroup,
  isEditingGroupName,
  tempGroupName,
  setTempGroupName,
  isRenamingGroup,
  handleStartEditGroupName,
  handleSaveGroupName,
  handleCancelEditGroupName,
  handleStartEditAnnouncement,
  tempAnnouncement,
  setTempAnnouncement,
  handleSaveAnnouncement,
  handleCancelEditAnnouncement,
  handleOpenAnnouncementHistory,
  handleCloseAnnouncementHistory,
  handleOpenMemberList,
  handleOpenInviteMember,
  handleTogglePinChat,
  isChatPinned,
  handleToggleBlacklist,
  isUserInBlacklist,
  handleTransferGroup,
  handleDismissGroup,
  handleExitGroup,
  isEditingGroupNickname,
  tempGroupNickname,
  setTempGroupNickname,
  handleStartEditGroupNickname,
  handleSaveGroupNickname,
  handleCancelEditGroupNickname,
  isEditingRemark,
  tempRemark,
  setTempRemark,
  myFriends,
  handleStartEditRemark,
  handleSaveRemark,
  handleCancelEditRemark,
  handleDeleteFriend,
  // 添加好友审批流程相关。
  showAddFriendModal,
  handleCloseAddFriend,
  friendSearchQuery,
  handleSearchFriend,
  friendSearchResults,
  isAlreadyFriend,
  handleSendFriendRequest,
  friendRequestList,
  sentFriendRequests,
  groupInviteRequests,
  handleAcceptRequest,
  handleRejectRequest,
  handleApproveGroupInviteRequest,
  handleRejectGroupInviteRequest,
  // 查找消息。
  showSearchMessageModal,
  handleCloseSearchMessage,
  searchMessageQuery,
  handleSearchMessages,
  searchResults,
  handlePreviousResult,
  currentResultIndex,
  handleNextResult,
  setCurrentResultIndex,
  handleJumpToMessage,
  highlightText,
  // 成员列表与邀请成员。
  showMemberListModal,
  handleCloseMemberList,
  showInviteMemberModal,
  handleCloseInviteMember,
  selectedInviteFriends,
  handleToggleInviteFriend,
  handleSendInvite,
  getCurrentGroupMemberIds,
  // 创建群聊。
  showCreateGroupModal,
  handleCloseCreateGroup,
  groupName,
  setGroupName,
  selectedFriends,
  handleToggleSelectFriend,
  handleCreateGroup,
  showDeleteConfirm,
  cancelDeleteAccount,
  confirmDeleteAccount
}) {
  const peerIsFriend = peerProfile ? isAlreadyFriend(peerProfile.userId, peerProfile.name) : false
  const peerRequestPending = peerProfile
    ? sentFriendRequests.some(
        (item) => item.status === 'pending' && (item.userId === peerProfile.userId || item.name === peerProfile.name)
      )
    : false
  const currentSession = getCurrentSession()
  const currentPrivateFriend = !currentSession.isGroup
    ? myFriends.find(
        (friend) =>
          (currentSession.peerUserId != null && String(friend.accountId) === String(currentSession.peerUserId)) ||
          friend.name === currentSession.realName ||
          friend.name === currentSession.title ||
          friend.remark === currentSession.title
      )
    : null
  const blacklistTarget = currentPrivateFriend
    ? {
        id: currentPrivateFriend.accountId || currentPrivateFriend.id,
        name: currentPrivateFriend.remark || currentPrivateFriend.name,
        avatar: currentPrivateFriend.avatar
      }
    : {
        id: currentSession.id,
        name: currentSession.title,
        avatar: currentSession.avatar
      }
  const currentGroupOwner = (groupMembers[currentChat] || []).find((member) => member.role === 'owner')



  return (
    <>
      {showEmojiPicker && (
        <div className="emoji-picker-overlay" onClick={closeEmojiPicker}>
          <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
            <div className="emoji-picker-header">
              <span>常用表情</span>
              <button className="emoji-close-btn" onClick={closeEmojiPicker}>×</button>
            </div>
            <div className="emoji-grid">
              {[
                '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
                '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
                '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛',
                '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
                '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄',
                '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷',
                '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴',
                '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐',
                '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳',
                '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭',
                '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
                '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️',
                '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖',
                '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
                '😾', '🙈', '🙉', '🙊', '💋', '💌', '💘', '💝',
                '❤️', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍',
                '💯', '💢', '💥', '💫', '💦', '💨', '🔥', '✨',
                '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏',
                '✍️', '💪', '🧠', '🫀', '👀', '👂', '👃', '🦷',
                '🎉', '🎊', '🎁', '🎈', '🎂', '🎄', '🎃', '🎆'
              ].map((emoji, index) => (
                <button key={index} className="emoji-item" onClick={() => handleEmojiSelect(emoji)} type="button">{emoji}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="session-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.canReply && (
            <button type="button" className="session-context-item" onClick={handleReplyMessage}>
              回复消息
            </button>
          )}
          {contextMenu.canRevoke && (
            <button type="button" className="session-context-item" onClick={handleRevokeMessage}>
              撤回消息
            </button>
          )}
          {contextMenu.canDelete && (
            <button type="button" className="session-context-item" onClick={handleDeleteMessage}>
              删除消息
            </button>
          )}
        </div>
      )}

      {showMemberModal && (
        <div className="modal-overlay" onClick={closeMemberModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{(sessions.find((session) => session.id === currentChat)?.title || '当前群聊')} - 群成员</h3>
              <button className="modal-close" onClick={closeMemberModal}>×</button>
            </div>
            
            <div className="group-info-card">
              <div className="info-row">
                <span className="info-label">我的角色：</span>
                <span className="info-value">
                  <span className={`role-badge role-${myRole[currentChat]}`}>
                    {myRole[currentChat] === 'owner' ? '群主' : myRole[currentChat] === 'admin' ? '管理员' : '普通成员'}
                  </span>
                </span>
              </div>
              <div className="info-row"><span className="info-label">总人数：</span><span className="info-value">{groupMembers[currentChat]?.length || 0}人</span></div>
            </div>

            <div className="member-list">
              {(groupMembers[currentChat] || []).map((member) => (
                <div key={member.id} className="member-item">
                  {renderAvatar(member.avatar, 'member-avatar')}
                  <div className="member-info">
                    <div className="member-name">
                      {member.displayName}
                      <span className={`role-badge role-${member.role}`}>{member.role === 'owner' ? '群主' : member.role === 'admin' ? '管理员' : '成员'}</span>
                    </div>
                    {member.displayName !== member.name && (
                      <div className="member-username">账号: {member.name}</div>
                    )}
                  </div>
                  
                  <div className="member-actions">
                    {/* 群主的操作权限 */}
                    {myRole[currentChat] === 'owner' && member.id !== profileData.id && (
                      <div className="action-button-group">
                        <button 
                          className="action-btn make-admin" 
                          onClick={() => handleMakeAdmin(member.id, member.role !== 'admin')}
                        >
                          {member.role === 'admin' ? '取消管理员' : '设为管理员'}
                        </button>
                        <button 
                          className="action-btn transfer-owner" 
                          onClick={() => handleTransferGroup(member.id)}
                        >
                          转让群主
                        </button>
                        <button 
                          className="action-btn remove-member" 
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          移出群聊
                        </button>
                      </div>
                    )}
                    
                    {/* 管理员的操作权限 */}
                    {myRole[currentChat] === 'admin' && member.role === 'member' && (
                      <button 
                        className="action-btn remove-member" 
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        移出群聊
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showUserPanel && (
        <div className="user-panel-overlay" onClick={closeUserPanel}>
          <div className="user-panel" onClick={(e) => e.stopPropagation()}>
            <div className="user-panel-header">
              {typeof userAvatar === 'string' && userAvatar.startsWith('data:image') ? (
                <div className="user-panel-avatar" style={{ backgroundImage: `url(${userAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
              ) : (
                <div className="user-panel-avatar"><span>{userAvatar}</span></div>
              )}
              <div className="user-panel-info">
                <h3>{profileData.nickname || '我的账号'}</h3>
              </div>
            </div>

            <div className="user-panel-menu">
              <div className="menu-item" onClick={(e) => { e.stopPropagation(); handleOpenProfile() }}><span className="menu-icon">👤</span><span className="menu-text">个人信息</span><span className="menu-arrow">›</span></div>
              <div className="menu-item" onClick={(e) => { e.stopPropagation(); handleOpenChangePassword() }}><span className="menu-icon">🔑</span><span className="menu-text">修改密码</span><span className="menu-arrow">›</span></div>
              <div className="menu-item"><span className="menu-icon">⚙️</span><span className="menu-text">设置</span><span className="menu-arrow">›</span></div>
              <div className="menu-item" onClick={toggleNightMode}><span className="menu-icon">{isNightMode ? '☀️' : '🌙'}</span><span className="menu-text">{isNightMode ? '日间模式' : '夜间模式'}</span><span className="menu-toggle"><span className={`toggle-switch ${isNightMode ? 'active' : ''}`}></span></span></div>
              <div className="menu-item"><span className="menu-icon">🔔</span><span className="menu-text">消息通知</span><span className="menu-badge">3</span></div>
              <div className="menu-item"><span className="menu-icon">📁</span><span className="menu-text">文件管理</span><span className="menu-arrow">›</span></div>
              <div className="menu-item"><span className="menu-icon">❓</span><span className="menu-text">帮助与反馈</span><span className="menu-arrow">›</span></div>
              <div className="menu-item"><span className="menu-icon">ℹ️</span><span className="menu-text">关于我们</span><span className="menu-arrow">›</span></div>
            </div>

            <div className="user-panel-footer">
              <button className="logout-btn" onClick={handleLogout}><span className="logout-icon">🚪</span>退出登录</button>
              <button className="delete-account-btn" onClick={handleDeleteAccount}><span className="delete-account-icon">🗑️</span>注销账户</button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="profile-modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>个人信息</h3>
              <button className="profile-modal-close" onClick={() => setShowProfileModal(false)}>×</button>
            </div>

            <div className="profile-modal-body">
              {!isEditingProfile ? (
                <div className="profile-view">
                  <div className="profile-avatar-section">
                    {typeof userAvatar === 'string' && userAvatar.startsWith('data:image') ? (
                      <div className="profile-avatar" style={{ backgroundImage: `url(${userAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                        <label htmlFor="avatar-upload" className="avatar-overlay">
                          <span className="avatar-change-text">更换头像</span>
                        </label>
                      </div>
                    ) : (
                      <div className="profile-avatar">
                        <span>{userAvatar}</span>
                        <label htmlFor="avatar-upload" className="avatar-overlay">
                          <span className="avatar-change-text">更换头像</span>
                        </label>
                      </div>
                    )}
                    <input 
                      type="file" 
                      id="avatar-upload" 
                      accept="image/*" 
                      onChange={handleChangeAvatar} 
                      style={{ display: 'none' }} 
                    />
                  </div>

                  <div className="profile-info-list">

                    <div className="profile-info-item"><span className="info-label">登录账号：</span><span className="info-value">{profileData.username || '--'}</span></div>
                    <div className="profile-info-item"><span className="info-label">昵称：</span><span className="info-value">{profileData.nickname || '未设置'}</span></div>
                    <div className="profile-info-item"><span className="info-label">性别：</span><span className="info-value">{profileData.gender === 'male' ? '男' : profileData.gender === 'female' ? '女' : '其他'}</span></div>
                    <div className="profile-info-item"><span className="info-label">邮箱：</span><span className="info-value">{profileData.email || '未设置'}</span></div>
                    <div className="profile-info-item"><span className="info-label">手机号：</span><span className="info-value">{profileData.phone || '未设置'}</span></div>
                    <div className="profile-info-item"><span className="info-label">个人简介：</span><span className="info-value">{profileData.bio || '暂无简介'}</span></div>
                  </div>

                  <button className="edit-profile-btn" onClick={handleEditProfile}>编辑资料</button>
                </div>
              ) : (
                <div className="profile-edit-form">
                  <div className="form-group">
                    <label>登录账号</label>
                    <input type="text" value={profileData.username} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="nickname">昵称（聊天显示名）</label>
                    <input type="text" id="nickname" value={profileData.nickname} onChange={(e) => handleProfileChange('nickname', e.target.value)} placeholder="请输入昵称，留空则显示登录账号" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="gender">性别</label>
                    <select id="gender" value={profileData.gender} onChange={(e) => handleProfileChange('gender', e.target.value)}>
                      <option value="male">男</option>
                      <option value="female">女</option>
                      <option value="other">其他</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">邮箱</label>
                    <input type="email" id="email" value={profileData.email} onChange={(e) => handleProfileChange('email', e.target.value)} placeholder="请输入邮箱地址" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="phone">手机号</label>
                    <input type="tel" id="phone" value={profileData.phone} onChange={(e) => handleProfileChange('phone', e.target.value)} placeholder="请输入手机号" pattern="[0-9]{11}" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="bio">个人简介</label>
                    <textarea id="bio" value={profileData.bio} onChange={(e) => handleProfileChange('bio', e.target.value)} placeholder="介绍一下自己吧..." rows="4" />
                  </div>
                  <div className="profile-form-buttons">
                    <button className="cancel-btn" onClick={handleCancelProfile}>取消</button>
                    <button className="save-btn" onClick={handleSaveProfile}>保存</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPeerProfileModal && peerProfile && (
        <div className="peer-profile-overlay" onClick={handleClosePeerProfile}>
          <div className="peer-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="peer-profile-header">
              <button className="peer-profile-close" onClick={handleClosePeerProfile}>×</button>
            </div>

            <div className="peer-profile-body">
              <div className="peer-profile-avatar-wrap">
                {renderAvatar(peerProfile.avatar, 'peer-profile-avatar')}
              </div>
              <h3 className="peer-profile-name">{peerProfile.name}</h3>
              <p className="peer-profile-id">刀盾号：{peerProfile.wechatId || peerProfile.name}</p>

              <div className="peer-profile-info-list">

                <div className="peer-profile-info-item">
                  <span className="peer-profile-info-label">来源</span>
                  <span className="peer-profile-info-value">{peerProfile.source === 'group' ? '群聊成员' : '私聊对象'}</span>
                </div>
                <div className="peer-profile-info-item signature">
                  <span className="peer-profile-info-label">个性签名</span>
                  <span className="peer-profile-info-value">{peerProfile.signature || '这个人很懒，什么都没写~'}</span>
                </div>
              </div>

              <div className="peer-profile-actions">
                {peerIsFriend ? (
                  <button className="peer-profile-send-btn" onClick={handleStartChatWithPeer}>发消息</button>
                ) : (
                  <button
                    className="peer-profile-add-btn"
                    onClick={handleAddPeerAsFriend}
                    disabled={peerRequestPending}
                  >
                    {peerRequestPending ? '已发送申请' : '发送申请'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showChatDetail && (
        <div className="chat-detail-overlay" onClick={handleCloseChatDetail}>
          <div className="chat-detail-panel" onClick={(e) => e.stopPropagation()}>
            <div className="chat-detail-header"><h3>聊天详情</h3><button className="chat-detail-close" onClick={handleCloseChatDetail}>×</button></div>
            <div className="chat-detail-content">
              {getCurrentSession().isGroup ? (
                <div className="group-chat-detail">
                  <div className="group-info-section">
                    {renderAvatar(getCurrentSession().avatar, 'group-avatar-large')}
                    {!isEditingGroupName ? (
                      <div className="group-name-row">
                        <h2 className="group-name">{getCurrentSession().title}</h2>
                        {canRenameCurrentGroup && (
                          <button className="edit-group-name-btn" type="button" onClick={handleStartEditGroupName}>
                            编辑名称
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="group-name-edit-row">
                        <input
                          className="group-name-edit-input"
                          type="text"
                          value={tempGroupName}
                          onChange={(e) => setTempGroupName(e.target.value)}
                          maxLength={64}
                          placeholder="请输入群聊名称"
                          autoFocus
                        />
                        <div className="group-name-edit-actions">
                          <button className="save-group-name-btn" type="button" onClick={handleSaveGroupName} disabled={isRenamingGroup}>
                            {isRenamingGroup ? '保存中...' : '保存'}
                          </button>
                          <button className="cancel-group-name-btn" type="button" onClick={handleCancelEditGroupName} disabled={isRenamingGroup}>
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                    <p className="group-member-count">{(groupMembers[currentChat] || []).length} 位成员</p>
                  </div>

                  <div className="detail-section"><div className="section-title">群公告</div><div className="section-content"><p>欢迎加入{getCurrentSession().title}！请遵守群规，文明交流。</p></div></div>
                  <div className="detail-section"><div className="section-title">群主</div><div className="section-content owner-info"><div onClick={() => handleOpenOwnerProfile()} style={{ cursor: 'pointer' }}>{renderAvatar(currentGroupOwner?.avatar || getCurrentSession().avatar, 'owner-avatar')}</div><div className="owner-info"><div className="owner-name">{currentGroupOwner?.displayName || getCurrentOwner()}</div><div className="owner-role">群主</div></div></div></div>

                  <div className="detail-section">
                    <div className="section-title">成员</div>
                    <div className="section-content members-preview">
                      {groupMembers[currentChat]?.slice(0, 8).map((member, index) => (
                        <div key={index} className="member-avatar-small" title={member.displayName || member.name} onClick={() => handleOpenMemberProfile(member)} style={{ cursor: 'pointer' }}>
                          {renderAvatar(member.avatar, 'member-avatar-small-inner')}
                        </div>
                      ))}
                      <div className="view-all-members invite-action" onClick={handleOpenInviteMember} title="邀请好友">+</div>
                    </div>
                  </div>
                  <div className="detail-section"><div className="section-title">我在本群的昵称</div><div className="section-content">{!isEditingGroupNickname ? (<div className="my-nickname">{(groupMembers[currentChat] || []).find((member) => member.name === profileData.username)?.groupNickname || '未设置'}<button type="button" className="edit-nickname-btn" onClick={handleStartEditGroupNickname}>编辑</button></div>) : (<div className="remark-edit-form"><input type="text" value={tempGroupNickname} onChange={(e) => setTempGroupNickname(e.target.value)} placeholder="请输入我在本群的昵称" autoFocus /><div className="remark-actions"><button type="button" className="save-remark-btn" onClick={handleSaveGroupNickname}>保存</button><button type="button" className="cancel-remark-btn" onClick={handleCancelEditGroupNickname}>取消</button></div></div>)}</div></div>
                  <div className="detail-section"><div className="section-title">置顶聊天</div><div className="section-content"><label className="toggle-switch-label"><input type="checkbox" className="toggle-checkbox" checked={isChatPinned(currentChat)} onChange={() => handleTogglePinChat(currentChat)} /><span className="toggle-slider"></span></label></div></div>
                  <div className="detail-section clickable" onClick={handleOpenSearchMessage}>
                    <div className="section-content">
                      <span className="section-title" style={{ marginBottom: 0 }}>查找聊天记录</span>
                      <span className="arrow-icon">›</span>
                    </div>
                  </div>

                  <div className="detail-section">
                    <div className="section-title">群公告</div>
                    <div className="section-content">
                      {!isEditingAnnouncement ? (
                        <div className="announcement-display">
                          <p className="announcement-text">{groupAnnouncement || '暂无公告'}</p>
                          <div className="remark-actions">
                            <button type="button" className="edit-remark-btn" onClick={handleOpenAnnouncementHistory}>历史公告</button>
                            {(userRole === 'owner' || userRole === 'admin') && <button type="button" className="edit-announcement-btn" onClick={handleStartEditAnnouncement}>编辑</button>}
                          </div>
                        </div>
                      ) : (
                        <div className="announcement-edit-form">
                          <textarea value={tempAnnouncement} onChange={(e) => setTempAnnouncement(e.target.value)} placeholder="请输入群公告内容" rows="3" />
                          <div className="announcement-actions">
                            <button type="button" className="save-announcement-btn" onClick={handleSaveAnnouncement}>保存</button>
                            <button type="button" className="cancel-announcement-btn" onClick={handleCancelEditAnnouncement}>取消</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="detail-section clickable" onClick={handleOpenMemberList}>
                    <div className="section-content">
                      <span className="section-title" style={{ marginBottom: 0 }}>成员管理</span>
                      <span className="arrow-icon">›</span>
                    </div>
                  </div>

                  {userRole === 'owner' && (
                    <div className="detail-section"><div className="section-title">危险操作</div><div className="section-content"><button className="danger-btn" onClick={handleDismissGroup}>解散群聊</button></div></div>
                  )}

                  {(userRole === 'member' || userRole === 'admin') && (
                    <div className="detail-section"><div className="section-title">危险操作</div><div className="section-content"><button className="danger-btn" onClick={handleExitGroup}>退出群聊</button></div></div>
                  )}


                </div>
              ) : (
                <div className="personal-chat-detail">
                  <div className="personal-info-section">
                    <div onClick={handleOpenChatDetailPeerProfile} style={{ cursor: 'pointer' }}>
                      {renderAvatar(currentSession.avatar, 'personal-avatar-large')}
                    </div>
                    <h2 className="personal-name">{currentSession.title}</h2>
                  </div>

                  <div className="detail-section">
                    <div className="section-title">备注</div>
                    <div className="section-content">
                      {!isEditingRemark ? (
                        <div className="remark-input">
                          {currentPrivateFriend?.remark || '未设置'}
                          <button type="button" className="edit-remark-btn" onClick={handleStartEditRemark}>编辑</button>
                        </div>
                      ) : (
                        <div className="remark-edit-form">
                          <input type="text" value={tempRemark} onChange={(e) => setTempRemark(e.target.value)} placeholder="请输入备注" autoFocus />
                          <div className="remark-actions">
                            <button type="button" className="save-remark-btn" onClick={handleSaveRemark}>保存</button>
                            <button type="button" className="cancel-remark-btn" onClick={handleCancelEditRemark}>取消</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>


                  <div className="detail-section clickable" onClick={handleOpenSearchMessage}>
                    <div className="section-content">
                      <span className="section-title" style={{ marginBottom: 0 }}>查找聊天记录</span>
                      <span className="arrow-icon">›</span>
                    </div>
                  </div>
                  <div className="detail-section"><div className="section-title">置顶聊天</div><div className="section-content"><label className="toggle-switch-label"><input type="checkbox" className="toggle-checkbox" checked={isChatPinned(currentChat)} onChange={() => handleTogglePinChat(currentChat)} /><span className="toggle-slider"></span></label></div></div>
                  <div className="detail-section"><div className="section-title">添加到黑名单</div><div className="section-content"><label className="toggle-switch-label"><input type="checkbox" className="toggle-checkbox" checked={currentSession.isGroup ? false : isUserInBlacklist(blacklistTarget.id)} onChange={() => !currentSession.isGroup && handleToggleBlacklist(blacklistTarget)} /><span className="toggle-slider"></span></label></div></div>
                  <div 
                    className={`detail-section clickable danger ${!currentPrivateFriend ? 'disabled' : ''}`}
                    onClick={() => currentPrivateFriend && handleDeleteFriend(currentPrivateFriend.id)}
                  >
                    <div className="section-content">
                      <span className="section-title" style={{ marginBottom: 0 }}>删除好友</span>
                      <span className="arrow-icon">›</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddFriendModal && (
        <div className="add-friend-modal-overlay" onClick={handleCloseAddFriend}>
          <div className="add-friend-modal" onClick={(e) => e.stopPropagation()}>
            <div className="add-friend-modal-header">
              <h3>添加好友</h3>
              <button className="add-friend-modal-close" onClick={handleCloseAddFriend}>×</button>
            </div>
            <div className="add-friend-modal-body">
              <div className="friend-search-section">
                <input type="text" className="friend-search-input" placeholder="搜索用户名、昵称或刀盾号" value={friendSearchQuery} onChange={handleSearchFriend} autoFocus />
              </div>
              {friendSearchQuery && (
                <div className="friend-search-results">
                  {friendSearchResults.length > 0 ? (
                    friendSearchResults.map((user) => {
                      const alreadyFriend = isAlreadyFriend(user.userId, user.name)
                      return (
                        <div key={user.userId} className="search-result-item">
                          <div className="result-avatar">{renderAvatar(user.avatar, 'result-avatar-img')}</div>
                          <div className="result-info">
                            <p className="result-name">{user.name}</p>
                            <p className="result-subtitle">刀盾号：{user.userId}</p>
                          </div>
                          <button
                            className="send-request-btn"
                            onClick={() => handleSendFriendRequest(user.userId)}
                            disabled={alreadyFriend}
                          >
                            {alreadyFriend ? '已是好友' : '发送申请'}
                          </button>
                        </div>
                      )
                    })
                  ) : (
                    <div className="no-results">
                      <p>未找到匹配的用户</p>
                    </div>
                  )}
                </div>
              )}

              {groupInviteRequests.length > 0 && (
                <div className="friend-requests-section">
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
                <div className="friend-requests-section">
                  <h4>待我审批 ({friendRequestList.length})</h4>
                  {friendRequestList.map((request) => (
                    <div key={request.id} className="request-item">
                      {renderAvatar(request.avatar, 'request-avatar')}
                      <div className="request-info"><p className="request-name">{request.name}</p><p className="request-message">想添加你为好友</p></div>
                      <div className="request-actions">
                        <button className="accept-btn" onClick={() => handleAcceptRequest(request.id)}>接受</button>
                        <button className="reject-btn" onClick={() => handleRejectRequest(request.id)}>拒绝</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sentFriendRequests.length > 0 && (
                <div className="friend-requests-section">
                  <h4>我发出的申请 ({sentFriendRequests.length})</h4>
                  {sentFriendRequests.map((request) => (
                    <div key={request.id} className="request-item">
                      {renderAvatar(request.avatar, 'request-avatar')}
                      <div className="request-info">
                        <p className="request-name">{request.name}</p>
                        <p className="request-message">
                          {request.status === 'approved'
                            ? `已通过（${request.approvedAt}）`
                            : `等待对方审批（${request.createdAt}）`}
                        </p>
                      </div>
                      <div className="request-actions">
                        <button className="accept-btn" disabled>
                          {request.status === 'pending' ? '待审批' : '已通过'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {myFriends.length > 0 && !friendSearchQuery && (
                <div className="my-friends-list-section">
                  <h4>我的好友 ({myFriends.length})</h4>
                  {myFriends.map((friend) => (
                    <div key={friend.id} className="friend-list-item">
                      {renderAvatar(friend.avatar, 'friend-list-avatar')}
                      <div className="friend-list-info">
                        <p className="friend-list-name">{friend.name}</p>

                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!friendSearchQuery && friendRequestList.length === 0 && (
                <div className="add-friend-hint"><p>在上方搜索框中输入用户的刀盾号、昵称或手机号</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSearchMessageModal && (
        <div className="search-message-overlay" onClick={handleCloseSearchMessage}>
          <div className="search-message-modal" onClick={(e) => e.stopPropagation()}>
            <div className="search-message-header"><h3>查找聊天记录</h3><button className="close-btn" onClick={handleCloseSearchMessage}>✕</button></div>
            <div className="search-message-body">
              <div className="message-search-section">
                <input type="text" className="message-search-input" placeholder="搜索聊天内容" value={searchMessageQuery} onChange={handleSearchMessages} autoFocus />
              </div>

              {searchResults.length > 0 && (
                <div className="search-results-info">
                  <span>找到 {searchResults.length} 条相关消息</span>
                  <div className="result-navigation">
                    <button className="nav-btn" onClick={handlePreviousResult} disabled={currentResultIndex === 0}>↑ 上一条</button>
                    <span className="result-index">{currentResultIndex + 1} / {searchResults.length}</span>
                    <button className="nav-btn" onClick={handleNextResult} disabled={currentResultIndex === searchResults.length - 1}>下一条 ↓</button>
                  </div>
                </div>
              )}

              {searchResults.length > 0 ? (
                <div className="search-results-list">
                  {searchResults.map((result, index) => (
                    <div key={result.index} className={`search-result-item ${index === currentResultIndex ? 'active' : ''}`} onClick={() => { setCurrentResultIndex(index); handleJumpToMessage(result.index) }}>
                      <div className="result-sender">{result.sender === 'me' ? '我' : getCurrentSession().title}</div>
                      <div className="result-text">{highlightText(result.text, searchMessageQuery)}</div>
                      <div className="result-time">{result.time}</div>
                    </div>
                  ))}
                </div>
              ) : searchMessageQuery.trim() ? (
                <div className="no-results"><p>未找到相关消息</p></div>
              ) : (
                <div className="search-placeholder"><p>请输入关键词搜索聊天内容</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAnnouncementHistoryModal && (
        <div className="search-message-overlay" onClick={handleCloseAnnouncementHistory}>
          <div className="search-message-modal" onClick={(e) => e.stopPropagation()}>
            <div className="search-message-header"><h3>历史公告</h3><button className="close-btn" onClick={handleCloseAnnouncementHistory}>✕</button></div>
            <div className="search-message-body">
              {groupAnnouncementHistory.length > 0 ? (
                <div className="search-results-list">
                  {groupAnnouncementHistory.map((item) => (
                    <div key={item.id} className="search-result-item">
                      <div className="result-sender">{item.publisherName}</div>
                      <div className="result-text">{item.content}</div>
                      <div className="result-time">{item.createdAt ? item.createdAt.replace('T', ' ').slice(0, 16) : ''}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="search-placeholder"><p>暂无历史公告</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {showMemberListModal && (
        <div className="member-list-overlay" onClick={handleCloseMemberList}>
          <div className="member-list-modal" onClick={(e) => e.stopPropagation()}>
            <div className="member-list-header"><h3>成员管理</h3><button className="close-btn" onClick={handleCloseMemberList}>✕</button></div>
            <div className="member-list-body">
              <div className="member-list-section">
                <h4>群主</h4>
                <div className="member-item">
                  {renderAvatar(currentGroupOwner?.avatar, 'member-avatar')}
                  <div className="member-info">
                    <p className="member-name">{currentGroupOwner?.displayName || currentGroupOwner?.name || '暂无群主'}</p>
                    <p className="member-role">群主 </p>
                  </div>
                  {userRole === 'owner' && <span className="member-role">仅可在下方成员条目中操作</span>}
                </div>
              </div>

              <div className="member-list-section">
                <h4>管理员 ({groupMembers[currentChat]?.filter((m) => m.role === 'admin').length || 0})</h4>
                {groupMembers[currentChat]?.filter((m) => m.role === 'admin').map((member, index) => (
                  <div key={index} className="member-item">
                    {renderAvatar(member.avatar, 'member-avatar')}
                    <div className="member-info">
                      <p className="member-name">{member.displayName || member.name}</p>
                      <p className="member-role">管理员 </p>
                    </div>
                    {userRole === 'owner' && (
                      <div className="action-button-group">
                        <button className="action-btn make-admin" onClick={() => handleMakeAdmin(member.id, false)}>取消群管</button>
                        <button className="action-btn transfer-owner" onClick={() => handleTransferGroup(member.id)}>转让群主</button>
                        <button className="action-btn remove-member" onClick={() => handleRemoveMember(member.id)}>移出群聊</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="member-list-section">
                <h4>普通成员 ({groupMembers[currentChat]?.filter((m) => m.role === 'member').length || 0})</h4>
                {groupMembers[currentChat]?.filter((m) => m.role === 'member').map((member, index) => (
                  <div key={index} className="member-item">
                    {renderAvatar(member.avatar, 'member-avatar')}
                    <div className="member-info">
                      <p className="member-name">{member.displayName || member.name}</p>
                      <p className="member-role">普通成员 </p>
                    </div>
                    {userRole === 'owner' && (
                      <div className="action-button-group">
                        <button className="action-btn make-admin" onClick={() => handleMakeAdmin(member.id, true)}>设为群管</button>
                        <button className="action-btn transfer-owner" onClick={() => handleTransferGroup(member.id)}>转让群主</button>
                        <button className="action-btn remove-member" onClick={() => handleRemoveMember(member.id)}>移出群聊</button>
                      </div>
                    )}
                    {userRole === 'admin' && <button className="action-btn remove-member" onClick={() => handleRemoveMember(member.id)}>移出群聊</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {showInviteMemberModal && (() => {
        const existingMemberIds = getCurrentGroupMemberIds()
        // Only show friends who are NOT already in the group
        // Use accountId (string from backend) with Number() conversion, fall back to id
        const invitableFriends = myFriends.filter(
          (f) => !existingMemberIds.has(Number(f.accountId ?? f.id))
        )
        return (
          <div className="invite-member-overlay" onClick={handleCloseInviteMember}>
            <div className="invite-member-modal" onClick={(e) => e.stopPropagation()}>
              <div className="invite-member-header">
                <h3>邀请好友</h3>
                <button className="close-btn" onClick={handleCloseInviteMember}>✕</button>
              </div>
              <div className="invite-member-body">
                <p className="invite-hint">
                  选择要邀请加入群聊的好友（已在群中的好友不显示）
                </p>
                <div className="friend-select-list">
                  {invitableFriends.length > 0 ? (
                    invitableFriends.map((friend) => {
                      const friendId = Number(friend.accountId)
                      const isSelected = selectedInviteFriends.includes(friendId)
                      return (
                        <label
                          key={friend.id}
                          className={`friend-checkbox ${isSelected ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleInviteFriend(friendId)}
                          />
                          <div className="friend-avatar-small">{renderAvatar(friend.avatar, 'friend-avatar-img')}</div>
                          <span className="friend-name">{friend.remark || friend.name}</span>
                        </label>
                      )
                    })
                  ) : (
                    <p className="invite-empty">所有好友均已在该群聊中</p>
                  )}
                </div>
                <button
                  className="send-invite-btn"
                  onClick={handleSendInvite}
                  disabled={selectedInviteFriends.length === 0}
                >
                  邀请 {selectedInviteFriends.length > 0 ? `(${selectedInviteFriends.length})` : ''}
                </button>
              </div>
            </div>
          </div>
        )
      })()}


      {showCreateGroupModal && (
        <div className="create-group-overlay" onClick={handleCloseCreateGroup}>
          <div className="create-group-modal" onClick={(e) => e.stopPropagation()}>
            <div className="create-group-header"><h3>创建群聊</h3><button className="close-btn" onClick={handleCloseCreateGroup}>✕</button></div>
            <div className="create-group-body">
              <div className="group-name-section">
                <label className="group-name-label">群聊名称</label>
                <input type="text" className="group-name-input" placeholder="请输入群聊名称" value={groupName} onChange={(e) => setGroupName(e.target.value)} autoFocus />
              </div>

              <div className="select-friends-section">
                <div className="section-header"><label>选择成员</label><span className="selected-count">已选 {selectedFriends.length} 人</span></div>
                <div className="friends-checkbox-list">
                  {myFriends.map((friend) => (
                    <label key={friend.id} className={`friend-checkbox ${selectedFriends.includes(friend.id) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={selectedFriends.includes(friend.id)} onChange={() => handleToggleSelectFriend(friend.id)} />
                      {renderAvatar(friend.avatar, 'friend-checkbox-avatar')}
                      <span className="friend-checkbox-name">{friend.remark || friend.name}{friend.remark && <span className="real-name">({friend.name})</span>}</span>
                    </label>
                  ))}
                </div>
              </div>

              {selectedFriends.length > 0 && (
                <div className="selected-preview">
                  <label>已选择的好友</label>
                  <div className="selected-avatars">
                    {selectedFriends.map((id) => {
                      const friend = myFriends.find((f) => f.id === id)
                      return <div key={id} title={friend?.remark || friend?.name}>{renderAvatar(friend?.avatar, 'selected-avatar')}</div>
                    })}
                    <div className="selected-avatar self">我</div>
                  </div>
                  <p className="preview-text">共 {selectedFriends.length + 1} 人</p>
                </div>
              )}

              <div className="create-group-actions">
                <button className="cancel-create-btn" onClick={handleCloseCreateGroup}>取消</button>
                <button className="create-group-submit-btn" onClick={handleCreateGroup}>
                  创建群聊 ({selectedFriends.length + 1}人)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="delete-confirm-overlay" onClick={cancelDeleteAccount}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-header">
              <h3>⚠️ 注销账户</h3>
            </div>
            <div className="delete-confirm-body">
              <p>您确定要注销账户吗？此操作不可恢复！</p>
              <p style={{ color: '#ff4444', fontWeight: 'bold' }}>所有数据将被永久删除</p>
            </div>
            <div className="delete-confirm-footer">
              <button className="cancel-btn" onClick={cancelDeleteAccount}>取消</button>
              <button className="confirm-btn" onClick={confirmDeleteAccount}>确认注销</button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="logout-confirm-overlay" onClick={cancelLogout}>
          <div className="logout-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="logout-confirm-header">
              <h3>🚪 退出登录</h3>
            </div>
            <div className="logout-confirm-body">
              <p>您确定要退出登录吗？</p>
            </div>
            <div className="logout-confirm-footer">
              <button className="cancel-btn" onClick={cancelLogout}>取消</button>
              <button className="confirm-btn" onClick={confirmLogout}>确认退出</button>
            </div>
          </div>
        </div>
      )}

      {showChangePasswordModal && (
        <ChangePasswordModal
          username={profileData?.username || ''}
          handleCloseChangePassword={handleCloseChangePassword}
          changePasswordForm={changePasswordForm}
          handleChangePasswordInput={handleChangePasswordInput}
          handleSubmitChangePassword={handleSubmitChangePassword}
        />
      )}

    </>
  )
}

/**
 * 密码显示/隐藏切换图标，定义在模块级别避免每次渲染重建。
 */
function EyeIcon({ visible }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {visible ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  )
}

/**
 * 修改密码弹窗子组件，自管理三个密码框的显示/隐藏状态。
 */
function ChangePasswordModal({
  username,
  handleCloseChangePassword,
  changePasswordForm,
  handleChangePasswordInput,
  handleSubmitChangePassword,
}) {
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div className="change-password-overlay" onClick={handleCloseChangePassword}>
      <div className="change-password-modal" onClick={(e) => e.stopPropagation()}>
        <div className="change-password-header">
          <h3>🔑 修改密码</h3>
          <button className="change-password-close" onClick={handleCloseChangePassword}>×</button>
        </div>
        <div className="change-password-body">
          <input
            type="text"
            value={username}
            autoComplete="username"
            readOnly
            tabIndex={-1}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0 }}
          />
          <div className="form-group">
            <label htmlFor="oldPassword">原密码</label>
            <div className="password-input-wrapper">
              <input
                type={showOld ? 'text' : 'password'}
                id="oldPassword"
                value={changePasswordForm.oldPassword}
                onChange={(e) => handleChangePasswordInput('oldPassword', e.target.value)}
                placeholder="请输入原密码"
                autoComplete="current-password"
              />
              <button type="button" className="password-toggle-btn" onClick={() => setShowOld(!showOld)} aria-label={showOld ? '隐藏密码' : '显示密码'}>
                <EyeIcon visible={showOld} />
              </button>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="newPassword">新密码</label>
            <div className="password-input-wrapper">
              <input
                type={showNew ? 'text' : 'password'}
                id="newPassword"
                value={changePasswordForm.newPassword}
                onChange={(e) => handleChangePasswordInput('newPassword', e.target.value)}
                placeholder="请输入新密码（至少 6 位）"
                autoComplete="new-password"
              />
              <button type="button" className="password-toggle-btn" onClick={() => setShowNew(!showNew)} aria-label={showNew ? '隐藏密码' : '显示密码'}>
                <EyeIcon visible={showNew} />
              </button>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">确认新密码</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirm ? 'text' : 'password'}
                id="confirmPassword"
                value={changePasswordForm.confirmPassword}
                onChange={(e) => handleChangePasswordInput('confirmPassword', e.target.value)}
                placeholder="请再次输入新密码"
                autoComplete="new-password"
              />
              <button type="button" className="password-toggle-btn" onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm ? '隐藏密码' : '显示密码'}>
                <EyeIcon visible={showConfirm} />
              </button>
            </div>
          </div>
        </div>
        <div className="change-password-footer">
          <button className="cancel-btn" onClick={handleCloseChangePassword}>取消</button>
          <button className="confirm-btn" onClick={handleSubmitChangePassword}>确认修改</button>
        </div>
      </div>
    </div>
  )
}

export default Overlays

