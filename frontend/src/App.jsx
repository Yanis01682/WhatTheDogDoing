import { useState, useEffect } from 'react'
import './App.css'
import {
  INITIAL_CUSTOM_GROUPS,
  INITIAL_PROFILE_DATA,
} from './features/chat/mockData'
import {
  sendFriendRequest,
  changePassword,
  deleteFriend,
  deleteMyAccount,
  createGroup,
  exitGroup,
  dismissGroup,
  inviteGroupMembers,
  createGroupInviteRequest,
  getGroupInviteRequests,
  approveGroupInviteRequest,
  rejectGroupInviteRequest,
  getGroupAnnouncements,
  publishGroupAnnouncement,
  renameGroup,
  getFriendRequests,
  getGroupMembers,
  getCurrentUser,
  getFriends,
  getMessages,
  getSessions,
  pinChatSession,
  login,
  logout,
  register,
  acceptFriendRequest,
  rejectFriendRequest,
  searchUsers,
  sendChatMessage,
  sendImageMessage,
  sendVideoMessage,
  unpinChatSession,
  revokeMessage,
  getProfile,
  updateProfile,
  updateSensitiveInfo,
  updateFriendRemark,
  updateFriendGroup,
  transferGroupOwnership,
  kickGroupMember,
  setGroupAdmin,
  updateGroupNickname,
  updateSessionMute,
} from './services/api'
import AuthView from './components/stage2/AuthView'
import LeftNav from './components/stage2/LeftNav'
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

const DEFAULT_FRIEND_GROUP = '我的好友'

const createHistoryFilters = () => ({
  sender: 'all',
  type: 'all',
  startAt: '',
  endAt: '',
})

const formatLocalMessageTime = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}年${month}月${day}日 ${hours}:${minutes}`
}

const parseMessageDate = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const matchesDateRange = (message, startAt, endAt) => {
  const date = parseMessageDate(message.timestamp)
  if (!date) return false

  if (startAt) {
    const startDate = parseMessageDate(startAt)
    if (startDate && date < startDate) {
      return false
    }
  }

  if (endAt) {
    const endDate = parseMessageDate(endAt)
    if (endDate && date > endDate) {
      return false
    }
  }

  return true
}

const normalizeMessageText = (message) => (
  [
    message.text,
    message.replyTo?.text,
    message.senderName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
)

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
  const [searchQuery, setSearchQuery] = useState('') // 搜索关键词
  const [chatlistWidth] = useState(320) // 会话列表宽度（固定，不再支持拖拽）
  const [composerHeight, setComposerHeight] = useState(120) // 输入框高度
  const [isComposingResizing, setIsComposingResizing] = useState(false) // 是否正在调整输入框高度
  const [lightboxImage, setLightboxImage] = useState(null) // 图片查看灯箱：{ url, name }
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
  const [showSensitiveInfoModal, setShowSensitiveInfoModal] = useState(false) // 敏感信息修改模态框
  const [sensitiveInfoForm, setSensitiveInfoForm] = useState({ 
    password: '', 
    newEmail: '', 
    newPhone: '', 
    newPassword: '',
    confirmPassword: ''
  }) // 敏感信息修改表单

  const [showChatDetail, setShowChatDetail] = useState(false) // 聊天详情模态框
  const [activeTab, setActiveTab] = useState('chats') // 当前激活的标签页：chats-会话，friends-好友
  const [blacklist, setBlacklist] = useState([]) // 黑名单列表
  const [showAddFriendModal, setShowAddFriendModal] = useState(false) // 添加好友模态框
  const [isEditingRemark, setIsEditingRemark] = useState(false) // 是否正在编辑备注
  const [tempRemark, setTempRemark] = useState('') // 临时备注
  const [isEditingFriendGroup, setIsEditingFriendGroup] = useState(false)
  const [tempFriendGroup, setTempFriendGroup] = useState(DEFAULT_FRIEND_GROUP)
  const [newFriendGroupName, setNewFriendGroupName] = useState('')
  const [showSearchMessageModal, setShowSearchMessageModal] = useState(false) // 聊天记录模态框
  const [searchMessageQuery, setSearchMessageQuery] = useState('') // 搜索消息关键词
  const [searchResults, setSearchResults] = useState([]) // 搜索结果
  const [currentResultIndex, setCurrentResultIndex] = useState(0) // 当前搜索结果索引
  const [messageHistoryFilters, setMessageHistoryFilters] = useState(createHistoryFilters)
  const [userRole, setUserRole] = useState('member') // 用户在当前群的角色：owner-群主，admin-管理员，member-普通成员
  const [groupAnnouncement, setGroupAnnouncement] = useState('') // 群公告
  const [groupAnnouncementHistory, setGroupAnnouncementHistory] = useState([])
  const [showAnnouncementHistoryModal, setShowAnnouncementHistoryModal] = useState(false)
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false) // 是否正在编辑公告
  const [tempAnnouncement, setTempAnnouncement] = useState('') // 临时公告内容
  const [isEditingGroupName, setIsEditingGroupName] = useState(false)
  const [tempGroupName, setTempGroupName] = useState('')
  const [isEditingGroupNickname, setIsEditingGroupNickname] = useState(false)
  const [tempGroupNickname, setTempGroupNickname] = useState('')
  const [isRenamingGroup, setIsRenamingGroup] = useState(false)
  const [groupOwnerIdMap, setGroupOwnerIdMap] = useState({})
  const [groupOwnerNameMap, setGroupOwnerNameMap] = useState({})
  const [showMemberListModal, setShowMemberListModal] = useState(false) // 成员列表模态框
  const [showInviteMemberModal, setShowInviteMemberModal] = useState(false) // 邀请成员模态框
  const [selectedInviteFriends, setSelectedInviteFriends] = useState([]) // 已选择邀请的好友
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false) // 创建群聊模态框
  const [selectedFriends, setSelectedFriends] = useState([]) // 已选择的好友
  const [groupName, setGroupName] = useState('') // 群聊名称
  const [friendSearchQuery, setFriendSearchQuery] = useState('') // 搜索好友关键词
  const [showFriendSearch, setShowFriendSearch] = useState(false) // 好友搜索框显示/隐藏状态
  const [archivedGroupIds, setArchivedGroupIds] = useState([]) // 手动收纳的群聊 id 列表
  const [friendRequestList, setFriendRequestList] = useState([]) // 收到的好友请求（待我审批）
  const [sentFriendRequests, setSentFriendRequests] = useState([]) // 我发出的好友申请（用于展示审批状态）
  const [groupInviteRequests, setGroupInviteRequests] = useState([])
  const [myFriends, setMyFriends] = useState([]) // 我的好友列表
  const [collapsedGroups, setCollapsedGroups] = useState([]) // 已折叠的分组
  const [_customGroups, _setCustomGroups] = useState(INITIAL_CUSTOM_GROUPS) // 自定义分组列表
  const [dynamicSessions, setDynamicSessions] = useState([]) // 动态创建的会话（好友私聊）
  const [groupMembers, setGroupMembers] = useState({}) // 群成员数据（包含角色信息）
  const [profileData, setProfileData] = useState(INITIAL_PROFILE_DATA) // 个人信息数据
  const [pinnedChatIds, setPinnedChatIds] = useState([]) // 置顶聊天 ID 列表
  const [sessions, setSessions] = useState([])
  const [messages, setMessages] = useState({})
  const [friendSearchResults, setFriendSearchResults] = useState([])
  const [currentUserId, setCurrentUserId] = useState(null)
  const [jumpToMessageId, setJumpToMessageId] = useState(null)

  const mergeFriendGroups = (groups = []) => {
    const merged = [DEFAULT_FRIEND_GROUP, ...INITIAL_CUSTOM_GROUPS.filter((group) => group !== DEFAULT_FRIEND_GROUP)]
    groups.forEach((groupName) => {
      const trimmed = (groupName || '').trim()
      if (trimmed && !merged.includes(trimmed)) {
        merged.push(trimmed)
      }
    })
    return merged
  }

  const getScopedStorageKey = (baseKey) => `${baseKey}:${currentUserId || 'guest'}`

  const getLocalHistoryStore = (baseKey) => {
    try {
      return JSON.parse(localStorage.getItem(getScopedStorageKey(baseKey)) || '{}')
    } catch {
      return {}
    }
  }

  const setLocalHistoryStore = (baseKey, value) => {
    try {
      localStorage.setItem(getScopedStorageKey(baseKey), JSON.stringify(value))
    } catch {
      // ignore
    }
  }

  const syncProfileFromUser = async (user) => {
    if (!user) return
    setCurrentUserId(user.id ?? null)
    // (status removed)
    try {
      const profile = await getProfile()
      const resolvedAvatar =
        profile.avatar || (profile.nickname || user.username || '我').slice(0, 1).toUpperCase()
      setProfileData({
        id: user.id ?? null,
        username: user.username || '',
        nickname: profile.nickname || '',
        email: profile.email || user.email || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        gender: profile.gender || 'male',
        avatar: profile.avatar || '',
      })
      setUserAvatar(resolvedAvatar)
    } catch {
      const fallbackAvatar = (user.username || '我').slice(0, 1).toUpperCase()
      setProfileData((prev) => ({
        ...prev,
        id: user.id ?? prev.id ?? null,
        username: user.username || '',
        nickname: prev.nickname || '',
        email: user.email ?? prev.email ?? '',
      }))
      setUserAvatar(fallbackAvatar)
    }
  }

  const refreshRealtimeChatData = async (preferredChatId = null) => {
    const [fetchedFriends, fetchedSessions] = await Promise.all([
      getFriends(),
      getSessions()
    ])

    const mergedGroups = mergeFriendGroups(fetchedFriends.map((friend) => friend.group))
    _setCustomGroups(mergedGroups)

    const mappedFriends = fetchedFriends.map((friend) => ({
      ...friend,
      group: friend.group || mergedGroups[0] || DEFAULT_FRIEND_GROUP,
      remark: friend.remark || ''
    }))
    setMyFriends(mappedFriends)
    
    const mappedSessions = fetchedSessions.map(session => {
      let nextSession = session
      if (!session.isGroup) {
        const friend = mappedFriends.find(
          (f) =>
            (session.peerUserId != null && String(f.accountId) === String(session.peerUserId)) ||
            f.name === session.realName ||
            f.id === session.id ||
            f.id?.toString() === session.title
        )
        if (friend && friend.remark) {
          nextSession = { ...session, title: friend.remark }
        }
      }
      return applyLocalSessionPreview(nextSession)
    })
    setSessions(mappedSessions)
    setPinnedChatIds((prev) => {
      const localPinnedDynamicIds = prev.filter((id) => dynamicSessions.some((session) => session.id === id))
      const serverPinnedIds = fetchedSessions.filter((session) => session.isPinned).map((session) => session.id)
      return [...localPinnedDynamicIds, ...serverPinnedIds.filter((id) => !localPinnedDynamicIds.includes(id))]
    })

    setCurrentChat((prev) => {
      const nextChatId = preferredChatId ?? prev
      if (nextChatId && fetchedSessions.some((session) => session.id === nextChatId)) {
        return nextChatId
      }
      return null
    })
  }

  const refreshFriendRequests = async () => {
    const [data, inviteRequests] = await Promise.all([
      getFriendRequests(),
      getGroupInviteRequests().catch(() => []),
    ])
    setFriendRequestList(data.incoming || [])
    setSentFriendRequests(data.outgoing || [])
    setGroupInviteRequests(inviteRequests || [])
  }

  const refreshConversationMessages = async (conversationId) => {
    if (!conversationId || dynamicSessions.some((session) => session.id === conversationId)) {
      return
    }

    const fetchedMessages = await getMessages(conversationId)
    console.log('[刷新消息] 获取到的消息数量:', fetchedMessages.length)
    if (fetchedMessages.length > 0) {
      const lastMsg = fetchedMessages[fetchedMessages.length - 1]
      console.log('[刷新消息] 最后一条消息:', { id: lastMsg.id, type: lastMsg.type, text: lastMsg.text?.substring(0, 20), mediaUrl: lastMsg.mediaUrl })
    }
    
    const withMarkedReplies = applyLocalMessageFilters(conversationId, fetchedMessages)
    setMessages((prev) => ({
      ...prev,
      [conversationId]: withMarkedReplies
    }))
    setSessions((prev) =>
      prev.map((session) =>
        session.id === conversationId
          ? { ...session, badge: 0 }
          : session
      )
    )
  }

  const refreshGroupConversationMembers = async (conversationId) => {
    if (!conversationId) return

    const fetchedMembers = await getGroupMembers(conversationId)
    setGroupMembers((prev) => ({
      ...prev,
      [conversationId]: fetchedMembers
    }))

    const owner = fetchedMembers.find((member) => member.role === 'owner')
    setGroupOwnerIdMap((prev) => ({
      ...prev,
      [conversationId]: owner?.id ?? null,
    }))
    setGroupOwnerNameMap((prev) => ({
      ...prev,
      [conversationId]: owner?.name ?? '',
    }))

    const mine = fetchedMembers.find((member) => member.id === currentUserId)
    if (mine) {
      setUserRole(mine.role)
    }
  }

  // 初始加载时尝试获取用户信息
  // ===== 本地删除消息持久化 =====
  const getLocallyDeleted = (convId) => {
    const data = getLocalHistoryStore('wtdd_deleted_msgs')
    return new Set(data[String(convId)] || [])
  }
  const addLocallyDeleted = (convId, msgId) => {
    const data = getLocalHistoryStore('wtdd_deleted_msgs')
    const ids = new Set(data[String(convId)] || [])
    ids.add(msgId)
    data[String(convId)] = [...ids]
    setLocalHistoryStore('wtdd_deleted_msgs', data)
  }
  const getLocalClearBeforeId = (convId) => {
    const data = getLocalHistoryStore('wtdd_cleared_conversations')
    return Number(data[String(convId)] || 0)
  }
  const setLocalClearBeforeId = (convId, messageId) => {
    const data = getLocalHistoryStore('wtdd_cleared_conversations')
    data[String(convId)] = Number(messageId || 0)
    setLocalHistoryStore('wtdd_cleared_conversations', data)
  }
  const getSessionPreviewText = (message) => {
    if (!message) return '暂无消息'
    if (message.type === 'image') return '[图片]'
    if (message.type === 'video') return '[视频]'
    return message.text || '暂无消息'
  }
  const applyLocalSessionPreview = (session) => {
    const cachedMessages = messages[session.id]
    if (!cachedMessages) {
      return session
    }
    if (cachedMessages.length === 0 && getLocalClearBeforeId(session.id) > 0) {
      return {
        ...session,
        lastMessage: '暂无消息',
        time: '',
        badge: 0,
      }
    }

    const latestVisibleMessage = cachedMessages[cachedMessages.length - 1]
    if (!latestVisibleMessage) {
      return session
    }

    return {
      ...session,
      lastMessage: getSessionPreviewText(latestVisibleMessage),
      time: latestVisibleMessage.time || session.time,
      timestamp: latestVisibleMessage.timestamp || session.timestamp,
    }
  }
  const applyLocalMessageFilters = (convId, rawMessages) => {
    const locallyDeleted = getLocallyDeleted(convId)
    const clearBeforeId = getLocalClearBeforeId(convId)
    const visibleMessages = rawMessages.filter(
      (message) => message.id > clearBeforeId && !locallyDeleted.has(message.id)
    )

    return visibleMessages.map((message) => {
      if (!message.replyTo) {
        return message
      }
      if (message.replyTo.id <= clearBeforeId || locallyDeleted.has(message.replyTo.id)) {
        return {
          ...message,
          replyTo: {
            ...message.replyTo,
            deleted: true,
            deletedLabel: message.replyTo.id <= clearBeforeId ? '该消息已清空' : '该消息已删除',
          },
        }
      }
      return message
    })
  }
  const markReplyToDeleted = (convId, deletedMsgId, label) => {
    setMessages(prev => {
      const conv = prev[convId] || []
      const updated = conv.map(m =>
        m.replyTo?.id === deletedMsgId ? { ...m, replyTo: { ...m.replyTo, deleted: true, deletedLabel: label } } : m
      )
      return { ...prev, [convId]: updated }
    })
  }

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (user) {
          await syncProfileFromUser(user)
          setIsLoggedIn(true)
          await refreshRealtimeChatData()
          await refreshFriendRequests()
          if (currentChat) {
            await refreshConversationMessages(currentChat)
          }
        }
      } catch {
        // 未登录或错误，保持未登录状态
      }
    }
    checkAuth()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentUserId) return

    const savedArchivedGroupIds = localStorage.getItem(getScopedStorageKey('archivedGroupIds'))
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

    // 加载保存的黑名单
    const savedBlacklist = localStorage.getItem(getScopedStorageKey('blacklist'))
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
  }, [currentUserId])

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
  }, [currentChat, dynamicSessions, isLoggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [currentChat, currentUserId, isLoggedIn, sessions]) // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [currentChat, isLoggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [currentChat, dynamicSessions, isLoggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showSearchMessageModal) return
    const results = getFilteredHistoryMessages(searchMessageQuery, messageHistoryFilters)
    setSearchResults(results)
    setCurrentResultIndex(results.length > 0 ? Math.min(currentResultIndex, results.length - 1) : -1)
  }, [showSearchMessageModal, searchMessageQuery, messageHistoryFilters, messages, currentChat]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!currentUserId) return
    localStorage.setItem(getScopedStorageKey('archivedGroupIds'), JSON.stringify(archivedGroupIds))
  }, [archivedGroupIds, currentUserId])

  // 切换聊天置顶状态
  const handleTogglePinChat = async (chatId) => {
    const isDynamicSession = dynamicSessions.some((session) => session.id === chatId)
    if (isDynamicSession) {
      setPinnedChatIds((prev) => (
        prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [chatId, ...prev]
      ))
      return
    }

    const targetSession = sessions.find((session) => session.id === chatId)
    if (!targetSession) return

    try {
      if (targetSession.isPinned) {
        await unpinChatSession(chatId)
      } else {
        await pinChatSession(chatId)
      }

      setSessions((prev) => prev.map((session) => (
        session.id === chatId ? { ...session, isPinned: !session.isPinned } : session
      )))
      setPinnedChatIds((prev) => (
        targetSession.isPinned
          ? prev.filter((id) => id !== chatId)
          : [chatId, ...prev.filter((id) => id !== chatId)]
      ))
    } catch (err) {
      alert(err.response?.data?.detail || '更新置顶状态失败')
    }
  }

  const handleToggleSessionMute = async (chatId) => {
    const targetSession = sessions.find((session) => session.id === chatId)
    if (!targetSession) return

    try {
      const result = await updateSessionMute(chatId, !targetSession.isMuted)
      setSessions((prev) => prev.map((session) => (
        session.id === chatId
          ? { ...session, isMuted: result.isMuted, badge: result.isMuted ? 0 : session.badge }
          : session
      )))
    } catch (err) {
      alert(err.response?.data?.detail || '更新免打扰失败')
    }
  }

  // 检查聊天是否置顶
  const isChatPinned = (chatId) => {
    return pinnedChatIds.includes(chatId) || sessions.some((session) => session.id === chatId && session.isPinned)
  }

  const isSessionMuted = (chatId) => sessions.some((session) => session.id === chatId && session.isMuted)

  // 持久化黑名单状态
  useEffect(() => {
    if (!currentUserId) return
    localStorage.setItem(getScopedStorageKey('blacklist'), JSON.stringify(blacklist))
  }, [blacklist, currentUserId])

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
        time: formatLocalMessageTime(),
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



  // 打开聊天详情
  const handleOpenChatDetail = () => {
    const currentSession = getCurrentSession()
    if (currentSession?.isGroup) {
      setTempGroupName(currentSession.title || '')
      setIsEditingGroupName(false)
      getGroupAnnouncements(currentSession.id)
        .then((items) => {
          setGroupAnnouncementHistory(items)
          setGroupAnnouncement(items[0]?.content || '')
        })
        .catch(() => {
          setGroupAnnouncementHistory([])
          setGroupAnnouncement('')
        })
    }
    setIsEditingFriendGroup(false)
    setNewFriendGroupName('')
    setShowChatDetail(true)
  }

  // 关闭聊天详情
  const handleCloseChatDetail = () => {
    setShowChatDetail(false)
    setIsEditingGroupName(false)
    setIsEditingFriendGroup(false)
    setTempFriendGroup(DEFAULT_FRIEND_GROUP)
    setNewFriendGroupName('')
    setTempGroupName('')
    setShowAnnouncementHistoryModal(false)
  }

  // 获取当前会话信息
  const getCurrentSession = () => {
    const allSessions = [...dynamicSessions, ...sessions]
    return allSessions.find(s => s.id === currentChat) || EMPTY_SESSION
  }

  const findFriendForSession = (session) => {
    if (!session || session.isGroup) return null
    const peerUserId = session.peerUserId != null ? String(session.peerUserId) : null
    return (
      myFriends.find((friend) => peerUserId && String(friend.accountId) === peerUserId) ||
      myFriends.find(
        (friend) =>
          friend.name === session.realName ||
          friend.name === session.title ||
          friend.remark === session.title
      ) ||
      null
    )
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

      // 使用真实用户 ID
      const userId = candidate?.id || null
      const friendById = userId ? myFriends.find((f) => String(f.accountId) === String(userId)) : null
      const friendByName = myFriends.find((f) => f.name === candidate?.name)
      const friend = friendById || friendByName
      const email = friend?.email || `${candidate?.name || 'member'}@example.com`
      const displayName = candidate?.displayName || friend?.remark || friend?.name || candidate?.name || '群成员'

      return {
        name: displayName,
        userId: userId ? String(userId) : `group_${candidate?.name || 'member'}`,
        avatar: candidate?.avatar || currentSession.avatar,
        status: candidate?.online ? 'online' : 'offline',
        email: email,
        wechatId: userId ? String(userId) : `group_${candidate?.name || 'member'}`,
        source: 'group'
      }
    }

    const friend = findFriendForSession(currentSession)

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

  // 点击群主头像打开群主详情页
  const handleOpenOwnerProfile = () => {
    const members = groupMembers[currentChat] || []
    const owner = members.find(m => m.role === 'owner')
    if (!owner) return

    // 使用真实用户 ID
    const userId = owner.id || null
    const friendById = userId ? myFriends.find((f) => String(f.accountId) === String(userId)) : null
    const friendByName = myFriends.find((f) => f.name === owner.name)
    const friend = friendById || friendByName
    const email = friend?.email || `${owner.name}@example.com`

    const profile = {
      name: owner.displayName || owner.name,
      userId: userId ? String(userId) : `group_${owner.name}`,
      avatar: owner.avatar,
      status: owner.online ? 'online' : 'offline',
      email: email,
      wechatId: userId ? String(userId) : `group_${owner.name}`,
      source: 'group'
    }
    setPeerProfile(profile)
    setShowPeerProfileModal(true)
  }

  // 点击群成员头像打开成员详情页
  const handleOpenMemberProfile = (member) => {
    if (!member) return

    // member.id 就是真实的用户 ID
    const userId = member.id || `group_${member.name}`
    const friendById = myFriends.find((f) => String(f.accountId) === String(userId))
    const friendByName = myFriends.find((f) => f.name === member.name)
    const friend = friendById || friendByName
    const email = friend?.email || `${member.name}@example.com`

    const profile = {
      name: member.displayName || member.name,
      userId: String(userId),
      avatar: member.avatar,
      status: member.online ? 'online' : 'offline',
      email: email,
      wechatId: String(userId),
      source: 'group'
    }
    setPeerProfile(profile)
    setShowPeerProfileModal(true)
  }

  // 从聊天详情头像打开对方详情页
  const handleOpenChatDetailPeerProfile = () => {
    const currentSession = getCurrentSession()
    if (!currentSession || currentSession.isGroup) return

    const friend = findFriendForSession(currentSession)

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

  // 直接搜索结果中发送好友申请（双向确认）
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
      await sendFriendRequest(Number(targetUser.accountId))
      await refreshFriendRequests()
      setShowAddFriendModal(false)
      alert(`好友申请已发送给 ${targetUser.name}，等待对方确认`)
    } catch (err) {
      alert(err.response?.data?.detail || '发送好友申请失败')
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
          (currentSession.peerUserId != null && String(currentSession.peerUserId) === String(friend.accountId)) ||
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
              String(session.peerUserId ?? '') !== String(friend.accountId) &&
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

  const handleApproveGroupInviteRequest = async (requestId, conversationId) => {
    try {
      await approveGroupInviteRequest(requestId)
      await refreshFriendRequests()
      if (currentChat === conversationId) {
        await refreshGroupConversationMembers(conversationId)
      }
      alert('已通过入群申请')
    } catch (err) {
      alert(err.response?.data?.detail || '审批失败')
    }
  }

  const handleRejectGroupInviteRequest = async (requestId) => {
    try {
      await rejectGroupInviteRequest(requestId)
      await refreshFriendRequests()
      alert('已拒绝入群申请')
    } catch (err) {
      alert(err.response?.data?.detail || '审批失败')
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

  const handleMoveFriendToGroup = async (friendId, newGroup) => {
    const normalizedGroup = (newGroup || '').trim() || DEFAULT_FRIEND_GROUP
    try {
      await updateFriendGroup(friendId, normalizedGroup)
      _setCustomGroups((prev) => mergeFriendGroups([...prev, normalizedGroup]))
      setMyFriends(prev =>
        prev.map((friend) => (friend.id === friendId ? { ...friend, group: normalizedGroup } : friend))
      )
      await refreshRealtimeChatData(currentChat)
      return true
    } catch (err) {
      alert(err.response?.data?.detail || '好友分组更新失败')
      return false
    }
  }

  const handleClearChatHistory = () => {
    const currentSession = getCurrentSession()
    const currentMessages = messages[currentSession.id] || []
    const lastMessageId = currentMessages[currentMessages.length - 1]?.id
    if (!currentSession.id || !lastMessageId) {
      alert('当前没有可清空的聊天记录')
      return
    }
    if (!window.confirm('确定仅在当前设备清空这个会话的聊天记录吗？其他设备和其他账号不会受影响。')) {
      return
    }

    setLocalClearBeforeId(currentSession.id, lastMessageId)
    setMessages((prev) => ({
      ...prev,
      [currentSession.id]: [],
    }))
    setSessions((prev) => prev.map((session) => (
      session.id === currentSession.id
        ? { ...session, lastMessage: '暂无消息', time: '', badge: 0 }
        : session
    )))
    setSearchResults([])
    setCurrentResultIndex(0)
    alert('已清空当前设备上的聊天记录')
  }

  // 修改好友备注
  const handleUpdateRemark = async (friendId, newRemark) => {
    try {
      await updateFriendRemark(friendId, newRemark)
      setMyFriends(prev => 
        prev.map(f => f.id === friendId ? { ...f, remark: newRemark } : f)
      )
      alert('备注已保存')
    } catch (err) {
      console.error('更新备注失败', err)
      alert('保存备注失败，请稍后重试')
    }
  }

  // 开始编辑备注
  const handleStartEditRemark = () => {
    const currentSession = getCurrentSession()
    const friend = findFriendForSession(currentSession)
    setTempRemark(friend?.remark || '')
    setIsEditingRemark(true)
  }

  const handleStartEditFriendGroup = () => {
    const currentSession = getCurrentSession()
    const friend = findFriendForSession(currentSession)
    const currentGroup = friend?.group || DEFAULT_FRIEND_GROUP
    setTempFriendGroup(currentGroup)
    setNewFriendGroupName('')
    setIsEditingFriendGroup(true)
  }

  const handleCancelEditFriendGroup = () => {
    setIsEditingFriendGroup(false)
    setTempFriendGroup(DEFAULT_FRIEND_GROUP)
    setNewFriendGroupName('')
  }

  const handleSaveFriendGroup = async () => {
    const currentSession = getCurrentSession()
    const friend = findFriendForSession(currentSession)
    if (!friend) return

    const targetGroup = (newFriendGroupName || tempFriendGroup).trim() || DEFAULT_FRIEND_GROUP
    const saved = await handleMoveFriendToGroup(friend.id, targetGroup)
    if (saved) {
      handleCancelEditFriendGroup()
    }
  }

  // 保存备注
  const handleSaveRemark = () => {
    const currentSession = getCurrentSession()
    const friend = findFriendForSession(currentSession)
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
      setSessions(prev => 
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

  const getFilteredHistoryMessages = (query, filters = messageHistoryFilters) => {
    const currentMessages = messages[currentChat] || []
    const normalizedQuery = query.trim().toLowerCase()

    return currentMessages
      .filter((message) => {
        if (filters.sender !== 'all') {
          if (filters.sender === 'me' && message.sender !== 'me') {
            return false
          }
          if (filters.sender === 'other' && message.sender !== 'other') {
            return false
          }
          if (!['me', 'other'].includes(filters.sender) && String(message.senderId) !== String(filters.sender)) {
            return false
          }
        }
        if (filters.type !== 'all') {
          if (filters.type === 'reply' && !message.replyToId) {
            return false
          }
          if (filters.type !== 'reply' && (message.type || 'text') !== filters.type) {
            return false
          }
        }
        if (!matchesDateRange(message, filters.startAt, filters.endAt)) {
          return false
        }
        if (normalizedQuery && !normalizeMessageText(message).includes(normalizedQuery)) {
          return false
        }
        return true
      })
      .map((message, index) => ({
        ...message,
        index,
      }))
  }

  // 打开聊天记录模态框
  const handleOpenSearchMessage = () => {
    setShowSearchMessageModal(true)
    setSearchMessageQuery('')
    setMessageHistoryFilters(createHistoryFilters())
    setSearchResults(getFilteredHistoryMessages('', createHistoryFilters()))
    setCurrentResultIndex(0)
  }

  // 关闭查找消息模态框
  const handleCloseSearchMessage = () => {
    setShowSearchMessageModal(false)
    setSearchMessageQuery('')
    setSearchResults([])
    setCurrentResultIndex(0)
    setMessageHistoryFilters(createHistoryFilters())
  }

  const handleChangeHistoryFilter = (field, value) => {
    const nextFilters = { ...messageHistoryFilters, [field]: value }
    if (field === 'startAt' && nextFilters.endAt && value && nextFilters.endAt < value) {
      nextFilters.endAt = value
    }
    if (field === 'endAt' && nextFilters.startAt && value && value < nextFilters.startAt) {
      nextFilters.startAt = value
    }
    setMessageHistoryFilters(nextFilters)
    const results = getFilteredHistoryMessages(searchMessageQuery, nextFilters)
    setSearchResults(results)
    setCurrentResultIndex(results.length > 0 ? 0 : -1)
  }

  // 搜索消息
  const handleSearchMessages = (e) => {
    const query = e.target.value
    setSearchMessageQuery(query)

    const results = getFilteredHistoryMessages(query, messageHistoryFilters)
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
    const messageId = (messages[currentChat] || [])[messageIndex]?.id
    if (!messageId) return
    setJumpToMessageId(messageId)
  }

  const handleJumpToOriginalMessage = (messageId) => {
    if (!messageId) return
    const exists = (messages[currentChat] || []).some((message) => message.id === messageId)
    if (!exists) {
      alert('原消息已在当前设备被删除或清空，无法跳转')
      return
    }
    setJumpToMessageId(messageId)
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
    setSelectedInviteFriends([])
    const currentSession = getCurrentSession()
    if (currentSession?.isGroup) {
      refreshGroupConversationMembers(currentSession.id)
    }
    setShowInviteMemberModal(true)
  }

  // 关闭邀请成员模态框
  const handleCloseInviteMember = () => {
    setShowInviteMemberModal(false)
    setSelectedInviteFriends([])
  }

  // 选择/取消选择邀请好友
  const handleToggleInviteFriend = (friendId) => {
    setSelectedInviteFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    )
  }

  // 发送群聊邀请
  const handleSendInvite = async () => {
    if (selectedInviteFriends.length === 0) {
      alert('请至少选择一位好友')
      return
    }

    try {
      const currentSession = getCurrentSession()
      if (userRole === 'owner' || userRole === 'admin') {
        await inviteGroupMembers(currentChat, selectedInviteFriends)
        await refreshGroupConversationMembers(currentChat)
        alert(`已成功邀请 ${selectedInviteFriends.length} 位好友`)
      } else {
        await Promise.all(
          selectedInviteFriends.map((friendId) => createGroupInviteRequest(currentSession.id, friendId))
        )
        await refreshFriendRequests()
        alert(`已提交 ${selectedInviteFriends.length} 位好友的入群申请，等待群主或管理员审核`)
      }
      handleCloseInviteMember()
    } catch (err) {
      alert(err.response?.data?.detail || '邀请失败')
    }
  }

  // 获取当前群成员 ID 列表
  const getCurrentGroupMemberIds = () => {
    const members = groupMembers[currentChat] || []
    return new Set(members.map(m => m.id))
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

  const handleStartEditGroupName = () => {
    const currentSession = getCurrentSession()
    if (!currentSession?.isGroup) return
    setTempGroupName(currentSession.title || '')
    setIsEditingGroupName(true)
  }

  const handleStartEditGroupNickname = () => {
    const currentSession = getCurrentSession()
    if (!currentSession?.isGroup) return
    const myMember = groupMembers[currentSession.id]?.find(
      (member) => member.id === currentUserId || member.name === profileData.username
    )
    setTempGroupNickname(myMember?.groupNickname || '')
    setIsEditingGroupNickname(true)
  }

  const handleSaveGroupNicknameAction = async () => {
    const currentSession = getCurrentSession()
    if (!currentSession?.isGroup) return
    try {
      await handleSaveGroupNickname(tempGroupNickname)
      setIsEditingGroupNickname(false)
    } catch {
      // 错误已由 handleSaveGroupNickname 处理
    }
  }

  const handleCancelEditGroupNickname = () => {
    setIsEditingGroupNickname(false)
    setTempGroupNickname('')
  }

  const handleCancelEditGroupName = () => {
    const currentSession = getCurrentSession()
    setTempGroupName(currentSession?.title || '')
    setIsEditingGroupName(false)
  }

  const handleSaveGroupName = async () => {
    const currentSession = getCurrentSession()
    if (!currentSession?.isGroup) return

    const trimmedName = tempGroupName.trim()
    if (!trimmedName) {
      alert('请输入群聊名称')
      return
    }

    if (trimmedName === currentSession.title) {
      setIsEditingGroupName(false)
      return
    }

    setIsRenamingGroup(true)
    try {
      await renameGroup(currentSession.id, trimmedName)
      setSessions((prev) => prev.map((session) => (
        session.id === currentSession.id
          ? { ...session, title: trimmedName, realName: trimmedName }
          : session
      )))
      setDynamicSessions((prev) => prev.map((session) => (
        session.id === currentSession.id
          ? { ...session, title: trimmedName, realName: trimmedName }
          : session
      )))
      setIsEditingGroupName(false)
      alert('群聊名称已更新')
    } catch (err) {
      alert(err.response?.data?.detail || '修改群聊名称失败')
    } finally {
      setIsRenamingGroup(false)
    }
  }

  // 开始编辑群公告
  const handleStartEditAnnouncement = () => {
    setTempAnnouncement(groupAnnouncement)
    setIsEditingAnnouncement(true)
  }

  // 保存群公告
  const handleSaveAnnouncement = () => {
    const currentSession = getCurrentSession()
    if (!currentSession?.isGroup) return
    publishGroupAnnouncement(currentSession.id, tempAnnouncement)
      .then(async () => {
        const items = await getGroupAnnouncements(currentSession.id)
        setGroupAnnouncementHistory(items)
        setGroupAnnouncement(items[0]?.content || '')
        setIsEditingAnnouncement(false)
        alert('群公告已保存')
      })
      .catch((err) => {
        alert(err.response?.data?.detail || '群公告保存失败')
      })
  }

  // 取消编辑群公告
  const handleCancelEditAnnouncement = () => {
    setIsEditingAnnouncement(false)
    setTempAnnouncement('')
  }

  const handleOpenAnnouncementHistory = () => {
    setShowAnnouncementHistoryModal(true)
  }

  const handleCloseAnnouncementHistory = () => {
    setShowAnnouncementHistoryModal(false)
  }

  // 移除群成员（踢人）
  const handleRemoveMember = async (memberId) => {
    const currentSession = getCurrentSession()
    if (!currentSession?.isGroup) return
    if (!window.confirm('确定要移除该成员吗？')) return
    try {
      await kickGroupMember(currentSession.id, memberId)
      // 刷新成员列表
      await refreshGroupConversationMembers(currentSession.id)
      alert('成员已移除')
    } catch (err) {
      alert(err.response?.data?.detail || '移除成员失败')
    }
  }

  // 转让群主
  const handleTransferGroup = async (memberId) => {
    const currentSession = getCurrentSession()
    if (!currentSession?.isGroup) return
    if (!memberId) {
      alert('请选择一位群成员作为新群主')
      return
    }
    if (!window.confirm('确定要转让群主吗？转让后您将成为普通成员。')) return
    try {
      await transferGroupOwnership(currentSession.id, memberId)
      setUserRole('member')
      await refreshGroupConversationMembers(currentSession.id)
      alert('群主已成功转让')
    } catch (err) {
      alert(err.response?.data?.detail || '转让群主失败')
    }
  }

  // 退出群聊
  const handleExitGroup = async () => {
    if (!window.confirm('确定要退出该群吗？退出后将无法查看群聊历史消息。')) {
      return
    }

    const currentSession = getCurrentSession()
    if (!currentSession?.isGroup) return

    try {
      await exitGroup(currentSession.id)

      // 从会话列表中移除该群聊
      setSessions((prev) => prev.filter((s) => s.id !== currentSession.id))
      setDynamicSessions((prev) => prev.filter((s) => s.id !== currentSession.id))

      // 如果当前正在查看该群聊，则切换回去
      if (currentChat === currentSession.id) {
        setCurrentChat(null)
      }

      handleCloseChatDetail()
      alert('已成功退出群聊')
    } catch (err) {
      const errorMsg = err.response?.data?.detail || '退出群聊失败'
      alert(errorMsg)
    }
  }

  // 解散群聊
  const handleDismissGroup = async () => {
    if (!window.confirm('确定要解散该群吗？此操作不可恢复！\n\n解散后：\n- 所有聊天记录将被删除\n- 所有群成员将被移除\n- 群聊将不复存在')) {
      return
    }
    
    try {
      await dismissGroup(currentChat)
      alert('群聊已解散')
      handleCloseChatDetail()
      // 刷新会话列表
      await refreshRealtimeChatData()
    } catch (err) {
      const errorMsg = err.response?.data?.detail || '解散群聊失败'
      alert(errorMsg)
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
          // 先重置展示态，避免上一个账号的头像短暂闪现
          setUserAvatar('我')
          await syncProfileFromUser(user)
          setIsLoggedIn(true)
          await refreshRealtimeChatData()
          await refreshFriendRequests()
          // 清除 localStorage 中的 lastStatus（后端已恢复）
          localStorage.removeItem('lastStatus')
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
        await syncProfileFromUser(user)
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
    
    const canDelete = msg.sender !== 'system'
    
    if (!canRevoke && !canReply && !canDelete) return
    
    setContextMenu({
      messageId: msg.id,
      messageText: msg.text,
      messageSender: msg.sender,
      messageSenderName: msg.senderName || null,
      x: e.clientX,
      y: e.clientY,
      canRevoke,
      canReply,
      canDelete,
    })
  }

  // 关闭右键菜单
  const closeContextMenu = () => {
    setContextMenu(null)
  }

  // 撤回消息
  const handleRevokeMessage = async () => {
    if (!contextMenu) return
    
    const { messageId } = contextMenu

    try {
      await revokeMessage(messageId)
    } catch (err) {
      // 撤回失败时提示
      alert(err.response?.data?.detail || '撤回失败，请重试')
      closeContextMenu()
      return
    }
    
    markReplyToDeleted(currentChat, messageId, '该消息已撤回')
    setMessages(prev => ({
      ...prev,
      [currentChat]: prev[currentChat].filter(msg => msg.id !== messageId)
    }))
    
    closeContextMenu()
  }

  // 本地删除消息（仅从自己视图移除，持久化到 localStorage）
  // 本地删除：只在自己视图消失，消息仍在服务器，其他人不受影响
  const handleDeleteMessage = () => {
    if (!contextMenu) return
    const { messageId } = contextMenu

    // 持久化到 localStorage，刷新后仍过滤
    addLocallyDeleted(currentChat, messageId)
    markReplyToDeleted(currentChat, messageId, '该消息已删除')
    setMessages(prev => ({
      ...prev,
      [currentChat]: prev[currentChat].filter(msg => msg.id !== messageId)
    }))
    closeContextMenu()
  }

  // 回复消息
  const handleReplyMessage = () => {
    if (!contextMenu) return
    
    const { messageId, messageText, messageSender, messageSenderName } = contextMenu
    
    setReplyToMessage({
      id: messageId,
      text: messageText,
      sender: messageSender,
      senderName: messageSenderName,
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
  const handleSaveProfile = async () => {
    try {
      await updateProfile({
        nickname: profileData.nickname || null,
        gender: profileData.gender || null,
        bio: profileData.bio || null,
        avatar: profileData.avatar || null,
      })
      await refreshRealtimeChatData(currentChat)
      if (currentChat && getCurrentSession().isGroup) {
        await refreshGroupConversationMembers(currentChat)
      }
      setIsEditingProfile(false)
      alert('个人信息保存成功！')
    } catch (err) {
      alert(err.response?.data?.detail || '保存失败，请重试')
    }
  }

  // 打开敏感信息修改模态框
  const handleOpenSensitiveInfoModal = () => {
    setSensitiveInfoForm({
      password: '',
      newEmail: profileData.email || '',
      newPhone: profileData.phone || '',
      newPassword: '',
      confirmPassword: ''
    })
    setShowSensitiveInfoModal(true)
  }

  // 关闭敏感信息修改模态框
  const handleCloseSensitiveInfoModal = () => {
    setShowSensitiveInfoModal(false)
    setSensitiveInfoForm({
      password: '',
      newEmail: '',
      newPhone: '',
      newPassword: '',
      confirmPassword: ''
    })
  }

  // 处理敏感信息表单输入
  const handleSensitiveInfoChange = (field, value) => {
    setSensitiveInfoForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 保存敏感信息
  const handleSaveSensitiveInfo = async () => {
    // 验证密码
    if (!sensitiveInfoForm.password) {
      alert('请输入当前密码进行身份验证')
      return
    }

    // 如果修改密码，验证新密码
    if (sensitiveInfoForm.newPassword) {
      if (sensitiveInfoForm.newPassword.length < 6) {
        alert('新密码长度不能少于6位')
        return
      }
      if (sensitiveInfoForm.newPassword !== sensitiveInfoForm.confirmPassword) {
        alert('两次输入的新密码不一致')
        return
      }
    }

    try {
      const payload = {
        password: sensitiveInfoForm.password,
      }

      if (sensitiveInfoForm.newEmail.trim() && sensitiveInfoForm.newEmail !== profileData.email) {
        payload.new_email = sensitiveInfoForm.newEmail
      }
      if (sensitiveInfoForm.newPhone.trim() && sensitiveInfoForm.newPhone !== profileData.phone) {
        payload.new_phone = sensitiveInfoForm.newPhone
      }
      if (sensitiveInfoForm.newPassword) {
        payload.new_password = sensitiveInfoForm.newPassword
      }

      if (!payload.new_email && !payload.new_phone && !payload.new_password) {
        alert('请至少修改一项敏感信息')
        return
      }

      const result = await updateSensitiveInfo(payload)
      alert(result.message || '敏感信息更新成功！')
      
      // 更新本地状态
      if (sensitiveInfoForm.newEmail) {
        setProfileData(prev => ({ ...prev, email: sensitiveInfoForm.newEmail }))
      }
      if (sensitiveInfoForm.newPhone) {
        setProfileData(prev => ({ ...prev, phone: sensitiveInfoForm.newPhone }))
      }
      
      handleCloseSensitiveInfoModal()
      
      // 如果修改了密码，提示重新登录
      if (sensitiveInfoForm.newPassword) {
        alert('密码已修改，请使用新密码重新登录')
        handleLogout()
      }
    } catch (err) {
      alert(err.response?.data?.detail || '更新失败，请重试')
    }
  }

  // 取消编辑个人信息
  const handleCancelProfile = async () => {
    try {
      const user = await getCurrentUser()
      await syncProfileFromUser(user)
    } catch {
      // ignore and keep current draft when refresh fails
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

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件！')
      return
    }

    // 限制 2MB（MEDIUMTEXT 支持最大 16MB，base64 膨胀约 1.33 倍）
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过 2MB！')
      return
    }

    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64String = event.target.result
      try {
      await updateProfile({ avatar: base64String })
      setUserAvatar(base64String)
      setProfileData(prev => ({ ...prev, avatar: base64String }))
      await refreshRealtimeChatData(currentChat)
      if (currentChat && getCurrentSession().isGroup) {
        await refreshGroupConversationMembers(currentChat)
      }
      alert('头像更换成功！')
      } catch (err) {
        alert(err.response?.data?.detail || '头像保存失败，请重试！')
      }
    }
    reader.onerror = () => {
      alert('头像读取失败，请重试！')
    }
    reader.readAsDataURL(file)
  }

  // 发送消息
  const handleSendMessage = async () => {
    if (!messageInput.trim()) return

    const activeSession = getCurrentSession()
    const shouldUseBackend =
      activeSession.id &&
      !dynamicSessions.some((session) => session.id === activeSession.id) &&
      !editingMessageId

    if (shouldUseBackend) {
      try {
        const result = await sendChatMessage(activeSession.id, messageInput, replyToMessage?.id)
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
      time: formatLocalMessageTime(),
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

  // 发送图片消息（调用后端上传API）
  const handleSendImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      e.target.value = ''
      return
    }

    // 验证文件大小（限制 5MB，与后端一致）
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB')
      e.target.value = ''
      return
    }

    try {
      const activeSession = getCurrentSession()
      if (!activeSession?.id) {
        alert('请先选择一个会话')
        e.target.value = ''
        return
      }

      const replyToId = replyToMessage?.id || null
      console.log('[发送图片] 开始上传图片:', file.name, '大小:', (file.size / 1024).toFixed(2), 'KB')
      const res = await sendImageMessage(activeSession.id, file, replyToId)
      const messageData = res.message
      console.log('[发送图片] 后端返回的消息数据:', { id: messageData.id, type: messageData.type, text: messageData.text, mediaUrl: messageData.mediaUrl, mediaName: messageData.mediaName })

      // 更新消息列表（使用后端返回的消息数据）
      setMessages((prev) => ({
        ...prev,
        [currentChat]: [...(prev[currentChat] || []), messageData]
      }))
      console.log('[发送图片] 消息已添加到本地状态')

      setReplyToMessage(null)
    } catch (err) {
      console.error('[发送图片] 错误:', err)
      alert(err.response?.data?.detail || '图片发送失败，请重试')
    } finally {
      e.target.value = ''
    }
  }

  // 发送视频消息（调用后端上传API）
  const handleSendVideo = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('video/')) {
      alert('请选择视频文件')
      e.target.value = ''
      return
    }

    // 验证文件大小（限制 50MB，与后端一致）
    if (file.size > 50 * 1024 * 1024) {
      alert('视频大小不能超过 50MB')
      e.target.value = ''
      return
    }

    try {
      const activeSession = getCurrentSession()
      if (!activeSession?.id) {
        alert('请先选择一个会话')
        e.target.value = ''
        return
      }

      const replyToId = replyToMessage?.id || null
      console.log('[发送视频] 开始上传视频:', file.name, '大小:', (file.size / 1024 / 1024).toFixed(2), 'MB')
      const res = await sendVideoMessage(activeSession.id, file, replyToId)
      const messageData = res.message
      console.log('[发送视频] 后端返回的消息数据:', { id: messageData.id, type: messageData.type, text: messageData.text, mediaUrl: messageData.mediaUrl, mediaName: messageData.mediaName })

      // 更新消息列表（使用后端返回的消息数据）
      setMessages((prev) => ({
        ...prev,
        [currentChat]: [...(prev[currentChat] || []), messageData]
      }))
      console.log('[发送视频] 消息已添加到本地状态')

      setReplyToMessage(null)
    } catch (err) {
      console.error('[发送视频] 错误:', err)
      alert(err.response?.data?.detail || '视频发送失败，请重试')
    } finally {
      e.target.value = ''
    }
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
    // (status removed from localStorage backup)
    
    logout()
    setIsLoggedIn(false)
    setCurrentChat(null)
    setSessions([])
    setMessages({})
    setMyFriends([])
    setShowUserPanel(false)
    setShowLogoutConfirm(false)
    // 清理头像和个人信息，避免下一个账号沿用
    setUserAvatar('我')
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
  const confirmDeleteAccount = async () => {
    try {
      await deleteMyAccount()
      logout()
      setIsLoggedIn(false)
      setCurrentChat(null)
      setSessions([])
      setMessages({})
      setMyFriends([])
      setDynamicSessions([])
      setPinnedChatIds([])
      setBlacklist([])
      setShowUserPanel(false)
      setShowDeleteConfirm(false)

      try {
        localStorage.removeItem(getScopedStorageKey('archivedGroupIds'))
        localStorage.removeItem(getScopedStorageKey('blacklist'))
        localStorage.removeItem(getScopedStorageKey('wtdd_deleted_msgs'))
        localStorage.removeItem(getScopedStorageKey('wtdd_cleared_conversations'))
        // userStatus removed
      } catch {
        // ignore
      }

      alert('账户已成功注销')
    } catch (err) {
      alert(err.response?.data?.detail || '注销账户失败')
    }
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

  // 打开图片灯箱
  const openLightbox = (url, name, type = 'image') => setLightboxImage({ url, name, type })
  const closeLightbox = () => setLightboxImage(null)

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
    
    const _rect = container.getBoundingClientRect()
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
    // 左侧会话列表拖拽 - 已移除
    
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
    
    // (status menu removed)
    
    return () => {
      document.removeEventListener('mousemove', handleComposerResizeMove)
      document.removeEventListener('mouseup', handleComposerResizeEnd)
    }
  }, [isComposingResizing]) // eslint-disable-line react-hooks/exhaustive-deps

  // 点击在线人数
  // eslint-disable-next-line no-unused-vars
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

  // 任命/取消管理员
  const handleMakeAdmin = async (memberId, isAdmin = true) => {
    const currentSession = getCurrentSession()
    if (!currentSession?.isGroup) return
    const actionLabel = isAdmin ? '设为群管' : '取消群管'
    if (!window.confirm(`确定要${actionLabel}吗？`)) return
    try {
      await setGroupAdmin(currentSession.id, memberId, isAdmin)
      await refreshGroupConversationMembers(currentSession.id)
    } catch (err) {
      alert(err.response?.data?.detail || '操作失败')
    }
  }

  // 修改我在本群的昵称
  const handleSaveGroupNickname = async (nickname) => {
    const currentSession = getCurrentSession()
    if (!currentSession?.isGroup) return
    try {
      await updateGroupNickname(currentSession.id, nickname)
      await refreshGroupConversationMembers(currentSession.id)
    } catch (err) {
      alert(err.response?.data?.detail || '修改群昵称失败')
    }
  }

  // 从好友列表打开（或创建）私聊会话
  const handleOpenFriendChat = (friend) => {
    const allSessions = [...sessions, ...dynamicSessions]
    const existingSession = allSessions.find(
      (session) =>
        (session.peerUserId != null && String(session.peerUserId) === String(friend.accountId)) ||
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
      (s) =>
        (s.peerUserId != null && String(s.peerUserId) === String(peerProfile.userId)) ||
        s.title === peerProfile.name ||
        s.realName === peerProfile.name
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
        time: formatLocalMessageTime(),
        badge: 0,
        online: peerProfile.status === 'online' ? 1 : 0,
        isGroup: false,
        realName: peerProfile.name,
        peerUserId: Number(peerProfile.userId)
      }
      setDynamicSessions((prev) => [newSession, ...prev])
      setCurrentChat(newSessionId)
    }

    setActiveTab('chats')
    handleClosePeerProfile()
  }

  // 在“对方详情页”点击添加好友（双向拉取确认）
  const handleAddPeerAsFriend = async () => {
    if (!peerProfile) return

    if (isAlreadyFriend(peerProfile.userId, peerProfile.name)) {
      alert('该用户已经是你的好友')
      return
    }

    try {
      // peerProfile.userId 是真实 DB 用户 ID（即 accountId）
      await sendFriendRequest(Number(peerProfile.userId))
      await refreshFriendRequests()
      handleClosePeerProfile()
      alert(`好友申请已发送给 ${peerProfile.name}，等待对方确认`)
    } catch (err) {
      alert(err.response?.data?.detail || '发送好友申请失败')
    }
  }

  // 获取当前群主
  const getCurrentOwner = () => {
    if (!currentChat) return '未知'
    const cachedOwnerName = groupOwnerNameMap[currentChat]
    if (cachedOwnerName) return cachedOwnerName
    const members = groupMembers[currentChat] || []
    const owner = members.find(m => m.role === 'owner')
    return owner ? owner.name : '未知'
  }

  const canRenameCurrentGroup = Boolean(
    currentChat &&
    userRole === 'owner' &&
    groupOwnerIdMap[currentChat] &&
    currentUserId &&
    groupOwnerIdMap[currentChat] === currentUserId
  )

  const myRole = { [currentChat]: userRole }
  const unreadNotificationCount = sessions.reduce((total, session) => {
    if (session.isMuted) return total
    return total + (session.badge || 0)
  }, 0)

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
        <LeftNav
          userAvatar={userAvatar}
          toggleUserPanel={toggleUserPanel}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingRequestCount={friendRequestList.length + groupInviteRequests.length}
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
          customGroups={_customGroups}
          collapsedGroups={collapsedGroups}
          toggleGroupCollapse={toggleGroupCollapse}
          archivedGroupIds={archivedGroupIds}
          onToggleGroupArchive={handleToggleGroupArchive}
          onOpenFriendChat={handleOpenFriendChat}
          chatlistWidth={chatlistWidth}
          pinnedChatIds={pinnedChatIds}
          onTogglePinChat={handleTogglePinChat}
          onRemoveFromBlacklist={handleRemoveFromBlacklist}
          onOpenBlacklistChat={handleOpenBlacklistChat}
          friendRequestList={friendRequestList}
          groupInviteRequests={groupInviteRequests}
          handleAcceptRequest={handleAcceptRequest}
          handleRejectRequest={handleRejectRequest}
          handleApproveGroupInviteRequest={handleApproveGroupInviteRequest}
          handleRejectGroupInviteRequest={handleRejectGroupInviteRequest}
        />

        {/* 侧边栏与聊天窗口的固定分隔线 */}
        <div className="resize-handle" />

        <ChatMainView
          getCurrentSession={getCurrentSession}
          groupMembers={groupMembers}
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
          jumpToMessageId={jumpToMessageId}
          handleJumpHandled={() => setJumpToMessageId(null)}
          handleJumpToOriginalMessage={handleJumpToOriginalMessage}
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
          onOpenLightbox={openLightbox}
        />
      </main>

      <Overlays
        showEmojiPicker={showEmojiPicker}
        closeEmojiPicker={closeEmojiPicker}
        handleEmojiSelect={handleEmojiSelect}
        contextMenu={contextMenu}
        closeContextMenu={closeContextMenu}
        handleReplyMessage={handleReplyMessage}

        handleRevokeMessage={handleRevokeMessage}
        handleDeleteMessage={handleDeleteMessage}
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
        unreadNotificationCount={unreadNotificationCount}

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
        handleOpenSensitiveInfoModal={handleOpenSensitiveInfoModal}
        showSensitiveInfoModal={showSensitiveInfoModal}
        handleCloseSensitiveInfoModal={handleCloseSensitiveInfoModal}
        sensitiveInfoForm={sensitiveInfoForm}
        handleSensitiveInfoChange={handleSensitiveInfoChange}
        handleSaveSensitiveInfo={handleSaveSensitiveInfo}
        showChatDetail={showChatDetail}
        handleCloseChatDetail={handleCloseChatDetail}
        getCurrentSession={getCurrentSession}
        handleOpenChatDetailPeerProfile={handleOpenChatDetailPeerProfile}
        handleOpenOwnerProfile={handleOpenOwnerProfile}
        handleOpenMemberProfile={handleOpenMemberProfile}
        handleOpenSearchMessage={handleOpenSearchMessage}
        isEditingAnnouncement={isEditingAnnouncement}
        groupAnnouncement={groupAnnouncement}
        groupAnnouncementHistory={groupAnnouncementHistory}
        showAnnouncementHistoryModal={showAnnouncementHistoryModal}
        userRole={userRole}
        canRenameCurrentGroup={canRenameCurrentGroup}
        isEditingGroupName={isEditingGroupName}
        tempGroupName={tempGroupName}
        setTempGroupName={setTempGroupName}
        isRenamingGroup={isRenamingGroup}
        handleStartEditGroupName={handleStartEditGroupName}
        handleSaveGroupName={handleSaveGroupName}
        handleCancelEditGroupName={handleCancelEditGroupName}
        handleStartEditAnnouncement={handleStartEditAnnouncement}
        tempAnnouncement={tempAnnouncement}
        setTempAnnouncement={setTempAnnouncement}
        handleSaveAnnouncement={handleSaveAnnouncement}
        handleCancelEditAnnouncement={handleCancelEditAnnouncement}
        handleOpenAnnouncementHistory={handleOpenAnnouncementHistory}
        handleCloseAnnouncementHistory={handleCloseAnnouncementHistory}
        handleOpenMemberList={handleOpenMemberList}
        handleOpenInviteMember={handleOpenInviteMember}
        handleCloseInviteMember={handleCloseInviteMember}
        selectedInviteFriends={selectedInviteFriends}
        handleToggleInviteFriend={handleToggleInviteFriend}
        handleSendInvite={handleSendInvite}
        getCurrentGroupMemberIds={getCurrentGroupMemberIds}
        handleTogglePinChat={handleTogglePinChat}
        isChatPinned={isChatPinned}
        handleToggleSessionMute={handleToggleSessionMute}
        isSessionMuted={isSessionMuted}
        handleToggleBlacklist={handleToggleBlacklist}
        isUserInBlacklist={isUserInBlacklist}
        handleTransferGroup={handleTransferGroup}
        handleDismissGroup={handleDismissGroup}
        handleExitGroup={handleExitGroup}
        isEditingGroupNickname={isEditingGroupNickname}
        tempGroupNickname={tempGroupNickname}
        setTempGroupNickname={setTempGroupNickname}
        handleStartEditGroupNickname={handleStartEditGroupNickname}
        handleSaveGroupNickname={handleSaveGroupNicknameAction}
        handleCancelEditGroupNickname={handleCancelEditGroupNickname}
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
        isEditingFriendGroup={isEditingFriendGroup}
        tempFriendGroup={tempFriendGroup}
        setTempFriendGroup={setTempFriendGroup}
        newFriendGroupName={newFriendGroupName}
        setNewFriendGroupName={setNewFriendGroupName}
        customGroups={_customGroups}
        handleStartEditFriendGroup={handleStartEditFriendGroup}
        handleSaveFriendGroup={handleSaveFriendGroup}
        handleCancelEditFriendGroup={handleCancelEditFriendGroup}
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
        groupInviteRequests={groupInviteRequests}
        handleAcceptRequest={handleAcceptRequest}
        handleRejectRequest={handleRejectRequest}
        handleApproveGroupInviteRequest={handleApproveGroupInviteRequest}
        handleRejectGroupInviteRequest={handleRejectGroupInviteRequest}
        showSearchMessageModal={showSearchMessageModal}
        handleCloseSearchMessage={handleCloseSearchMessage}
        searchMessageQuery={searchMessageQuery}
        handleSearchMessages={handleSearchMessages}
        messageHistoryFilters={messageHistoryFilters}
        handleChangeHistoryFilter={handleChangeHistoryFilter}
        searchResults={searchResults}
        handlePreviousResult={handlePreviousResult}
        currentResultIndex={currentResultIndex}
        handleNextResult={handleNextResult}
        setCurrentResultIndex={setCurrentResultIndex}
        handleJumpToMessage={handleJumpToMessage}
        highlightText={highlightText}
        handleClearChatHistory={handleClearChatHistory}
        showMemberListModal={showMemberListModal}
        handleCloseMemberList={handleCloseMemberList}
        showInviteMemberModal={showInviteMemberModal}
        showCreateGroupModal={showCreateGroupModal}
        handleCloseCreateGroup={handleCloseCreateGroup}
        groupName={groupName}
        setGroupName={setGroupName}
        selectedFriends={selectedFriends}
        handleToggleSelectFriend={handleToggleSelectFriend}
        handleCreateGroup={handleCreateGroup}
      />

      {/* 图片/视频全屏灯箱 */}
      {lightboxImage && (
        <div
          className="lightbox-overlay"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="查看图片"
        >
          <button className="lightbox-close" onClick={closeLightbox} aria-label="关闭">✕</button>
          {lightboxImage.type === 'video' ? (
            <video
              className="lightbox-media"
              src={lightboxImage.url}
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              className="lightbox-media"
              src={lightboxImage.url}
              alt={lightboxImage.name || '图片'}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {lightboxImage.name && (
            <div className="lightbox-caption">{lightboxImage.name}</div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
