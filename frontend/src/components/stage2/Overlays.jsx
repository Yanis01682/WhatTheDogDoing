/**
 * 全局弹层容器组件。
 * 负责渲染聊天页所有 overlay/modal，包括：表情面板、右键菜单、好友申请、聊天详情、成员管理等。
 * 说明：该组件仅做展示与事件转发，不持有业务状态，所有数据来自 App。
 */
function Overlays({
  // 表情面板显示控制。
  showEmojiPicker,
  closeEmojiPicker,
  handleEmojiSelect,
  // 消息右键菜单状态与动作。
  contextMenu,
  closeContextMenu,
  handleReplyMessage,
  handleEditMessage,
  handleRevokeMessage,
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
  showStatusMenu,
  setShowStatusMenu,
  getStatusIcon,
  getStatusText,
  userStatus,
  handleOpenProfile,
  toggleNightMode,
  isNightMode,
  handleLogout,
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
  // 聊天详情及群操作。
  showChatDetail,
  handleCloseChatDetail,
  getCurrentSession,
  handleOpenSearchMessage,
  isEditingAnnouncement,
  groupAnnouncement,
  userRole,
  handleStartEditAnnouncement,
  tempAnnouncement,
  setTempAnnouncement,
  handleSaveAnnouncement,
  handleCancelEditAnnouncement,
  handleOpenMemberList,
  handleOpenInviteMember,
  handleTransferGroup,
  handleDismissGroup,
  handleExitGroup,
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
  getSentRequestStatus,
  handleSendFriendRequest,
  friendRequestList,
  sentFriendRequests,
  handleMockApproveSentRequest,
  handleAcceptRequest,
  handleRejectRequest,
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
  // 创建群聊。
  showCreateGroupModal,
  handleCloseCreateGroup,
  groupName,
  setGroupName,
  selectedFriends,
  handleToggleSelectFriend,
  handleCreateGroup
}) {
  const peerIsFriend = peerProfile ? isAlreadyFriend(peerProfile.userId, peerProfile.name) : false
  const peerRequestPending = peerProfile
    ? sentFriendRequests.some(
        (item) => item.status === 'pending' && (item.userId === peerProfile.userId || item.name === peerProfile.name)
      )
    : false

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
        <div className="context-menu-overlay" onClick={closeContextMenu}>
          <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
            {contextMenu.canReply && (
              <button className="context-menu-item" onClick={handleReplyMessage} type="button">
                <span className="menu-item-icon">↩️</span>
                <span className="menu-item-text">回复</span>
              </button>
            )}
            {contextMenu.canRevoke && (
              <>
                <button className="context-menu-item" onClick={handleEditMessage} type="button">
                  <span className="menu-item-icon">✏️</span>
                  <span className="menu-item-text">编辑</span>
                </button>
                <button className="context-menu-item revoke" onClick={handleRevokeMessage} type="button">
                  <span className="menu-item-icon">↩️</span>
                  <span className="menu-item-text">撤回</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showMemberModal && (
        <div className="modal-overlay" onClick={closeMemberModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{sessions[currentChat].title} - 群成员</h3>
              <button className="modal-close" onClick={closeMemberModal}>×</button>
            </div>
            <div className="group-info-card">
              <div className="info-row"><span className="info-label">群主：</span><span className="info-value">{getCurrentOwner()}</span></div>
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
                  <div className="member-avatar">{member.avatar}</div>
                  <div className="member-info">
                    <div className="member-name">
                      {member.name}
                      <span className={`role-badge role-${member.role}`}>{member.role === 'owner' ? '群主' : member.role === 'admin' ? '管理员' : '成员'}</span>
                    </div>
                    <div className="member-status">
                      <span className={`online-indicator ${member.online ? 'online' : 'offline'}`}></span>
                      {member.online ? '在线' : '离线'}
                    </div>
                  </div>
                  {myRole[currentChat] === 'owner' && member.role === 'member' && (
                    <div className="member-actions">
                      <button className="action-btn make-admin" onClick={() => handleMakeAdmin(member.id)}>任命管理员</button>
                      <button className="action-btn remove-member" onClick={() => handleRemoveMember(member.id)}>移出群聊</button>
                    </div>
                  )}
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
                <div className="user-status-selector" onClick={() => setShowStatusMenu(!showStatusMenu)}>
                  <span className="user-status-icon">{getStatusIcon(userStatus)}</span>
                  <span className="user-status-text">{getStatusText(userStatus)}</span>
                  <span className={`user-status-arrow ${showStatusMenu ? 'active' : ''}`}>›</span>
                </div>
              </div>
            </div>

            <div className="user-panel-menu">
              <div className="menu-item" onClick={(e) => { e.stopPropagation(); handleOpenProfile() }}><span className="menu-icon">👤</span><span className="menu-text">个人信息</span><span className="menu-arrow">›</span></div>
              <div className="menu-item"><span className="menu-icon">⚙️</span><span className="menu-text">设置</span><span className="menu-arrow">›</span></div>
              <div className="menu-item" onClick={toggleNightMode}><span className="menu-icon">{isNightMode ? '☀️' : '🌙'}</span><span className="menu-text">{isNightMode ? '日间模式' : '夜间模式'}</span><span className="menu-toggle"><span className={`toggle-switch ${isNightMode ? 'active' : ''}`}></span></span></div>
              <div className="menu-item"><span className="menu-icon">🔔</span><span className="menu-text">消息通知</span><span className="menu-badge">3</span></div>
              <div className="menu-item"><span className="menu-icon">📁</span><span className="menu-text">文件管理</span><span className="menu-arrow">›</span></div>
              <div className="menu-item"><span className="menu-icon">❓</span><span className="menu-text">帮助与反馈</span><span className="menu-arrow">›</span></div>
              <div className="menu-item"><span className="menu-icon">ℹ️</span><span className="menu-text">关于我们</span><span className="menu-arrow">›</span></div>
            </div>

            <div className="user-panel-footer">
              <button className="logout-btn" onClick={handleLogout}><span className="logout-icon">🚪</span>退出登录</button>
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
                      <div className="profile-avatar" style={{ backgroundImage: `url(${userAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                    ) : (
                      <div className="profile-avatar"><span>{userAvatar}</span></div>
                    )}
                  </div>

                  <div className="profile-info-list">
                    <div className="profile-info-item"><span className="info-label">在线状态：</span><span className="info-value">{getStatusIcon(userStatus)} {getStatusText(userStatus)}</span></div>
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
                    <label htmlFor="nickname">昵称</label>
                    <input type="text" id="nickname" value={profileData.nickname} onChange={(e) => handleProfileChange('nickname', e.target.value)} placeholder="请输入昵称" />
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
                <div className="peer-profile-avatar">{peerProfile.avatar}</div>
              </div>
              <h3 className="peer-profile-name">{peerProfile.name}</h3>
              <p className="peer-profile-id">微信号：{peerProfile.wechatId || peerProfile.name}</p>

              <div className="peer-profile-info-list">
                <div className="peer-profile-info-item">
                  <span className="peer-profile-info-label">状态</span>
                  <span className="peer-profile-info-value">{peerProfile.status === 'online' ? '在线' : '离线'}</span>
                </div>
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
                    {peerRequestPending ? '已发送申请' : '添加好友'}
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
                    <div className="group-avatar-large">{getCurrentSession().avatar}</div>
                    <h2 className="group-name">{getCurrentSession().title}</h2>
                    <p className="group-member-count">{(groupMembers[currentChat] || []).length} 位成员</p>
                  </div>

                  <div className="detail-section"><div className="section-title">群公告</div><div className="section-content"><p>欢迎加入{getCurrentSession().title}！请遵守群规，文明交流。</p></div></div>
                  <div className="detail-section"><div className="section-title">群主</div><div className="section-content owner-info"><div className="owner-avatar">{getCurrentOwner().charAt(0)}</div><div className="owner-info"><div className="owner-name">{getCurrentOwner()}</div><div className="owner-role">群主</div></div></div></div>
                  <div className="detail-section"><div className="section-title">我在本群的昵称</div><div className="section-content"><div className="my-nickname">{profileData.nickname || '未设置'}<button className="edit-nickname-btn">编辑</button></div></div></div>
                  <div className="detail-section"><div className="section-title">消息免打扰</div><div className="section-content"><label className="toggle-switch-label"><input type="checkbox" className="toggle-checkbox" /><span className="toggle-slider"></span></label></div></div>
                  <div className="detail-section"><div className="section-title">置顶聊天</div><div className="section-content"><label className="toggle-switch-label"><input type="checkbox" className="toggle-checkbox" /><span className="toggle-slider"></span></label></div></div>
                  <div className="detail-section clickable" onClick={handleOpenSearchMessage}><div className="section-title">查找聊天记录</div><div className="section-content"><span className="arrow-icon">›</span></div></div>

                  <div className="detail-section">
                    <div className="section-title">群公告</div>
                    <div className="section-content">
                      {!isEditingAnnouncement ? (
                        <div className="announcement-display">
                          <p className="announcement-text">{groupAnnouncement || '暂无公告'}</p>
                          {(userRole === 'owner' || userRole === 'admin') && <button className="edit-announcement-btn" onClick={handleStartEditAnnouncement}>编辑</button>}
                        </div>
                      ) : (
                        <div className="announcement-edit-form">
                          <textarea value={tempAnnouncement} onChange={(e) => setTempAnnouncement(e.target.value)} placeholder="请输入群公告内容" rows="3" />
                          <div className="announcement-actions">
                            <button className="save-announcement-btn" onClick={handleSaveAnnouncement}>保存</button>
                            <button className="cancel-announcement-btn" onClick={handleCancelEditAnnouncement}>取消</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="detail-section clickable" onClick={handleOpenMemberList}><div className="section-title">成员管理</div><div className="section-content"><span className="arrow-icon">›</span></div></div>
                  <div className="detail-section clickable" onClick={handleOpenInviteMember}><div className="section-title">邀请好友</div><div className="section-content"><span className="arrow-icon">›</span></div></div>

                  {userRole === 'owner' && (
                    <>
                      <div className="detail-section"><div className="section-title">群主操作</div><div className="section-content"><button className="danger-btn" onClick={() => handleTransferGroup(null)}>转让群主</button></div></div>
                      <div className="detail-section"><div className="section-title">危险操作</div><div className="section-content"><button className="danger-btn" onClick={handleDismissGroup}>解散群聊</button></div></div>
                    </>
                  )}

                  {userRole === 'member' && (
                    <div className="detail-section"><div className="section-title">危险操作</div><div className="section-content"><button className="danger-btn" onClick={handleExitGroup}>退出群聊</button></div></div>
                  )}

                  <div className="detail-section">
                    <div className="section-title">成员</div>
                    <div className="section-content members-preview">
                      {groupMembers[currentChat]?.slice(0, 8).map((member, index) => <div key={index} className="member-avatar-small" title={member.name}>{member.avatar}</div>)}
                      <div className="view-all-members">+</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="personal-chat-detail">
                  <div className="personal-info-section">
                    <div className="personal-avatar-large">{getCurrentSession().avatar}</div>
                    <h2 className="personal-name">{getCurrentSession().title}</h2>
                    <p className="personal-status">🟢 在线</p>
                  </div>

                  <div className="detail-section">
                    <div className="section-title">备注</div>
                    <div className="section-content">
                      {!isEditingRemark ? (
                        <div className="remark-input">
                          {(() => {
                            const currentSession = getCurrentSession()
                            const friend = myFriends.find((f) => f.name === currentSession.realName)
                            return friend?.remark || '未设置'
                          })()}
                          <button className="edit-remark-btn" onClick={handleStartEditRemark}>编辑</button>
                        </div>
                      ) : (
                        <div className="remark-edit-form">
                          <input type="text" value={tempRemark} onChange={(e) => setTempRemark(e.target.value)} placeholder="请输入备注" autoFocus />
                          <div className="remark-actions">
                            <button className="save-remark-btn" onClick={handleSaveRemark}>保存</button>
                            <button className="cancel-remark-btn" onClick={handleCancelEditRemark}>取消</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="detail-section"><div className="section-title">标签</div><div className="section-content"><span className="tag-placeholder">未设置标签</span><span className="arrow-icon">›</span></div></div>
                  <div className="detail-section clickable"><div className="section-title">发消息</div><div className="section-content"><span className="arrow-icon">›</span></div></div>
                  <div className="detail-section clickable"><div className="section-title">音视频通话</div><div className="section-content"><span className="arrow-icon">›</span></div></div>
                  <div className="detail-section clickable"><div className="section-title">查找聊天记录</div><div className="section-content"><span className="arrow-icon">›</span></div></div>
                  <div className="detail-section"><div className="section-title">消息免打扰</div><div className="section-content"><label className="toggle-switch-label"><input type="checkbox" className="toggle-checkbox" /><span className="toggle-slider"></span></label></div></div>
                  <div className="detail-section"><div className="section-title">置顶聊天</div><div className="section-content"><label className="toggle-switch-label"><input type="checkbox" className="toggle-checkbox" /><span className="toggle-slider"></span></label></div></div>
                  <div className="detail-section"><div className="section-title">添加到黑名单</div><div className="section-content"><label className="toggle-switch-label"><input type="checkbox" className="toggle-checkbox" /><span className="toggle-slider"></span></label></div></div>
                  <div className="detail-section clickable danger"><div className="section-title">投诉</div><div className="section-content"><span className="arrow-icon">›</span></div></div>
                  <div className="detail-section clickable danger"><div className="section-title">删除好友</div><div className="section-content" onClick={() => handleDeleteFriend(100)}><span className="arrow-icon">›</span></div></div>
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
                <input type="text" className="friend-search-input" placeholder="搜索用户名、昵称或微信号" value={friendSearchQuery} onChange={handleSearchFriend} autoFocus />
              </div>
              {friendSearchQuery && (
                <div className="friend-search-results">
                  {friendSearchResults.length > 0 ? (
                    friendSearchResults.map((user) => {
                      const alreadyFriend = isAlreadyFriend(user.userId, user.name)
                      const sentStatus = getSentRequestStatus(user.userId)
                      const isPending = sentStatus === 'pending'
                      return (
                        <div key={user.userId} className="search-result-item">
                          <div className="result-avatar">{user.avatar}</div>
                          <div className="result-info">
                            <p className="result-name">{user.name}</p>
                            <p className="result-subtitle">微信号：{user.userId}</p>
                          </div>
                          <button
                            className="send-request-btn"
                            onClick={() => handleSendFriendRequest(user.userId)}
                            disabled={alreadyFriend || isPending}
                          >
                            {alreadyFriend ? '已是好友' : isPending ? '待审批' : '添加'}
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

              {friendRequestList.length > 0 && (
                <div className="friend-requests-section">
                  <h4>待我审批 ({friendRequestList.length})</h4>
                  {friendRequestList.map((request) => (
                    <div key={request.id} className="request-item">
                      <div className="request-avatar">{request.avatar}</div>
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
                      <div className="request-avatar">{request.avatar}</div>
                      <div className="request-info">
                        <p className="request-name">{request.name}</p>
                        <p className="request-message">
                          {request.status === 'approved'
                            ? `已通过（${request.approvedAt}）`
                            : `等待对方审批（${request.createdAt}）`}
                        </p>
                      </div>
                      <div className="request-actions">
                        {request.status === 'pending' ? (
                          <button className="accept-btn" onClick={() => handleMockApproveSentRequest(request.id)}>模拟通过</button>
                        ) : (
                          <button className="accept-btn" disabled>已通过</button>
                        )}
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
                      <div className="friend-list-avatar">{friend.avatar}</div>
                      <div className="friend-list-info">
                        <p className="friend-list-name">{friend.name}</p>
                        <p className="friend-list-status">{friend.status === 'online' ? '🟢 在线' : friend.status === 'busy' ? '🔴 忙碌' : friend.status === 'away' ? '🟡 离开' : friend.status === 'invisible' ? '🌙 隐身' : '⚫ 离线'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!friendSearchQuery && friendRequestList.length === 0 && (
                <div className="add-friend-hint"><p>在上方搜索框中输入用户的微信号、昵称或手机号</p></div>
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

      {showMemberListModal && (
        <div className="member-list-overlay" onClick={handleCloseMemberList}>
          <div className="member-list-modal" onClick={(e) => e.stopPropagation()}>
            <div className="member-list-header"><h3>成员管理</h3><button className="close-btn" onClick={handleCloseMemberList}>✕</button></div>
            <div className="member-list-body">
              <div className="member-list-section">
                <h4>群主</h4>
                <div className="member-item">
                  <div className="member-avatar">张</div>
                  <div className="member-info">
                    <p className="member-name">张三</p>
                    <p className="member-role"><span className={`status-dot ${groupMembers[currentChat]?.[0]?.online ? 'online' : 'offline'}`}></span>群主 {groupMembers[currentChat]?.[0]?.online ? '(在线)' : '(离线)'}</p>
                  </div>
                  {userRole === 'owner' && <button className="transfer-btn" onClick={() => handleTransferGroup(null)}>转让</button>}
                </div>
              </div>

              <div className="member-list-section">
                <h4>管理员 ({groupMembers[currentChat]?.filter((m) => m.role === 'admin').length || 0})</h4>
                {groupMembers[currentChat]?.filter((m) => m.role === 'admin').map((member, index) => (
                  <div key={index} className="member-item">
                    <div className="member-avatar">{member.avatar}</div>
                    <div className="member-info">
                      <p className="member-name">{member.name}</p>
                      <p className="member-role"><span className={`status-dot ${member.online ? 'online' : 'offline'}`}></span>管理员 {member.online ? '(在线)' : '(离线)'}</p>
                    </div>
                    {userRole === 'owner' && <button className="remove-btn" onClick={() => handleRemoveMember(member.id)}>移除</button>}
                  </div>
                ))}
              </div>

              <div className="member-list-section">
                <h4>普通成员 ({groupMembers[currentChat]?.filter((m) => m.role === 'member').length || 0})</h4>
                {groupMembers[currentChat]?.filter((m) => m.role === 'member').map((member, index) => (
                  <div key={index} className="member-item">
                    <div className="member-avatar">{member.avatar}</div>
                    <div className="member-info">
                      <p className="member-name">{member.name}</p>
                      <p className="member-role"><span className={`status-dot ${member.online ? 'online' : 'offline'}`}></span>普通成员 {member.online ? '(在线)' : '(离线)'}</p>
                    </div>
                    {(userRole === 'owner' || userRole === 'admin') && <button className="remove-btn" onClick={() => handleRemoveMember(member.id)}>移除</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showInviteMemberModal && (
        <div className="invite-member-overlay" onClick={handleCloseInviteMember}>
          <div className="invite-member-modal" onClick={(e) => e.stopPropagation()}>
            <div className="invite-member-header"><h3>邀请好友</h3><button className="close-btn" onClick={handleCloseInviteMember}>✕</button></div>
            <div className="invite-member-body">
              <p className="invite-hint">选择要邀请的好友（需群主或管理员审核）</p>
              <div className="friend-select-list">
                {myFriends.map((friend) => (
                  <label key={friend.id} className="friend-checkbox">
                    <input type="checkbox" />
                    <div className="friend-avatar-small">{friend.avatar}</div>
                    <span className="friend-name">{friend.remark || friend.name}</span>
                  </label>
                ))}
              </div>
              <button className="send-invite-btn" onClick={() => { alert('邀请已发送，等待群主或管理员审核'); handleCloseInviteMember() }}>发送邀请</button>
            </div>
          </div>
        </div>
      )}

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
                      <div className="friend-checkbox-avatar">{friend.avatar}</div>
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
                      return <div key={id} className="selected-avatar" title={friend?.remark || friend?.name}>{friend?.avatar}</div>
                    })}
                    <div className="selected-avatar self">我</div>
                  </div>
                  <p className="preview-text">共 {selectedFriends.length + 1} 人</p>
                </div>
              )}

              <div className="create-group-actions">
                <button className="cancel-create-btn" onClick={handleCloseCreateGroup}>取消</button>
                <button className="create-group-submit-btn" onClick={handleCreateGroup} disabled={selectedFriends.length === 0 || !groupName.trim()}>
                  创建群聊 ({selectedFriends.length + 1}人)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Overlays
