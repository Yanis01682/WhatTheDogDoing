import { useState, useEffect } from 'react'
import './App.css'
import {
  INITIAL_CUSTOM_GROUPS,
  INITIAL_PROFILE_DATA,
} from './features/chat/mockData'
import {
  addFriend,
  changePassword,
  deleteFriend,
  createGroup,
  getFriendRequests,
  getGroupMembers,
  getCurrentUser,
  getFriends,
  getMessages,
  getSessions,
  login,
  logout,
  register,
  acceptFriendRequest,
  rejectFriendRequest,
  searchUsers,
  sendChatMessage,
  updateStatus
} from './services/api'
import AuthView from './components/stage2/AuthView'
import TopBar from './components/stage2/TopBar'
import SidebarPanel from './components/stage2/SidebarPanel'
import ChatMainView from './components/stage2/ChatMainView'
import Overlays from './components/stage2/Overlays'

const EMPTY_SESSION = {
  id: null,
  title: '暂无会话',
  avatar: '聊',
  lastMessage: '去添加一个真实好友开始聊天吧',
  time: '',
  badge: 0,
  online: 0,
  isGroup: false,
  realName: '暂无会话'
}

function App() {
  // 是否已登录，决定渲染认证视图还是 IM 主界面。
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentChat, setCurrentChat] = useState(null)
  const [messageInput, setMessageInput] = useState('')
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showUserPanel, setShowUserPanel] = useState(false) // 用户面板显示状态
  const [showPeerProfileModal, setShowPeerProfileModal] = useState(false) // 对方详情弹层
  const [peerProfile, setPeerProfile] = useState(null) // 当前查看的对方资料
  const [isNightMode, setIsNightMode] = useState(false) // 夜间模式
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false) // 注销账户二次确认
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false) // 退出登录二次确认
  const [sessionFilter, setSessionFilter] = useState('all') // 会话筛选：all-全部 | personal-个人 | group-群聊
  const [showSearch, setShowSearch] = useState(false) // 搜索框显示/隐藏状态
  const [searchQuery, setSearchQuery] = useState('') // 搜索关键词
  const [chatlistWidth, setChatlistWidth] = useState(320) // 会话列表宽度
  const [isResizing, setIsResizing] = useState(false) // 是否正在调整宽度（左侧）
  const [composerHeight, setComposerHeight] = useState(120) // 输入框高度
  const [isComposingResizing, setIsComposingResizing] = useState(false) // 是否正在调整输入框高度
  const [showEmojiPicker, setShowEmojiPicker] = useState(false) // 表情选择器显示状态
  const [showRegisterForm, setShowRegisterForm] = useState(false) // 注册表单显示状态
  const [contextMenu, setContextMenu] = useState(null) // 右键菜单：{ messageId, x, y, type }
  const [replyToMessage, setReplyToMessage] = useState(null) // 回复的消息：{ id, text, sender }
  const [editingMessageId, setEditingMessageId] = useState(null) // 正在编辑的消息 ID
  const [userAvatar, setUserAvatar] = useState('我') // 用户头像（支持图片或文字）
  const [showProfileModal, setShowProfileModal] = useState(false) // 个人信息模态框
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false) // 修改密码模态框
  const [changePasswordForm, setChangePasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' }) // 修改密码表单
  const [isEditingProfile, setIsEditingProfile] = useState(false) // 是否正在编辑个人信息
  const [userStatus, setUserStatus] = useState('online') // 在线状态：online-在线，offline-离线，busy-忙碌，away-离开，invisible-隐身
  const [showStatusMenu, setShowStatusMenu] = useState(false) // 状态选择菜单
  const [showChatDetail, setShowChatDetail] = useState(false) // 聊天详情模态框
  const [activeTab, setActiveTab] = useState('chats') // 当前激活的标签页：chats-会话，friends-好友
  const [blacklist, setBlacklist] = useState([]) // 黑名单列表
  const [showAddFriendModal, setShowAddFriendModal] = useState(false) // 添加好友模态框
  const [isEditingRemark, setIsEditingRemark] = useState(false) // 是否正在编辑备注
  const [tempRemark, setTempRemark] = useState('') // 临时备注
  const [showSearchMessageModal, setShowSearchMessageModal] = useState(false) // 查找消息模态框
  const [searchMessageQuery, setSearchMessageQuery] = useState('') // 搜索消息关键词
  const [searchResults, setSearchResults] = useState([]) // 搜索结果
  const [currentResultIndex, setCurrentResultIndex] = useState(0) // 当前搜索结果索引
  const [userRole, setUserRole] = useState('member') // 用户在当前群的角色：owner-群主，admin-管理员，member-普通成员
  const [groupAnnouncement, setGroupAnnouncement] = useState('') // 群公告
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false) // 是否正在编辑公告
  const [tempAnnouncement, setTempAnnouncement] = useState('') // 临时公告内容
  const [showMemberListModal, setShowMemberListModal] = useState(false) // 成员列表模态框
  const [showInviteMemberModal, setShowInviteMemberModal] = useState(false) // 邀请成员模态框
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false) // 创建群聊模态框
  const [selectedFriends, setSelectedFriends] = useState([]) // 已选择的好友
  const [groupName, setGroupName] = useState('') // 群聊名称
  const [friendSearchQuery, setFriendSearchQuery] = useState('') // 搜索好友关键词
  const [showFriendSearch, setShowFriendSearch] = useState(false) // 好友搜索框显示/隐藏状态
  const [archivedGroupIds, setArchivedGroupIds] = useState([]) // 手动收纳的群聊 id 列表
  const [friendRequestList, setFriendRequestList] = useState([]) // 收到的好友请求（待我审批）
  const [sentFriendRequests, setSentFriendRequests] = useState([]) // 我发出的好友申请（用于展示审批状态）
  const [myFriends, setMyFriends] = useState([]) // 我的好友列表
  const [collapsedGroups, setCollapsedGroups] = useState([]) // 已折叠的分组
  const [customGroups, setCustomGroups] = useState(INITIAL_CUSTOM_GROUPS) // 自定义分组列表
  const [dynamicSessions, setDynamicSessions] = useState([]) // 动态创建的会话（好友私聊）
  const [groupMembers, setGroupMembers] = useState({}) // 群成员数据（包含角色信息）
  const [profileData, setProfileData] = useState(INITIAL_PROFILE_DATA) // 个人信息数据
  const [pinnedChatIds, setPinnedChatIds] = useState([]) // 置顶聊天 ID 列表
  const [sessions, setSessions] = useState([])
  const [messages, setMessages] = useState({})
  const [friendSearchResults, setFriendSearchResults] = useState([])
  const [currentUserId, setCurrentUserId] = useState(null)

  const syncProfileFromUser = (user) => {
    if (!user) return

    setProfileData((prev) => ({
      ...prev,
      nickname: user.username || prev.nickname,
      email: user.email ?? prev.email
    }))
    setCurrentUserId(user.id ?? null)
  }

  const refreshRealtimeChatData = async (preferredChatId = null) => {
    const [fetchedFriends, fetchedSessions] = await Promise.all([
      getFriends(),
      getSessions()
    ])

    setMyFriends(
      fetchedFriends.map((friend) => ({
        ...friend,
        group: friend.group || customGroups[0] || '我的好友',
        remark: friend.remark || ''
      }))
    )
    setSessions(fetchedSessions)

    setCurrentChat((prev) => {
      const nextChatId = preferredChatId ?? prev
      if (nextChatId && fetchedSessions.some((session) => session.id === nextChatId)) {
        return nextChatId
      }
      return fetchedSessions[0]?.id ?? null
    })
  }

  const refreshFriendRequests = async () => {
    const data = await getFriendRequests()
    setFriendRequestList(data.incoming || [])
    setSentFriendRequests(data.outgoing || [])
  }

  const refreshConversationMessages = async (conversationId) => {
    if (!conversationId || dynamicSessions.some((session) => session.id === conversationId)) {
      return
    }

    const fetchedMessages = await getMessages(conversationId)
    setMessages((prev) => ({
      ...prev,
      [conversationId]: fetchedMessages
    }))
  }

  const refreshGroupConversationMembers = async (conversationId) => {
    if (!conversationId) return

    const fetchedMembers = await getGroupMembers(conversationId)
    setGroupMembers((prev) => ({
      ...prev,
      [conversationId]: fetchedMembers
    }))

    const mine = fetchedMembers.find((member) => member.id === currentUserId)
    if (mine) {
      setUserRole(mine.role)
    }
  }

  // 初始加载时尝试获取用户信息
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (user) {
          syncProfileFromUser(user)
          setIsLoggedIn(true)
          await refreshRealtimeChatData()
          await refreshFriendRequests()
          if (currentChat) {
            await refreshConversationMessages(currentChat)
          }
        }
      } catch (e) {
        // 未登录或错误，保持未登录状态
      }
    }
    checkAuth()
  }, [])

  // 加载保存的头像
  useEffect(() => {
    const savedAvatar = localStorage.getItem('userAvatar')
    if (savedAvatar) {
      setUserAvatar(savedAvatar)
    }
    // 加载保存的个人信息
    const savedProfile = localStorage.getItem('userProfile')
    if (savedProfile) {
      setProfileData(JSON.parse(savedProfile))
    }
    // 加载保存的在线状态
    const savedStatus = localStorage.getItem('userStatus')
    if (savedStatus) {
      setUserStatus(savedStatus)
    }

    const savedArchivedGroupIds = localStorage.getItem('archivedGroupIds')
    if (savedArchivedGroupIds) {
      try {
        const parsed = JSON.parse(savedArchivedGroupIds)
        if (Array.isArray(parsed)) {
          setArchivedGroupIds(parsed)
        }
      } catch (err) {
        console.warn('解析 archivedGroupIds 失败，使用默认值', err)
      }
    }

    // 加载保存的置顶聊天
    const savedPinnedChats = localStorage.getItem('pinnedChatIds')
    if (savedPinnedChats) {
      try {
        const parsed = JSON.parse(savedPinnedChats)
        if (Array.isArray(parsed)) {
          setPinnedChatIds(parsed)
        }
      } catch (err) {
        console.warn('解析 pinnedChatIds 失败，使用默认值', err)
      }
    }

    // 加载保存的黑名单
    const savedBlacklist = localStorage.getItem('blacklist')
    if (savedBlacklist) {
      try {
        const parsed = JSON.parse(savedBlacklist)
        if (Array.isArray(parsed)) {
          setBlacklist(parsed)
        }
      } catch (err) {
        console.warn('解析 blacklist 失败，使用默认值', err)
      }
    }
  }, [])

  useEffect(() => {
    if (!isLoggedIn || !currentChat || dynamicSessions.some((session) => session.id === currentChat)) {
      return
    }

    const loadMessages = async () => {
      try {
        await refreshConversationMessages(currentChat)
      } catch (err) {
        console.error('加载消息失败', err)
      }
    }

    loadMessages()
  }, [currentChat, dynamicSessions, isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn || !currentChat) return

    const session = sessions.find((item) => item.id === currentChat)
    if (!session?.isGroup) return

    const loadGroupMembers = async () => {
      try {
        await refreshGroupConversationMembers(currentChat)
      } catch (err) {
        console.error('加载群成员失败', err)
      }
    }

    loadGroupMembers()
  }, [currentChat, currentUserId, isLoggedIn, sessions])

  useEffect(() => {
    if (!isLoggedIn) return

    const pollSessions = async () => {
      if (document.visibilityState !== 'visible') return

      try {
        await refreshRealtimeChatData(currentChat)
        await refreshFriendRequests()
      } catch (err) {
        console.error('刷新会话失败', err)
      }
    }

    const timerId = window.setInterval(pollSessions, 5000)
    return () => window.clearInterval(timerId)
  }, [currentChat, isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn || !currentChat || dynamicSessions.some((session) => session.id === currentChat)) {
      return
    }

    const pollMessages = async () => {
      if (document.visibilityState !== 'visible') return

      try {
        await refreshConversationMessages(currentChat)
      } catch (err) {
        console.error('刷新消息失败', err)
      }
    }

    const timerId = window.setInterval(pollMessages, 3000)
    return () => window.clearInterval(timerId)
  }, [currentChat, dynamicSessions, isLoggedIn])

  useEffect(() => {
    if (!showAddFriendModal) return

    const loadUsers = async () => {
      const keyword = friendSearchQuery.trim()
      if (!keyword) {
        setFriendSearchResults([])
        return
      }

      try {
        const results = await searchUsers(keyword)
        setFriendSearchResults(results)
      } catch (err) {
        console.error('搜索用户失败', err)
        setFriendSearchResults([])
      }
    }

    loadUsers()
  }, [friendSearchQuery, showAddFriendModal])

  // 持久化手动收纳状态
  useEffect(() => {
    localStorage.setItem('archivedGroupIds', JSON.stringify(archivedGroupIds))
  }, [archivedGroupIds])

  // 持久化置顶聊天状态
  useEffect(() => {
    localStorage.setItem('pinnedChatIds', JSON.stringify(pinnedChatIds))
  }, [pinnedChatIds])

  // 切换聊天置顶状态
  const handleTogglePinChat = (chatId) => {
    setPinnedChatIds(prev => {
      if (prev.includes(chatId)) {
        // 取消置顶
        return prev.filter(id => id !== chatId)
      } else {
        // 添加置顶
        return [chatId, ...prev]
      }
    })
  }

  // 检查聊天是否置顶
  const isChatPinned = (chatId) => {
    return pinnedChatIds.includes(chatId)
  }

  // 持久化黑名单状态
  useEffect(() => {
    localStorage.setItem('blacklist', JSON.stringify(blacklist))
  }, [blacklist])

  // 切换黑名单状态
  const handleToggleBlacklist = (user) => {
    const userId = user.id || user.userId
    setBlacklist(prev => {
      if (prev.find(u => (u.id || u.userId) === userId)) {
        return prev.filter(u => (u.id || u.userId) !== userId)
      } else {
        return [...prev, { ...user, id: userId }]
      }
    })
  }

  // 检查用户是否在黑名单中
  const isUserInBlacklist = (userId) => {
    return blacklist.some(u => (u.id || u.userId) === userId)
  }

  // 移出黑名单
  const handleRemoveFromBlacklist = (userId) => {
    setBlacklist(prev => prev.filter(u => (u.id || u.userId) !== userId))
  }

  // 从黑名单打开私聊会话
  const handleOpenBlacklistChat = (blacklistUser) => {
    const allSessions = [...sessions, ...dynamicSessions]
    const existingSession = allSessions.find(s => s.title === blacklistUser.name)

    if (!existingSession) {
      const newSessionId = sessions.length + dynamicSessions.length
      const newSession = {
        id: newSessionId,
        title: blacklistUser.name,
        avatar: blacklistUser.avatar,
        lastMessage: '黑名单用户',
        time: '刚刚',
        badge: 0,
        online: 0,
        isGroup: false,
        realName: blacklistUser.name,
        isBlacklisted: true // 标记为黑名单用户
      }
      setDynamicSessions(prev => [newSession, ...prev])
      setCurrentChat(newSessionId)
    } else {
      setCurrentChat(existingSession.id)
    }
  }

  // 切换在线状态
  const handleChangeStatus = async (status) => {
    setUserStatus(status)
    localStorage.setItem('userStatus', status)
    setShowStatusMenu(false)
    
    // 调用后端 API 更新数据库中的状态
    try {
      await updateStatus(status)
      // 更新后重新获取好友列表，这样其他用户就能看到新状态
      await refreshRealtimeChatData()
    } catch (error) {
      console.error('更新状态失败:', error)
    }
  }

  // 获取状态文本
  const getStatusText = (status) => {
    const statusMap = {
      'online': '在线',
      'offline': '离线',
      'busy': '忙碌',
      'away': '离开',
      'invisible': '隐身'
    }
    return statusMap[status] || '在线'
  }

  // 获取状态图标
  const getStatusIcon = (status) => {
    if (status === 'invisible') {
      return (
        <svg className="status-icon-svg status-icon-invisible" viewBox="0 0 24 24" width="16" height="16">
          <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
        </svg>
      )
    }
    const iconMap = {
      'online': '🟢',
      'offline': '⚫',
      'busy': '🔴',
      'away': '🟡'
    }
    return iconMap[status] || '🟢'
  }

  // 打开聊天详情
  const handleOpenChatDetail = () => {
    setShowChatDetail(true)
  }

  // 关闭聊天详情
  const handleCloseChatDetail = () => {
    setShowChatDetail(false)
  }

  // 获取当前会话信息
  const getCurrentSession = () => {
    const allSessions = [...dynamicSessions, ...sessions]
    return allSessions.find(s => s.id === currentChat) || allSessions[0] || EMPTY_SESSION
  }

  // 根据被点击的消息，解析对方资料（群聊/私聊）
  const resolvePeerProfileFromMessage = (msg) => {
    if (!msg || msg.sender === 'me' || msg.sender === 'system') return null

    const currentSession = getCurrentSession()

    if (currentSession.isGroup) {
      const members = groupMembers[currentChat] || []
      const candidate =
        members.find((m) => m.id === msg.senderId) ||
        members.find((m) => m.name === msg.senderName) ||
        members.find((m) => m.name !== '我') ||
        members[0]

      const friendByName = myFriends.find((f) => f.name === candidate?.name)
      const userId = friendByName?.accountId || `group_${candidate?.name || 'member'}`
      const email = friendByName?.email || `${candidate?.name || 'member'}@example.com`

      return {
        name: candidate?.name || '群成员',
        userId,
        avatar: candidate?.avatar || currentSession.avatar,
        status: candidate?.online ? 'online' : 'offline',
        email: email,
        wechatId: userId,
        source: 'group'
      }
    }

    const friend = myFriends.find(
      (f) =>
        f.name === currentSession.realName ||
        f.name === currentSession.title ||
        f.remark === currentSession.title
    )

    const userId = friend?.accountId || `private_${currentSession.realName || currentSession.title}`
    const email = friend?.email || `${currentSession.realName || currentSession.title}@example.com`

    return {
      name: friend?.name || currentSession.realName || currentSession.title,
      userId,
      avatar: friend?.avatar || currentSession.avatar,
      status: friend?.status || (currentSession.online > 0 ? 'online' : 'offline'),
      email: email,
      wechatId: userId,
      source: 'private'
    }
  }

  // 点击消息头像，打开对方详情页
  const handleOpenPeerProfile = (msg) => {
    const profile = resolvePeerProfileFromMessage(msg)
    if (!profile) return
    setPeerProfile(profile)
    setShowPeerProfileModal(true)
  }

  // 关闭对方详情页
  const handleClosePeerProfile = () => {
    setShowPeerProfileModal(false)
    setPeerProfile(null)
  }

  // 从聊天详情头像打开对方详情页
  const handleOpenChatDetailPeerProfile = () => {
    const currentSession = getCurrentSession()
    if (!currentSession || currentSession.isGroup) return

    const friend = myFriends.find(
      (f) =>
        f.name === currentSession.realName ||
        f.name === currentSession.title ||
        f.remark === currentSession.title
    )

    const userId = friend?.accountId || `private_${currentSession.realName || currentSession.title}`
    const email = friend?.email || `${currentSession.realName || currentSession.title}@example.com`

    const profile = {
      name: friend?.name || currentSession.realName || currentSession.title,
      userId,
      avatar: friend?.avatar || currentSession.avatar,
      status: friend?.status || (currentSession.online > 0 ? 'online' : 'offline'),
      email: email,
      wechatId: userId,
      source: 'private'
    }

    setPeerProfile(profile)
    setShowPeerProfileModal(true)
    setShowChatDetail(false)
  }

  // 打开添加好友模态框
  const handleOpenAddFriend = () => {
    setShowAddFriendModal(true)
  }

  // 关闭添加好友模态框
  const handleCloseAddFriend = () => {
    setShowAddFriendModal(false)
    setFriendSearchQuery('')
    setFriendSearchResults([])
  }

  // 搜索好友
  const handleSearchFriend = (e) => {
    setFriendSearchQuery(e.target.value)
  }

  // 判断用户是否已是好友，避免重复添加。
  // 兼容 accountId 和 name 两种匹配方式，降低旧数据结构兼容成本。
  const isAlreadyFriend = (userId, name) => {
    return myFriends.some(
      (friend) => friend.accountId === userId || friend.name === name
    )
  }

  // 直接添加真实好友，并立即创建双向好友关系与私聊会话。
  const handleSendFriendRequest = async (userId) => {
    const targetUser = friendSearchResults.find((user) => user.userId === userId)
    if (!targetUser) {
      alert('用户不存在')
      return
    }

    if (isAlreadyFriend(targetUser.userId, targetUser.name)) {
      alert('该用户已经是你的好友')
      return
    }

    try {
      const result = await addFriend(Number(targetUser.accountId))
      await refreshRealtimeChatData(result.conversation_id)
      await refreshFriendRequests()
      setCurrentChat(result.conversation_id)
      setActiveTab('chats')
      setShowAddFriendModal(false)
      alert(`已添加 ${targetUser.name} 为好友`)
    } catch (err) {
      alert(err.response?.data?.detail || '添加好友失败')
    }
  }

  // 删除好友
  const handleDeleteFriend = async (friendId) => {
    const friend = myFriends.find((item) => item.id === friendId)
    if (!friend) {
      alert('好友不存在或已删除')
      return
    }

    if (window.confirm('确定要删除该好友吗？')) {
      const currentSession = [...dynamicSessions, ...sessions].find((session) => session.id === currentChat)
      const isCurrentFriendChat =
        currentSession &&
        !currentSession.isGroup &&
        (
          currentSession.realName === friend.name ||
          currentSession.title === friend.name ||
          currentSession.title === friend.remark
        )

      try {
        await deleteFriend(Number(friend.accountId))
        await refreshRealtimeChatData()
        setSentFriendRequests((prev) =>
          prev.filter((item) => item.userId !== friend.accountId && item.name !== friend.name)
        )
        setBlacklist((prev) =>
          prev.filter((item) => {
            const itemId = item.id || item.userId
            return itemId !== friend.id && itemId !== friend.accountId && item.name !== friend.name
          })
        )
        setDynamicSessions((prev) =>
          prev.filter(
            (session) =>
              session.realName !== friend.name &&
              session.title !== friend.name &&
              session.title !== friend.remark
          )
        )
        if (isCurrentFriendChat) {
          setMessages((prev) => {
            const nextMessages = { ...prev }
            if (currentChat) {
              delete nextMessages[currentChat]
            }
            return nextMessages
          })
          setShowChatDetail(false)
        }
        alert('好友已删除')
      } catch (err) {
        alert(err.response?.data?.detail || '删除好友失败')
      }
    }
  }

  // 接受好友请求：将 incoming 申请转为好友关系并从待审批列表移除。
  const handleAcceptRequest = async (requestId) => {
    try {
      const result = await acceptFriendRequest(requestId)
      await refreshRealtimeChatData(result.conversation_id)
      await refreshFriendRequests()
      alert(`已接受 ${result.friend.name} 的好友请求`)
    } catch (err) {
      alert(err.response?.data?.detail || '接受好友申请失败')
    }
  }

  // 拒绝好友请求：仅移除申请记录，不改动好友列表。
  const handleRejectRequest = async (requestId) => {
    try {
      await rejectFriendRequest(requestId)
      await refreshFriendRequests()
      alert('已拒绝好友请求')
    } catch (err) {
      alert(err.response?.data?.detail || '拒绝好友申请失败')
    }
  }

  // 切换分组折叠状态
  const toggleGroupCollapse = (groupName) => {
    setCollapsedGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    )
  }

  // 移动好友到另一个分组
  const handleMoveFriendToGroup = (friendId, newGroup) => {
    setMyFriends(prev => 
      prev.map(f => f.id === friendId ? { ...f, group: newGroup } : f)
    )
  }

  // 修改好友备注
  const handleUpdateRemark = (friendId, newRemark) => {
    setMyFriends(prev => 
      prev.map(f => f.id === friendId ? { ...f, remark: newRemark } : f)
    )
    alert('备注已保存')
  }

  // 开始编辑备注
  const handleStartEditRemark = () => {
    const currentSession = getCurrentSession()
    const friend = myFriends.find(f => f.name === currentSession.realName || f.id.toString() === currentSession.title)
    setTempRemark(friend?.remark || '')
    setIsEditingRemark(true)
  }

  // 保存备注
  const handleSaveRemark = () => {
    const currentSession = getCurrentSession()
    const friend = myFriends.find(f => f.name === currentSession.realName)
    if (friend) {
      handleUpdateRemark(friend.id, tempRemark)
      setIsEditingRemark(false)
      // 更新动态会话的标题
      setDynamicSessions(prev => 
        prev.map(s => s.id === currentSession.id 
          ? { ...s, title: tempRemark || friend.name } 
          : s
        )
      )
    }
  }

  // 取消编辑备注
  const handleCancelEditRemark = () => {
    setIsEditingRemark(false)
    setTempRemark('')
  }

  // 打开查找消息模态框
  const handleOpenSearchMessage = () => {
    setShowSearchMessageModal(true)
    setSearchMessageQuery('')
    setSearchResults([])
    setCurrentResultIndex(0)
  }

  // 关闭查找消息模态框
  const handleCloseSearchMessage = () => {
    setShowSearchMessageModal(false)
    setSearchMessageQuery('')
    setSearchResults([])
    setCurrentResultIndex(0)
  }

  // 搜索消息
  const handleSearchMessages = (e) => {
    const query = e.target.value
    setSearchMessageQuery(query)
    
    if (!query.trim()) {
      setSearchResults([])
      setCurrentResultIndex(0)
      return
    }
    
    // 在当前聊天中搜索消息
    const currentMessages = messages[currentChat] || []
    const results = currentMessages
      .map((msg, index) => ({
        ...msg,
        index,
        highlighted: (msg.text || '').toLowerCase().includes(query.toLowerCase())
      }))
      .filter(msg => msg.highlighted)
    
    setSearchResults(results)
    setCurrentResultIndex(results.length > 0 ? 0 : -1)
  }

  // 跳转到上一条搜索结果
  const handlePreviousResult = () => {
    if (currentResultIndex > 0) {
      setCurrentResultIndex(currentResultIndex - 1)
    }
  }

  // 跳转到下一条搜索结果
  const handleNextResult = () => {
    if (currentResultIndex < searchResults.length - 1) {
      setCurrentResultIndex(currentResultIndex + 1)
    }
  }

  // 跳转到特定搜索结果
  const handleJumpToMessage = (messageIndex) => {
    // 滚动到指定消息
    setTimeout(() => {
      const messageElement = document.querySelector(`[data-message-index="${messageIndex}"]`)
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        messageElement.classList.add('highlighted-message')
        setTimeout(() => {
          messageElement.classList.remove('highlighted-message')
        }, 2000)
      }
    }, 100)
  }

  // 高亮文本中的关键词
  const highlightText = (text, keyword) => {
    if (!keyword || !keyword.trim()) return text
    const regex = new RegExp(`(${keyword})`, 'gi')
    const parts = text.split(regex)
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === keyword.toLowerCase() 
            ? <mark key={i}>{part}</mark>
            : part
        )}
      </span>
    )
  }

  // 打开成员列表
  const handleOpenMemberList = () => {
    setShowMemberListModal(true)
  }

  // 关闭成员列表
  const handleCloseMemberList = () => {
    setShowMemberListModal(false)
  }

  // 打开邀请成员模态框
  const handleOpenInviteMember = () => {
    setShowInviteMemberModal(true)
  }

  // 关闭邀请成员模态框
  const handleCloseInviteMember = () => {
    setShowInviteMemberModal(false)
  }

  // 打开创建群聊模态框
  const handleOpenCreateGroup = () => {
    setShowCreateGroupModal(true)
    setSelectedFriends([])
    setGroupName('')
  }

  // 关闭创建群聊模态框
  const handleCloseCreateGroup = () => {
    setShowCreateGroupModal(false)
    setSelectedFriends([])
    setGroupName('')
  }

  // 选择/取消选择好友
  const handleToggleSelectFriend = (friendId) => {
    setSelectedFriends(prev => 
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    )
  }

  // 创建群聊
  const handleCreateGroup = async () => {
    if (selectedFriends.length === 0) {
      alert('请至少选择一位好友')
      return
    }
    if (!groupName.trim()) {
      alert('请输入群聊名称')
      return
    }

    try {
      const result = await createGroup(groupName, selectedFriends)
      await refreshRealtimeChatData(result.conversation_id)
      await refreshGroupConversationMembers(result.conversation_id)
      setActiveTab('chats')
      alert(`群聊"${groupName}"创建成功！`)
      handleCloseCreateGroup()
    } catch (err) {
      alert(err.response?.data?.detail || '创建群聊失败')
    }
  }

  // 开始编辑群公告
  const handleStartEditAnnouncement = () => {
    setTempAnnouncement(groupAnnouncement)
    setIsEditingAnnouncement(true)
  }

  // 保存群公告
  const handleSaveAnnouncement = () => {
    setGroupAnnouncement(tempAnnouncement)
    setIsEditingAnnouncement(false)
    alert('群公告已保存')
  }

  // 取消编辑群公告
  const handleCancelEditAnnouncement = () => {
    setIsEditingAnnouncement(false)
    setTempAnnouncement('')
  }

  // 移除群成员
  const handleRemoveMember = (memberId) => {
    if (window.confirm('确定要移除该成员吗？')) {
      alert('成员已移除')
    }
  }

  // 转让群主
  const handleTransferGroup = (memberId) => {
    if (window.confirm('确定要转让群主吗？转让后您将成为普通成员。')) {
      setUserRole('member')
      alert('群主已转让')
    }
  }

  // 退出群聊
  const handleExitGroup = () => {
    if (window.confirm('确定要退出该群吗？')) {
      alert('您已退出群聊')
      handleCloseChatDetail()
    }
  }

  // 解散群聊
  const handleDismissGroup = () => {
    if (window.confirm('确定要解散该群吗？此操作不可恢复！')) {
      alert('群已解散')
      handleCloseChatDetail()
    }
  }
  // 登录处理
      const handleLogin = async (e) => {
    e.preventDefault()
    const account = e.target.account.value
    const password = e.target.password.value
    
    if (account && password) {
      try {
        await login({ username: account, password })
      const user = await getCurrentUser()
      if (user) {
        syncProfileFromUser(user)
        setIsLoggedIn(true)
        await refreshRealtimeChatData()
        await refreshFriendRequests()
      }
      } catch (err) {
        alert(err.message || '登录失败')
      }
    } else {
      alert('请输入账号和密码')
    }
  }

  // 切换表情选择器显示/隐藏
  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker)
  }

  // 关闭表情选择器
  const closeEmojiPicker = () => {
    setShowEmojiPicker(false)
  }

  // 处理表情选择
  const handleEmojiSelect = (emoji) => {
    // 在光标位置插入表情
    const textarea = document.querySelector('.composer-input')
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = messageInput
      const before = text.substring(0, start)
      const after = text.substring(end)
      const newText = before + emoji + after
      setMessageInput(newText)
      
      // 设置光标位置到表情后面
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + emoji.length, start + emoji.length)
      }, 0)
    } else {
      // 如果 textarea 不存在，直接追加到末尾
      setMessageInput(messageInput + emoji)
    }
    closeEmojiPicker()
  }

  // 切换到注册表单
  const showRegisterPage = () => {
    setShowRegisterForm(true)
  }

  // 返回登录页面
  const backToLogin = () => {
    setShowRegisterForm(false)
  }

  // 注册处理
  const handleRegister = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData)
    
    if (!data.username || !data.email || !data.password || !data.confirmPassword) {
      alert('请填写所有必填项')
      return
    }
    if (data.password !== data.confirmPassword) {
      alert('两次输入的密码不一致')
      return
    }
    if (data.agreementAccepted !== 'true') {
      alert('请阅读并同意用户协议和隐私政策')
      return
    }
    
    try {
      await register({ username: data.username, email: data.email, password: data.password })
      await login({ username: data.username, password: data.password })
      const user = await getCurrentUser()
      if (user) {
        syncProfileFromUser(user)
        setIsLoggedIn(true)
        setShowRegisterForm(false)
        await refreshRealtimeChatData()
        await refreshFriendRequests()
      }
    } catch (err) {
      alert(err.message || '注册失败')
    }
  }

  // 右键点击消息
  const handleMessageContextMenu = (e, msg) => {
    e.preventDefault()
    // 只有自己发送的消息才能撤回，其他人的消息可以回复
    const canRevoke = msg.sender === 'me'
    const canReply = msg.sender !== 'system'
    
    if (!canRevoke && !canReply) return
    
    setContextMenu({
      messageId: msg.id,
      messageText: msg.text,
      messageSender: msg.sender,
      x: e.clientX,
      y: e.clientY,
      canRevoke,
      canReply
    })
  }

  // 关闭右键菜单
  const closeContextMenu = () => {
    setContextMenu(null)
  }

  // 撤回消息
  const handleRevokeMessage = () => {
    if (!contextMenu) return
    
    const { messageId } = contextMenu
    
    // 从消息列表中移除
    setMessages(prev => ({
      ...prev,
      [currentChat]: prev[currentChat].filter(msg => msg.id !== messageId)
    }))
    
    closeContextMenu()
    
    // TODO: 调用后端 API 撤回消息
  }

  // 回复消息
  const handleReplyMessage = () => {
    if (!contextMenu) return
    
    const { messageId, messageText, messageSender } = contextMenu
    
    setReplyToMessage({
      id: messageId,
      text: messageText,
      sender: messageSender
    })
    
    closeContextMenu()
    
    // 聚焦到输入框
    setTimeout(() => {
      const textarea = document.querySelector('.composer-input')
      if (textarea) {
        textarea.focus()
      }
    }, 0)
  }

  // 取消回复
  const cancelReply = () => {
    setReplyToMessage(null)
  }

  // 打开个人信息页面
  const handleOpenProfile = () => {
    setShowProfileModal(true)
    setIsEditingProfile(false)
  }

  // 编辑个人信息
  const handleEditProfile = () => {
    setIsEditingProfile(true)
  }

  // 保存个人信息
  const handleSaveProfile = () => {
    // 保存到 localStorage
    localStorage.setItem('userProfile', JSON.stringify(profileData))
    setIsEditingProfile(false)
    alert('个人信息保存成功！')
  }

  // 取消编辑个人信息
  const handleCancelProfile = () => {
    // 重新加载保存的数据
    const savedProfile = localStorage.getItem('userProfile')
    if (savedProfile) {
      setProfileData(JSON.parse(savedProfile))
    }
    setIsEditingProfile(false)
  }

  // 处理个人信息字段变化
  const handleProfileChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 更换头像
  const handleChangeAvatar = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件！')
      return
    }

    // 验证文件大小（限制 2MB）
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过 2MB！')
      return
    }

    // 读取文件并转换为 base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64String = event.target.result
      setUserAvatar(base64String)
      localStorage.setItem('userAvatar', base64String)
      alert('头像更换成功！')
    }
    reader.onerror = () => {
      alert('头像上传失败，请重试！')
    }
    reader.readAsDataURL(file)
  }

  // 编辑消息（用于撤回后的重新编辑）
  const handleEditMessage = () => {
    if (!contextMenu) return
    
    const { messageId, messageText } = contextMenu
    
    setMessageInput(messageText)
    setEditingMessageId(messageId)
    closeContextMenu()
    
    // 聚焦到输入框
    setTimeout(() => {
      const textarea = document.querySelector('.composer-input')
      if (textarea) {
        textarea.focus()
      }
    }, 0)
  }

  // 发送消息
  const handleSendMessage = async () => {
    if (!messageInput.trim()) return

    const activeSession = getCurrentSession()
    const shouldUseBackend =
      activeSession.id &&
      !dynamicSessions.some((session) => session.id === activeSession.id) &&
      !editingMessageId &&
      !replyToMessage

    if (shouldUseBackend) {
      try {
        const result = await sendChatMessage(activeSession.id, messageInput)
        setMessages((prev) => ({
          ...prev,
          [activeSession.id]: [...(prev[activeSession.id] || []), result.message]
        }))
        setSessions((prev) =>
          prev.map((session) =>
            session.id === activeSession.id
              ? {
                  ...session,
                  lastMessage: result.message.text,
                  time: result.message.time
                }
              : session
          )
        )
        setMessageInput('')
        setReplyToMessage(null)
        setEditingMessageId(null)
        return
      } catch (err) {
        alert(err.response?.data?.detail || '发送消息失败')
        return
      }
    }

    const newMessage = {
      id: editingMessageId || Date.now(),
      text: messageInput,
      sender: 'me',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      replyTo: replyToMessage ? {
        id: replyToMessage.id,
        text: replyToMessage.text,
        sender: replyToMessage.sender
      } : null
    }
    
    setMessages(prev => ({
      ...prev,
      [currentChat]: [...(prev[currentChat] || []), newMessage]
    }))
    
    setMessageInput('')
    setReplyToMessage(null)
    setEditingMessageId(null)
  }

  // 发送图片消息（本地预览模式）
  const handleSendImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const newMessage = {
        id: Date.now(),
        type: 'image',
        text: `[图片] ${file.name}`,
        mediaUrl: reader.result,
        mediaName: file.name,
        sender: 'me',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        replyTo: replyToMessage ? {
          id: replyToMessage.id,
          text: replyToMessage.text,
          sender: replyToMessage.sender
        } : null
      }

      setMessages((prev) => ({
        ...prev,
        [currentChat]: [...(prev[currentChat] || []), newMessage]
      }))
      setReplyToMessage(null)
      e.target.value = ''
    }
    reader.readAsDataURL(file)
  }

  // 发送视频消息（本地预览模式）
  const handleSendVideo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      alert('请选择视频文件')
      e.target.value = ''
      return
    }

    const newMessage = {
      id: Date.now(),
      type: 'video',
      text: `[视频] ${file.name}`,
      mediaUrl: URL.createObjectURL(file),
      mediaName: file.name,
      sender: 'me',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      replyTo: replyToMessage ? {
        id: replyToMessage.id,
        text: replyToMessage.text,
        sender: replyToMessage.sender
      } : null
    }

    setMessages((prev) => ({
      ...prev,
      [currentChat]: [...(prev[currentChat] || []), newMessage]
    }))
    setReplyToMessage(null)
    e.target.value = ''
  }

  // 按 Enter 发送消息
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 登出
  const handleLogout = () => {
    setShowLogoutConfirm(true)
  }

  // 确认退出登录
  const confirmLogout = () => {
    logout()
    setIsLoggedIn(false)
    setCurrentChat(null)
    setSessions([])
    setMessages({})
    setMyFriends([])
    setShowUserPanel(false)
    setShowLogoutConfirm(false)
  }

  // 取消退出登录
  const cancelLogout = () => {
    setShowLogoutConfirm(false)
  }

  // 注销账户
  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true)
  }

  // 确认注销账户
  const confirmDeleteAccount = () => {
    // 仅前端实现：清除登录状态和本地数据
    setIsLoggedIn(false)
    setCurrentChat(null)
    setSessions([])
    setMessages({})
    setMyFriends([])
    setShowUserPanel(false)
    setShowDeleteConfirm(false)
    
    // 清除 localStorage 中的 token
    try {
      localStorage.removeItem('auth_token')
    } catch (e) {
      // ignore
    }
    
    alert('账户已成功注销')
  }

  // 取消注销账户
  const cancelDeleteAccount = () => {
    setShowDeleteConfirm(false)
  }

  // 打开修改密码弹窗
  const handleOpenChangePassword = () => {
    setShowChangePasswordModal(true)
    setShowUserPanel(false)
    setChangePasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
  }

  // 关闭修改密码弹窗
  const handleCloseChangePassword = () => {
    setShowChangePasswordModal(false)
    setChangePasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
  }

  // 修改密码表单输入
  const handleChangePasswordInput = (field, value) => {
    setChangePasswordForm(prev => ({ ...prev, [field]: value }))
  }

  // 提交修改密码
  const handleSubmitChangePassword = async () => {
    const { oldPassword, newPassword, confirmPassword } = changePasswordForm

    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('请填写所有密码字段')
      return
    }

    if (newPassword.length < 6) {
      alert('新密码长度不能少于 6 位')
      return
    }

    if (newPassword !== confirmPassword) {
      alert('两次输入的新密码不一致')
      return
    }

    if (oldPassword === newPassword) {
      alert('新密码不能与旧密码相同')
      return
    }

    try {
      await changePassword(oldPassword, newPassword)
      alert('密码修改成功')
      handleCloseChangePassword()
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || '密码修改失败'
      alert(msg)
    }
  }

  // 切换用户面板显示/隐藏
  const toggleUserPanel = () => {
    setShowUserPanel(!showUserPanel)
  }

  // 关闭用户面板
  const closeUserPanel = () => {
    setShowUserPanel(false)
  }

  // 切换夜间模式
  const toggleNightMode = () => {
    setIsNightMode(!isNightMode)
    // TODO: 实际应用中需要保存用户偏好到 localStorage 或数据库
  }

  // 处理搜索输入变化
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
  }

  // 清空搜索
  const handleClearSearch = () => {
    setSearchQuery('')
  }

  // 手动切换群聊收纳状态（右键菜单触发）
  const handleToggleGroupArchive = (sessionId) => {
    setArchivedGroupIds((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    )
  }

  // 开始拖拽左侧会话列表宽度
  const handleResizeStart = (e) => {
    setIsResizing(true)
    e.preventDefault()
  }

  // 处理拖拽左侧会话列表宽度
  const handleResizeMove = (e) => {
    if (!isResizing) return
    
    // 直接使用鼠标的 X 坐标作为宽度
    const newWidth = e.clientX
    // 限制最小和最大宽度
    if (newWidth >= 200 && newWidth <= 600) {
      setChatlistWidth(newWidth)
    }
  }

  // 结束拖拽左侧会话列表宽度
  const handleResizeEnd = () => {
    setIsResizing(false)
  }

  // 开始拖拽输入框高度
  const handleComposerResizeStart = (e) => {
    setIsComposingResizing(true)
    e.preventDefault()
  }

  // 处理拖拽输入框高度
  const handleComposerResizeMove = (e) => {
    if (!isComposingResizing) return
    
    const container = document.querySelector('.composer')
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const newHeight = window.innerHeight - e.clientY
    // 限制最小和最大高度
    if (newHeight >= 80 && newHeight <= 400) {
      setComposerHeight(newHeight)
    }
  }

  // 结束拖拽输入框
  const handleComposerResizeEnd = () => {
    setIsComposingResizing(false)
  }

  // 添加全局鼠标事件监听
  useEffect(() => {
    // 左侧会话列表拖拽
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleResizeMove)
      document.removeEventListener('mouseup', handleResizeEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    
    // 输入框高度拖拽
    if (isComposingResizing) {
      document.addEventListener('mousemove', handleComposerResizeMove)
      document.addEventListener('mouseup', handleComposerResizeEnd)
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleComposerResizeMove)
      document.removeEventListener('mouseup', handleComposerResizeEnd)
      document.body.style.cursor = ''
    }
    
    // 点击其他地方关闭状态菜单
    const handleClickOutside = (e) => {
      if (!e.target.closest('.status-selector') && !e.target.closest('.user-status-selector')) {
        setShowStatusMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    
    return () => {
      document.removeEventListener('mousemove', handleResizeMove)
      document.removeEventListener('mouseup', handleResizeEnd)
      document.removeEventListener('mousemove', handleComposerResizeMove)
      document.removeEventListener('mouseup', handleComposerResizeEnd)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isResizing, isComposingResizing])

  // 点击在线人数
  const handleOnlineClick = () => {
    setShowMemberModal(true)
  }

  // 点击消息列表关闭右键菜单
  const handleMessagesClick = () => {
    closeContextMenu()
  }

  // 关闭成员列表模态框
  const closeMemberModal = () => {
    setShowMemberModal(false)
  }

  // 任命管理员
  const handleMakeAdmin = (memberId) => {
    alert(`已任命成员 ${memberId} 为管理员`)
    // 实际应用中需要调用 API 更新成员角色
  }

  // 从好友列表打开（或创建）私聊会话
  const handleOpenFriendChat = (friend) => {
    const allSessions = [...sessions, ...dynamicSessions]
    const existingSession = allSessions.find(
      (session) =>
        session.title === friend.name ||
        session.realName === friend.name ||
        session.title === friend.remark
    )

    if (!existingSession) {
      alert('该好友的私聊会话还没有创建，请先重新添加好友或刷新页面')
    } else {
      setCurrentChat(existingSession.id)
    }
  }

  // 在“对方详情页”点击发消息
  const handleStartChatWithPeer = () => {
    if (!peerProfile) return

    const allSessions = [...sessions, ...dynamicSessions]
    const existingSession = allSessions.find(
      (s) => s.title === peerProfile.name || s.realName === peerProfile.name
    )

    if (existingSession) {
      setCurrentChat(existingSession.id)
    } else {
      const newSessionId = sessions.length + dynamicSessions.length
      const newSession = {
        id: newSessionId,
        title: peerProfile.name,
        avatar: peerProfile.avatar,
        lastMessage: peerProfile.signature || '开始聊天吧',
        time: '刚刚',
        badge: 0,
        online: peerProfile.status === 'online' ? 1 : 0,
        isGroup: false,
        realName: peerProfile.name
      }
      setDynamicSessions((prev) => [newSession, ...prev])
      setCurrentChat(newSessionId)
    }

    setActiveTab('chats')
    handleClosePeerProfile()
  }

  // 在“对方详情页”点击添加好友
  const handleAddPeerAsFriend = async () => {
    if (!peerProfile) return

    if (isAlreadyFriend(peerProfile.userId, peerProfile.name)) {
      alert('该用户已经是你的好友')
      return
    }

    try {
      const result = await addFriend(Number(peerProfile.userId))
      await refreshRealtimeChatData(result.conversation_id)
      setCurrentChat(result.conversation_id)
      setActiveTab('chats')
      handleClosePeerProfile()
      alert(`已添加 ${peerProfile.name} 为好友`)
    } catch (err) {
      alert(err.response?.data?.detail || '添加好友失败')
    }
  }

  // 获取当前群主
  const getCurrentOwner = () => {
    const members = groupMembers[currentChat] || []
    const owner = members.find(m => m.role === 'owner')
    return owner ? owner.name : '未知'
  }

  const myRole = { [currentChat]: userRole }

  // 未登录时显示登录界面
  if (!isLoggedIn) {
    return (
      <AuthView
        showRegisterForm={showRegisterForm}
        onRegister={handleRegister}
        onLogin={handleLogin}
        onShowRegister={showRegisterPage}
        onBackToLogin={backToLogin}
      />
    )
  }

  // 已登录时显示聊天界面
  return (
    <div className={`im-shell ${isNightMode ? 'night-mode' : ''}`}>
      <TopBar
        showStatusMenu={showStatusMenu}
        setShowStatusMenu={setShowStatusMenu}
        getStatusIcon={getStatusIcon}
        getStatusText={getStatusText}
        userStatus={userStatus}
        handleChangeStatus={handleChangeStatus}
        toggleUserPanel={toggleUserPanel}
        userAvatar={userAvatar}
      />

      <main className="im-layout">
        <SidebarPanel
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          blacklist={blacklist}
          showFriendSearch={showFriendSearch}
          setShowFriendSearch={setShowFriendSearch}
          friendSearchQuery={friendSearchQuery}
          setFriendSearchQuery={setFriendSearchQuery}
          showSearch={showSearch}
          setShowSearch={setShowSearch}
          searchQuery={searchQuery}
          handleSearchChange={handleSearchChange}
          handleClearSearch={handleClearSearch}
          handleOpenAddFriend={handleOpenAddFriend}
          handleOpenCreateGroup={handleOpenCreateGroup}
          sessionFilter={sessionFilter}
          setSessionFilter={setSessionFilter}
          dynamicSessions={dynamicSessions}
          sessions={sessions}
          currentChat={currentChat}
          setCurrentChat={setCurrentChat}
          myFriends={myFriends}
          customGroups={customGroups}
          collapsedGroups={collapsedGroups}
          toggleGroupCollapse={toggleGroupCollapse}
          archivedGroupIds={archivedGroupIds}
          onToggleGroupArchive={handleToggleGroupArchive}
          onOpenFriendChat={handleOpenFriendChat}
          chatlistWidth={chatlistWidth}
          pinnedChatIds={pinnedChatIds}
          onRemoveFromBlacklist={handleRemoveFromBlacklist}
          onOpenBlacklistChat={handleOpenBlacklistChat}
        />

        {/* 左侧会话列表和聊天窗口之间的拖拽分隔线 */}
        <div 
          className={`resize-handle ${isResizing ? 'resizing' : ''}`}
          onMouseDown={handleResizeStart}
        >
        </div>

        <ChatMainView
          getCurrentSession={getCurrentSession}
          groupMembers={groupMembers}
          myFriends={myFriends}
          currentChat={currentChat}
          userAvatar={userAvatar}
          handleOpenPeerProfile={handleOpenPeerProfile}
          handleOpenProfile={handleOpenProfile}
          handleOpenMemberList={handleOpenMemberList}
          handleOpenChatDetail={handleOpenChatDetail}
          handleOpenSearchMessage={handleOpenSearchMessage}
          messages={messages}
          handleMessagesClick={handleMessagesClick}
          handleMessageContextMenu={handleMessageContextMenu}
          composerHeight={composerHeight}
          replyToMessage={replyToMessage}
          cancelReply={cancelReply}
          showEmojiPicker={showEmojiPicker}
          toggleEmojiPicker={toggleEmojiPicker}
          messageInput={messageInput}
          setMessageInput={setMessageInput}
          handleKeyPress={handleKeyPress}
          handleSendMessage={handleSendMessage}
          handleSendImage={handleSendImage}
          handleSendVideo={handleSendVideo}
          isComposingResizing={isComposingResizing}
          handleComposerResizeStart={handleComposerResizeStart}
        />
      </main>

      <Overlays
        showEmojiPicker={showEmojiPicker}
        closeEmojiPicker={closeEmojiPicker}
        handleEmojiSelect={handleEmojiSelect}
        contextMenu={contextMenu}
        closeContextMenu={closeContextMenu}
        handleReplyMessage={handleReplyMessage}
        handleEditMessage={handleEditMessage}
        handleRevokeMessage={handleRevokeMessage}
        showMemberModal={showMemberModal}
        closeMemberModal={closeMemberModal}
        sessions={sessions}
        currentChat={currentChat}
        getCurrentOwner={getCurrentOwner}
        myRole={myRole}
        groupMembers={groupMembers}
        handleMakeAdmin={handleMakeAdmin}
        handleRemoveMember={handleRemoveMember}
        showUserPanel={showUserPanel}
        closeUserPanel={closeUserPanel}
        userAvatar={userAvatar}
        profileData={profileData}
        showStatusMenu={showStatusMenu}
        setShowStatusMenu={setShowStatusMenu}
        getStatusIcon={getStatusIcon}
        getStatusText={getStatusText}
        userStatus={userStatus}
        handleOpenProfile={handleOpenProfile}
        toggleNightMode={toggleNightMode}
        isNightMode={isNightMode}
        handleLogout={handleLogout}
        handleDeleteAccount={handleDeleteAccount}
        showLogoutConfirm={showLogoutConfirm}
        confirmLogout={confirmLogout}
        cancelLogout={cancelLogout}
        showProfileModal={showProfileModal}
        setShowProfileModal={setShowProfileModal}
        handleOpenChangePassword={handleOpenChangePassword}
        showChangePasswordModal={showChangePasswordModal}
        handleCloseChangePassword={handleCloseChangePassword}
        changePasswordForm={changePasswordForm}
        handleChangePasswordInput={handleChangePasswordInput}
        handleSubmitChangePassword={handleSubmitChangePassword}
        showPeerProfileModal={showPeerProfileModal}
        peerProfile={peerProfile}
        handleClosePeerProfile={handleClosePeerProfile}
        handleStartChatWithPeer={handleStartChatWithPeer}
        handleAddPeerAsFriend={handleAddPeerAsFriend}
        isEditingProfile={isEditingProfile}
        handleEditProfile={handleEditProfile}
        handleProfileChange={handleProfileChange}
        handleCancelProfile={handleCancelProfile}
        handleSaveProfile={handleSaveProfile}
        handleChangeAvatar={handleChangeAvatar}
        showChatDetail={showChatDetail}
        handleCloseChatDetail={handleCloseChatDetail}
        getCurrentSession={getCurrentSession}
        handleOpenChatDetailPeerProfile={handleOpenChatDetailPeerProfile}
        handleOpenSearchMessage={handleOpenSearchMessage}
        isEditingAnnouncement={isEditingAnnouncement}
        groupAnnouncement={groupAnnouncement}
        userRole={userRole}
        handleStartEditAnnouncement={handleStartEditAnnouncement}
        tempAnnouncement={tempAnnouncement}
        setTempAnnouncement={setTempAnnouncement}
        handleSaveAnnouncement={handleSaveAnnouncement}
        handleCancelEditAnnouncement={handleCancelEditAnnouncement}
        handleOpenMemberList={handleOpenMemberList}
        handleOpenInviteMember={handleOpenInviteMember}
        handleTogglePinChat={handleTogglePinChat}
        isChatPinned={isChatPinned}
        handleToggleBlacklist={handleToggleBlacklist}
        isUserInBlacklist={isUserInBlacklist}
        handleTransferGroup={handleTransferGroup}
        handleDismissGroup={handleDismissGroup}
        handleExitGroup={handleExitGroup}
        showDeleteConfirm={showDeleteConfirm}
        cancelDeleteAccount={cancelDeleteAccount}
        confirmDeleteAccount={confirmDeleteAccount}
        isEditingRemark={isEditingRemark}
        tempRemark={tempRemark}
        setTempRemark={setTempRemark}
        myFriends={myFriends}
        handleStartEditRemark={handleStartEditRemark}
        handleSaveRemark={handleSaveRemark}
        handleCancelEditRemark={handleCancelEditRemark}
        handleDeleteFriend={handleDeleteFriend}
        showAddFriendModal={showAddFriendModal}
        handleCloseAddFriend={handleCloseAddFriend}
        friendSearchQuery={friendSearchQuery}
        handleSearchFriend={handleSearchFriend}
        friendSearchResults={friendSearchResults}
        isAlreadyFriend={isAlreadyFriend}
        handleSendFriendRequest={handleSendFriendRequest}
        friendRequestList={friendRequestList}
        sentFriendRequests={sentFriendRequests}
        handleAcceptRequest={handleAcceptRequest}
        handleRejectRequest={handleRejectRequest}
        showSearchMessageModal={showSearchMessageModal}
        handleCloseSearchMessage={handleCloseSearchMessage}
        searchMessageQuery={searchMessageQuery}
        handleSearchMessages={handleSearchMessages}
        searchResults={searchResults}
        handlePreviousResult={handlePreviousResult}
        currentResultIndex={currentResultIndex}
        handleNextResult={handleNextResult}
        setCurrentResultIndex={setCurrentResultIndex}
        handleJumpToMessage={handleJumpToMessage}
        highlightText={highlightText}
        showMemberListModal={showMemberListModal}
        handleCloseMemberList={handleCloseMemberList}
        showInviteMemberModal={showInviteMemberModal}
        handleCloseInviteMember={handleCloseInviteMember}
        showCreateGroupModal={showCreateGroupModal}
        handleCloseCreateGroup={handleCloseCreateGroup}
        groupName={groupName}
        setGroupName={setGroupName}
        selectedFriends={selectedFriends}
        handleToggleSelectFriend={handleToggleSelectFriend}
        handleCreateGroup={handleCreateGroup}
      />
    </div>
  )
}

export default App
