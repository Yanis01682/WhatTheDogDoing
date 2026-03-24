import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentChat, setCurrentChat] = useState(0)
  const [messageInput, setMessageInput] = useState('')
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showUserPanel, setShowUserPanel] = useState(false) // 用户面板显示状态
  const [isNightMode, setIsNightMode] = useState(false) // 夜间模式
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
  const [showAvatarModal, setShowAvatarModal] = useState(false) // 更换头像模态框
  const [selectedAvatar, setSelectedAvatar] = useState(null) // 选中的头像文件
  const [avatarPreview, setAvatarPreview] = useState(null) // 头像预览 URL
  const [userAvatar, setUserAvatar] = useState('我') // 用户头像（支持图片或文字）
  const [showProfileModal, setShowProfileModal] = useState(false) // 个人信息模态框
  const [isEditingProfile, setIsEditingProfile] = useState(false) // 是否正在编辑个人信息
  const [userStatus, setUserStatus] = useState('online') // 在线状态：online-在线，offline-离线，busy-忙碌，away-离开，invisible-隐身
  const [showStatusMenu, setShowStatusMenu] = useState(false) // 状态选择菜单
  const [showChatDetail, setShowChatDetail] = useState(false) // 聊天详情模态框
  const [activeTab, setActiveTab] = useState('chats') // 当前激活的标签页：chats-会话，friends-好友
  const [showAddFriendModal, setShowAddFriendModal] = useState(false) // 添加好友模态框
  const [friendSearchQuery, setFriendSearchQuery] = useState('') // 搜索好友关键词
  const [friendRequestList, setFriendRequestList] = useState([]) // 好友请求列表
  const [myFriends, setMyFriends] = useState([ // 我的好友列表
    { id: 101, name: '张三', avatar: '张', status: 'online', signature: '人生若只如初见', group: '常用' },
    { id: 102, name: '李四', avatar: '李', status: 'offline', signature: '这个家伙很懒', group: '朋友' },
    { id: 103, name: '王五', avatar: '王', status: 'busy', signature: '努力奋斗中...', group: '同事' },
    { id: 104, name: '赵六', avatar: '赵', status: 'away', signature: '世界那么大，我想去看看', group: '朋友' },
    { id: 105, name: '钱七', avatar: '钱', status: 'invisible', signature: '低调做人，高调做事', group: '同事' }
  ])
  const [collapsedGroups, setCollapsedGroups] = useState([]) // 已折叠的分组
  const [customGroups, setCustomGroups] = useState(['常用', '同事', '朋友']) // 自定义分组列表
  const [dynamicSessions, setDynamicSessions] = useState([]) // 动态创建的会话（好友私聊）
  const [profileData, setProfileData] = useState({
    nickname: '',
    email: '',
    phone: '',
    bio: '',
    gender: 'male'
  }) // 个人信息数据

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
  }, [])

  // 切换在线状态
  const handleChangeStatus = (status) => {
    setUserStatus(status)
    localStorage.setItem('userStatus', status)
    setShowStatusMenu(false)
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
    const iconMap = {
      'online': '🟢',
      'offline': '⚫',
      'busy': '🔴',
      'away': '🟡',
      'invisible': '🌙'
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
    return sessions.find(s => s.id === currentChat) || sessions[0]
  }

  // 打开添加好友模态框
  const handleOpenAddFriend = () => {
    setShowAddFriendModal(true)
  }

  // 关闭添加好友模态框
  const handleCloseAddFriend = () => {
    setShowAddFriendModal(false)
    setFriendSearchQuery('')
  }

  // 搜索好友
  const handleSearchFriend = (e) => {
    setFriendSearchQuery(e.target.value)
  }

  // 发送好友请求
  const handleSendFriendRequest = (userId) => {
    alert(`已向用户 ${userId} 发送好友请求`)
    handleCloseAddFriend()
  }

  // 删除好友
  const handleDeleteFriend = (friendId) => {
    if (window.confirm('确定要删除该好友吗？')) {
      setMyFriends(prev => prev.filter(f => f.id !== friendId))
      alert('好友已删除')
    }
  }

  // 接受好友请求
  const handleAcceptRequest = (requestId) => {
    const request = friendRequestList.find(r => r.id === requestId)
    if (request) {
      setMyFriends(prev => [...prev, {
        id: request.userId,
        name: request.name,
        avatar: request.name.charAt(0),
        status: 'offline'
      }])
      setFriendRequestList(prev => prev.filter(r => r.id !== requestId))
      alert(`已接受 ${request.name} 的好友请求`)
    }
  }

  // 拒绝好友请求
  const handleRejectRequest = (requestId) => {
    setFriendRequestList(prev => prev.filter(r => r.id !== requestId))
    alert('已拒绝好友请求')
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
  const [messages, setMessages] = useState({
    0: [
      { id: 1, text: '你好，欢迎加入产品组讨论群！', sender: 'system', time: '10:00' },
      { id: 2, text: '大家下午好，今天的产品需求已经更新了，请大家查看。', sender: 'other', time: '10:05' },
      { id: 3, text: '好的，谢谢提醒。', sender: 'me', time: '10:10' },
      { id: 4, text: '下午把接口文档同步下。', sender: 'me', time: '14:30' }
    ],
    1: [
      { id: 1, text: '大家好，前端开发群已经建立。', sender: 'system', time: '10:00' },
      { id: 2, text: 'Alice: 新版登录页我已经提 PR', sender: 'other', time: '13:58' }
    ],
    2: [
      { id: 1, text: '17:30 自动提醒填写日报', sender: 'system', time: '12:20' }
    ],
    3: [
      { id: 1, text: '妈妈：今晚回来吃饭吗？', sender: 'other', time: '09:11' }
    ]
  })

  // 群成员数据（包含角色信息）
  const 
  groupMembers = {  
    0: [
      { id: 1, name: '张三', avatar: '张', role: 'owner', online: true },
      { id: 2, name: 'Alice', avatar: 'A', role: 'admin', online: true },
      { id: 3, name: 'Bob', avatar: 'B', role: 'member', online: true },
      { id: 4, name: 'Charlie', avatar: 'C', role: 'member', online: false },
      { id: 5, name: 'David', avatar: 'D', role: 'member', online: true },
      { id: 6, name: 'Eve', avatar: 'E', role: 'member', online: true },
      { id: 7, name: 'Frank', avatar: 'F', role: 'member', online: false },
      { id: 8, name: 'Grace', avatar: 'G', role: 'member', online: true }
    ],
    1: [
      { id: 1, name: '前端 - 李明', avatar: '李', role: 'owner', online: true },
      { id: 2, name: '前端 - 王芳', avatar: '王', role: 'admin', online: true },
      { id: 3, name: '前端 - 赵强', avatar: '赵', role: 'member', online: true },
      { id: 4, name: '前端 - 刘娜', avatar: '刘', role: 'member', online: false },
      { id: 5, name: '前端 - 陈杰', avatar: '陈', role: 'member', online: true },
      { id: 6, name: '前端 - 杨帆', avatar: '杨', role: 'member', online: true },
      { id: 7, name: '前端 - 周敏', avatar: '周', role: 'member', online: true },
      { id: 8, name: '前端 - 吴涛', avatar: '吴', role: 'member', online: false },
      { id: 9, name: '前端 - 郑红', avatar: '郑', role: 'member', online: true },
      { id: 10, name: '前端 - 孙丽', avatar: '孙', role: 'member', online: true },
      { id: 11, name: '前端 - 马超', avatar: '马', role: 'member', online: true },
      { id: 12, name: '前端 - 朱琳', avatar: '朱', role: 'member', online: false }
    ],
    2: [],
    3: [
      { id: 1, name: '爸爸', avatar: '爸', role: 'owner', online: true },
      { id: 2, name: '妈妈', avatar: '妈', role: 'admin', online: true },
      { id: 3, name: '我', avatar: '我', role: 'member', online: true },
      { id: 4, name: '妹妹', avatar: '妹', role: 'member', online: false },
      { id: 5, name: '爷爷', avatar: '爷', role: 'member', online: true }
    ]
  }

  // 我的角色（用于权限判断）
  const myRole = {
    0: 'admin',
    1: 'member',
    2: 'member',
    3: 'member'
  }

  // 登录处理
  const handleLogin = (e) => {
    e.preventDefault()
    const account = e.target.account.value
    const password = e.target.password.value
    
    if (account && password) {
      setIsLoggedIn(true)
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
  const handleRegister = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData)
    
    // 前端基础验证
    if (!data.username || !data.email || !data.password || !data.confirmPassword) {
      alert('请填写所有必填项')
      return
    }
    
    if (data.password !== data.confirmPassword) {
      alert('两次输入的密码不一致')
      return
    }
    
    if (data.password.length < 6) {
      alert('密码长度至少为 6 位')
      return
    }
    
    // TODO: 调用后端 API 进行注册
    alert('注册成功！请登录')
    setShowRegisterForm(false)
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

  // 点击更换头像
  const handleAvatarChange = () => {
    // 触发文件选择
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        setSelectedAvatar(file)
        // 创建预览 URL
        const url = URL.createObjectURL(file)
        setAvatarPreview(url)
        setShowAvatarModal(true)
      }
    }
    input.click()
  }

  // 确认更换头像
  const handleAvatarConfirm = () => {
    if (selectedAvatar) {
      // 将图片转为 base64 存储（实际应用中应该上传到服务器）
      const reader = new FileReader()
      reader.onload = (e) => {
        setUserAvatar(e.target.result)
        // 保存到 localStorage，这样刷新后还在
        localStorage.setItem('userAvatar', e.target.result)
      }
      reader.readAsDataURL(selectedAvatar)
    }
    setShowAvatarModal(false)
    setSelectedAvatar(null)
    setAvatarPreview(null)
  }

  // 取消更换头像
  const handleAvatarCancel = () => {
    setShowAvatarModal(false)
    setSelectedAvatar(null)
    setAvatarPreview(null)
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
  const handleSendMessage = () => {
    if (!messageInput.trim()) return
    
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

  // 按 Enter 发送消息
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 登出
  const handleLogout = () => {
    setIsLoggedIn(false)
    setCurrentChat(0)
    setShowUserPanel(false)
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

  // 移除成员
  const handleRemoveMember = (memberId) => {
    alert(`已将成员 ${memberId} 移出群聊`)
    // 实际应用中需要调用 API 移除成员
  }

  // 会话数据
  const sessions = [
    {
      id: 0,
      title: '产品组讨论',
      avatar: '产',
      lastMessage: '你：下午把接口文档同步下',
      time: '14:32',
      badge: 2,
      online: 8,
      isGroup: true
    },
    {
      id: 1,
      title: '前端开发群',
      avatar: '前',
      lastMessage: 'Alice: 新版登录页我已经提 PR',
      time: '13:58',
      badge: 0,
      online: 12,
      isGroup: true
    },
    {
      id: 2,
      title: '项目日报机器人',
      avatar: '机',
      lastMessage: '17:30 自动提醒填写日报',
      time: '12:20',
      badge: 0,
      online: 0,
      isGroup: false
    },
    {
      id: 3,
      title: '家人群',
      avatar: '家',
      lastMessage: '妈妈：今晚回来吃饭吗？',
      time: '09:11',
      badge: 1,
      online: 5,
      isGroup: true
    }
  ]

  // 获取当前群主
  const getCurrentOwner = () => {
    const members = groupMembers[currentChat] || []
    const owner = members.find(m => m.role === 'owner')
    return owner ? owner.name : '未知'
  }

  // 未登录时显示登录界面
  if (!isLoggedIn) {
    // 如果显示注册表单
    if (showRegisterForm) {
      return (
        <div className="im-shell">
          <div className="login-container">
            <div className="register-box">
              <div className="register-header">
                <div className="brand-logo">
                  <span className="brand-dot"></span>
                  <h1>WhatTheDogDoing</h1>
                </div>
                <p className="register-subtitle">创建新账号</p>
              </div>
              
              <form className="register-form" onSubmit={handleRegister}>
                <div className="form-group">
                  <label htmlFor="username">用户名</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    placeholder="请输入用户名"
                    autoComplete="username"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="email">邮箱</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="请输入邮箱地址"
                    autoComplete="email"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="password">密码</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    placeholder="请输入密码（至少 6 位）"
                    autoComplete="new-password"
                    minLength="6"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="confirmPassword">确认密码</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="请再次输入密码"
                    autoComplete="new-password"
                    required
                  />
                </div>
                
                <div className="form-options">
                  <label className="checkbox-label">
                    <input type="checkbox" required />
                    <span>我已阅读并同意《用户协议》和《隐私政策》</span>
                  </label>
                </div>
                
                <button type="submit" className="register-btn">
                  立即注册
                </button>
                
                <div className="register-divider">
                  <span>已有账号？</span>
                </div>
                
                <button type="button" className="back-to-login-btn" onClick={backToLogin}>
                  返回登录
                </button>
              </form>
            </div>
            
            <div className="login-background">
              <div className="bg-circle bg-circle-1"></div>
              <div className="bg-circle bg-circle-2"></div>
              <div className="bg-circle bg-circle-3"></div>
            </div>
          </div>
        </div>
      )
    }
    
    // 否则显示登录表单
    return (
      <div className="im-shell">
        <div className="login-container">
          <div className="login-box">
            <div className="login-header">
              <div className="brand-logo">
                <span className="brand-dot"></span>
                <h1>WhatTheDogDoing</h1>
              </div>
              <p className="login-subtitle">即时通讯工具</p>
            </div>
            
            <form className="login-form" onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="account">账号</label>
                <input
                  type="text"
                  id="account"
                  name="account"
                  placeholder="邮箱 / 手机号"
                  autoComplete="username"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">密码</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
              </div>
              
              <div className="form-options">
                <label className="checkbox-label">
                  <input type="checkbox" />
                  <span>记住我</span>
                </label>
                <a href="#" className="forgot-link">忘记密码？</a>
              </div>
              
              <button type="submit" className="login-btn">
                登录
              </button>
              
              <div className="login-divider">
                <span>其他登录方式</span>
              </div>
              
              <div className="social-login">
                <button type="button" className="social-btn wechat">微信</button>
                <button type="button" className="social-btn qq">QQ</button>
              </div>
              
              <div className="login-footer">
                <p>还没有账号？<a href="#" onClick={(e) => { e.preventDefault(); showRegisterPage() }}>立即注册</a></p>
              </div>
            </form>
          </div>
          
          <div className="login-background">
            <div className="bg-circle bg-circle-1"></div>
            <div className="bg-circle bg-circle-2"></div>
            <div className="bg-circle bg-circle-3"></div>
          </div>
        </div>
      </div>
    )
  }

  // 已登录时显示聊天界面
  return (
    <div className={`im-shell ${isNightMode ? 'night-mode' : ''}`}>
      {/* 顶部导航栏 */}
      <header className="im-topbar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true"></span>
          <div>
            <p className="brand-title">WhatTheDogDoing</p>
            <p className="brand-sub">IM Workspace</p>
          </div>
        </div>
        <div className="topbar-actions">
          {/* 在线状态选择器 */}
          <div className="status-selector" onClick={() => setShowStatusMenu(!showStatusMenu)}>
            <span className="status-icon">{getStatusIcon(userStatus)}</span>
            <span className="status-text">{getStatusText(userStatus)}</span>
            <span className={`status-arrow ${showStatusMenu ? 'active' : ''}`}>›</span>
            
            {/* 状态选择菜单 */}
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
          {/* 用户头像 */}
          <div className="user-avatar-wrapper" onClick={toggleUserPanel}>
            {typeof userAvatar === 'string' && userAvatar.startsWith('data:image') ? (
              <div className="user-avatar" style={{backgroundImage: `url(${userAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center'}}>
              </div>
            ) : (
              <div className="user-avatar">
                <span>{userAvatar}</span>
              </div>
            )}
            <span className="user-status-dot"></span>
          </div>
        </div>
      </header>

      <main className="im-layout">
        {/* 左侧会话列表 */}
        <aside 
          className="panel chatlist-panel"
          style={{ width: `${chatlistWidth}px`, flex: 'none', '--chatlist-width': `${chatlistWidth}px` }}
        >
          <div className="panel-header">
            <h2>{activeTab === 'chats' ? '会话' : '好友'}</h2>
            <div className="header-actions">
              {/* 搜索按钮 */}
              <button 
                className={`icon-btn ${showSearch ? 'active' : ''}`} 
                type="button" 
                aria-label="搜索"
                onClick={() => setShowSearch(!showSearch)}
              >
                🔍
              </button>
              {activeTab === 'friends' && (
                <button 
                  className="icon-btn" 
                  type="button" 
                  aria-label="添加好友"
                  onClick={handleOpenAddFriend}
                >
                  ➕
                </button>
              )}
              <button className="icon-btn" type="button" aria-label="新建会话">
                ✎
              </button>
              <button className="icon-btn" type="button" aria-label="菜单">
                ⋯
              </button>
            </div>
          </div>
          
          {/* 会话列表内容 */}
          {activeTab === 'chats' && (
            <>
              {/* 搜索框（条件渲染） */}
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
                      <button 
                        className="search-clear-btn" 
                        type="button" 
                        aria-label="清空搜索"
                        onClick={handleClearSearch}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* 会话分类标签 */}
              <div className="session-tabs">
            <button 
              className={`tab-btn ${sessionFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSessionFilter('all')}
              type="button"
            >
              全部
            </button>
            <button 
              className={`tab-btn ${sessionFilter === 'personal' ? 'active' : ''}`}
              onClick={() => setSessionFilter('personal')}
              type="button"
            >
              个人
            </button>
            <button 
              className={`tab-btn ${sessionFilter === 'group' ? 'active' : ''}`}
              onClick={() => setSessionFilter('group')}
              type="button"
            >
              群聊
            </button>
          </div>
          
          {/* 会话列表 */}
          <ul className="session-list">
            {[...dynamicSessions, ...sessions]
              .filter(session => {
                // 先根据分类筛选
                if (sessionFilter === 'all') {
                  // 全部模式，继续搜索筛选
                } else if (sessionFilter === 'personal') {
                  if (session.isGroup) return false;
                } else if (sessionFilter === 'group') {
                  if (!session.isGroup) return false;
                }
                
                // 再根据搜索关键词筛选
                if (searchQuery.trim()) {
                  const query = searchQuery.toLowerCase();
                  const title = session.title.toLowerCase();
                  const lastMessage = session.lastMessage.toLowerCase();
                  // 搜索标题或最后一条消息
                  return title.includes(query) || lastMessage.includes(query);
                }
                
                return true;
              })
              .map((session) => (
              <li
                key={session.id}
                className={`session-item ${currentChat === session.id ? 'active' : ''}`}
                onClick={() => setCurrentChat(session.id)}
              >
                <div className="avatar">{session.avatar}</div>
                <div className="session-main">
                  <div className="session-row">
                    <p className="session-title">{session.title}</p>
                    <span className="session-time">{session.time}</span>
                  </div>
                  <div className="session-row">
                    <p className="session-meta">{session.lastMessage}</p>
                    {session.badge > 0 && (
                      <span className="session-badge">{session.badge}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
            </>
          )}
          
          {/* 好友列表内容 */}
          {activeTab === 'friends' && (
            <div className="friends-container">
              {myFriends.length > 0 ? (
                <div className="qq-friends-list">
                  {/* 按分组显示好友 */}
                  {customGroups.map((groupName) => {
                    const groupFriends = myFriends.filter(f => f.group === groupName)
                    if (groupFriends.length === 0) return null
                    
                    const isCollapsed = collapsedGroups.includes(groupName)
                    
                    return (
                      <div key={groupName} className="friends-group">
                        <div 
                          className="friends-group-header"
                          onClick={() => toggleGroupCollapse(groupName)}
                        >
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
                                onClick={() => {
                                  // 检查是否已存在该好友的会话
                                  const allSessions = [...sessions, ...dynamicSessions]
                                  const existingSession = allSessions.find(s => s.title === friend.name)
                                  
                                  if (!existingSession) {
                                    // 创建新会话
                                    const newSessionId = sessions.length + dynamicSessions.length
                                    const newSession = {
                                      id: newSessionId,
                                      title: friend.name,
                                      avatar: friend.avatar,
                                      lastMessage: friend.signature || '新联系人',
                                      time: '刚刚',
                                      badge: 0,
                                      online: friend.status === 'online' ? 1 : 0,
                                      isGroup: false
                                    }
                                    // 添加到动态会话列表（置于顶部）
                                    setDynamicSessions(prev => [newSession, ...prev])
                                    // 切换到新创建的会话
                                    setCurrentChat(newSessionId)
                                  } else {
                                    // 如果已存在，切换到该会话
                                    setCurrentChat(existingSession.id)
                                  }
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault()
                                  // 这里可以添加右键菜单逻辑
                                  console.log('右键菜单:', friend.name)
                                }}
                              >
                                <div className="qq-friend-avatar">
                                  {friend.avatar}
                                  <span className={`qq-status-dot ${friend.status}`}></span>
                                </div>
                                <div className="qq-friend-info">
                                  <div className="qq-friend-main">
                                    <p className="qq-friend-name">{friend.name}</p>
                                    <span className={`qq-status-icon ${friend.status}`}>
                                      {friend.status === 'online' ? '●' : 
                                       friend.status === 'busy' ? '●' : 
                                       friend.status === 'away' ? '●' : 
                                       friend.status === 'invisible' ? '●' : '○'}
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
        
          {/* 底部导航栏 */}
          <div className="bottom-tab-bar">
            <button 
              className={`tab-item ${activeTab === 'chats' ? 'active' : ''}`}
              onClick={() => setActiveTab('chats')}
            >
              <span className="tab-icon">💬</span>
              <span className="tab-label">会话</span>
            </button>
            <button 
              className={`tab-item ${activeTab === 'friends' ? 'active' : ''}`}
              onClick={() => setActiveTab('friends')}
            >
              <span className="tab-icon">👥</span>
              <span className="tab-label">好友</span>
            </button>
          </div>
        </aside>

        {/* 左侧会话列表和聊天窗口之间的拖拽分隔线 */}
        <div 
          className={`resize-handle ${isResizing ? 'resizing' : ''}`}
          onMouseDown={handleResizeStart}
        >
        </div>

        {/* 右侧聊天窗口 */}
        <section className="panel chat-panel">
          {/* 聊天头部 */}
          <header className="chat-topbar">
            <div className="chat-user">
              <div className="avatar large">
                {sessions[currentChat].avatar}
              </div>
              <div>
                <h2>{sessions[currentChat].title}</h2>
                {sessions[currentChat].online > 0 ? (
                  <span 
                    className="online-status clickable"
                    onClick={handleOnlineClick}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="online-dot"></span>
                    {sessions[currentChat].online}人在线
                  </span>
                ) : (
                  <span className="online-status">离线</span>
                )}
              </div>
            </div>
            <div className="chat-actions">
              <button className="icon-btn" type="button" aria-label="搜索消息">
                🔍
              </button>
              <button 
                className="icon-btn" 
                type="button" 
                aria-label="更多操作"
                onClick={handleOpenChatDetail}
              >
                ⋯
              </button>
            </div>
          </header>

          {/* 消息列表 */}
          <div className="chat-messages" onClick={handleMessagesClick}>
            {messages[currentChat]?.map((msg) => (
              <div
                key={msg.id}
                className={`message ${msg.sender === 'me' ? 'outgoing' : msg.sender === 'system' ? 'system-message' : 'incoming'}`}
                onContextMenu={(e) => handleMessageContextMenu(e, msg)}
              >
                {msg.sender !== 'me' && msg.sender !== 'system' && (
                  <div className="message-avatar">
                    {msg.sender === 'other' ? 'A' : '系'}
                  </div>
                )}
                <div className="message-content">
                  {/* 回复引用 */}
                  {msg.replyTo && (
                    <div className="message-reply">
                      <span className="reply-label">
                        {msg.replyTo.sender === 'me' ? '回复自己' : '回复'} {msg.replyTo.sender === 'other' ? '对方' : msg.replyTo.sender}:
                      </span>
                      <span className="reply-text">{msg.replyTo.text}</span>
                    </div>
                  )}
                  <div className="bubble">{msg.text}</div>
                  <span className="message-time">{msg.time}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 消息输入框 */}
          <footer className="composer" style={{ height: `${composerHeight}px` }}>
            {/* 回复提示栏 */}
            {replyToMessage && (
              <div className="reply-preview">
                <div className="reply-preview-content">
                  <span className="reply-preview-label">
                    {replyToMessage.sender === 'me' ? '回复自己' : '回复'} {replyToMessage.sender === 'other' ? '对方' : replyToMessage.sender}:
                  </span>
                  <span className="reply-preview-text">{replyToMessage.text}</span>
                </div>
                <button 
                  className="cancel-reply-btn" 
                  type="button" 
                  aria-label="取消回复"
                  onClick={cancelReply}
                >
                  ✕
                </button>
              </div>
            )}
            <div className="composer-toolbar">
              <button className="toolbar-btn" type="button" aria-label="发送图片">
                📷
              </button>
              <button className="toolbar-btn" type="button" aria-label="发送文件">
                📎
              </button>
              <button 
                className={`toolbar-btn ${showEmojiPicker ? 'active' : ''}`} 
                type="button" 
                aria-label="表情"
                onClick={toggleEmojiPicker}
              >
                😊
              </button>
            </div>
            <textarea
              className="composer-input"
              placeholder="输入消息... (Shift+Enter 换行)"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              rows="3"
            />
            <div className="composer-actions">
              <button className="send-btn" onClick={handleSendMessage}>
                发送
              </button>
            </div>
            {/* 输入框上边缘拖拽手柄 */}
            <div 
              className={`composer-resize-handle ${isComposingResizing ? 'resizing' : ''}`}
              onMouseDown={handleComposerResizeStart}
            >
            </div>
          </footer>
        </section>
      </main>

      {/* 表情选择器 */}
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
                <button
                  key={index}
                  className="emoji-item"
                  onClick={() => handleEmojiSelect(emoji)}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 消息右键菜单 */}
      {contextMenu && (
        <div 
          className="context-menu-overlay" 
          onClick={closeContextMenu}
        >
          <div 
            className="context-menu" 
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.canReply && (
              <button 
                className="context-menu-item" 
                onClick={handleReplyMessage}
                type="button"
              >
                <span className="menu-item-icon">↩️</span>
                <span className="menu-item-text">回复</span>
              </button>
            )}
            {contextMenu.canRevoke && (
              <>
                <button 
                  className="context-menu-item" 
                  onClick={handleEditMessage}
                  type="button"
                >
                  <span className="menu-item-icon">✏️</span>
                  <span className="menu-item-text">编辑</span>
                </button>
                <button 
                  className="context-menu-item revoke" 
                  onClick={handleRevokeMessage}
                  type="button"
                >
                  <span className="menu-item-icon">↩️</span>
                  <span className="menu-item-text">撤回</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 群成员管理模态框 */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={closeMemberModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{sessions[currentChat].title} - 群成员</h3>
              <button className="modal-close" onClick={closeMemberModal}>×</button>
            </div>
            
            {/* 群信息卡片 */}
            <div className="group-info-card">
              <div className="info-row">
                <span className="info-label">群主：</span>
                <span className="info-value">{getCurrentOwner()}</span>
              </div>
              <div className="info-row">
                <span className="info-label">我的角色：</span>
                <span className="info-value">
                  <span className={`role-badge role-${myRole[currentChat]}`}>
                    {myRole[currentChat] === 'owner' ? '群主' : myRole[currentChat] === 'admin' ? '管理员' : '普通成员'}
                  </span>
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">总人数：</span>
                <span className="info-value">{groupMembers[currentChat]?.length || 0}人</span>
              </div>
            </div>

            {/* 成员列表 */}
            <div className="member-list">
              {(groupMembers[currentChat] || []).map((member) => (
                <div key={member.id} className="member-item">
                  <div className="member-avatar">{member.avatar}</div>
                  <div className="member-info">
                    <div className="member-name">
                      {member.name}
                      <span className={`role-badge role-${member.role}`}>
                        {member.role === 'owner' ? '群主' : member.role === 'admin' ? '管理员' : '成员'}
                      </span>
                    </div>
                    <div className="member-status">
                      <span className={`online-indicator ${member.online ? 'online' : 'offline'}`}></span>
                      {member.online ? '在线' : '离线'}
                    </div>
                  </div>
                  {/* 管理操作按钮（仅群主可见） */}
                  {myRole[currentChat] === 'owner' && member.role === 'member' && (
                    <div className="member-actions">
                      <button 
                        className="action-btn make-admin"
                        onClick={() => handleMakeAdmin(member.id)}
                      >
                        任命管理员
                      </button>
                      <button 
                        className="action-btn remove-member"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        移出群聊
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 用户面板（类似 QQ 侧边栏） */}
      {showUserPanel && (
        <div className="user-panel-overlay" onClick={closeUserPanel}>
          <div className="user-panel" onClick={(e) => e.stopPropagation()}>
            {/* 用户信息卡片 */}
            <div className="user-panel-header">
              {typeof userAvatar === 'string' && userAvatar.startsWith('data:image') ? (
                <div className="user-panel-avatar" style={{backgroundImage: `url(${userAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center'}}>
                </div>
              ) : (
                <div className="user-panel-avatar">
                  <span>{userAvatar}</span>
                </div>
              )}
              <div className="user-panel-info">
                <h3>我的账号</h3>
                <div className="user-status-selector" onClick={() => setShowStatusMenu(!showStatusMenu)}>
                  <span className="user-status-icon">{getStatusIcon(userStatus)}</span>
                  <span className="user-status-text">{getStatusText(userStatus)}</span>
                  <span className={`user-status-arrow ${showStatusMenu ? 'active' : ''}`}>›</span>
                </div>
              </div>
            </div>

            {/* 功能菜单 */}
            <div className="user-panel-menu">
              <div className="menu-item" onClick={(e) => { e.stopPropagation(); handleOpenProfile(); }}>
                <span className="menu-icon">👤</span>
                <span className="menu-text">个人信息</span>
                <span className="menu-arrow">›</span>
              </div>
              <div className="menu-item" onClick={(e) => { e.stopPropagation(); handleAvatarChange(); }}>
                <span className="menu-icon">🖼️</span>
                <span className="menu-text">更换头像</span>
                <span className="menu-arrow">›</span>
              </div>
              <div className="menu-item">
                <span className="menu-icon">⚙️</span>
                <span className="menu-text">设置</span>
                <span className="menu-arrow">›</span>
              </div>
              <div className="menu-item" onClick={toggleNightMode}>
                <span className="menu-icon">{isNightMode ? '☀️' : '🌙'}</span>
                <span className="menu-text">{isNightMode ? '日间模式' : '夜间模式'}</span>
                <span className="menu-toggle">
                  <span className={`toggle-switch ${isNightMode ? 'active' : ''}`}></span>
                </span>
              </div>
              <div className="menu-item">
                <span className="menu-icon">🔔</span>
                <span className="menu-text">消息通知</span>
                <span className="menu-badge">3</span>
              </div>
              <div className="menu-item">
                <span className="menu-icon">📁</span>
                <span className="menu-text">文件管理</span>
                <span className="menu-arrow">›</span>
              </div>
              <div className="menu-item">
                <span className="menu-icon">❓</span>
                <span className="menu-text">帮助与反馈</span>
                <span className="menu-arrow">›</span>
              </div>
              <div className="menu-item">
                <span className="menu-icon">ℹ️</span>
                <span className="menu-text">关于我们</span>
                <span className="menu-arrow">›</span>
              </div>
            </div>

            {/* 底部退出登录 */}
            <div className="user-panel-footer">
              <button className="logout-btn" onClick={handleLogout}>
                <span className="logout-icon">🚪</span>
                退出登录
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 更换头像模态框 */}
      {showAvatarModal && (
        <div className="avatar-modal-overlay" onClick={handleAvatarCancel}>
          <div className="avatar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="avatar-modal-header">
              <h3>更换头像</h3>
              <button className="avatar-modal-close" onClick={handleAvatarCancel}>×</button>
            </div>
            
            <div className="avatar-modal-body">
              <div className="avatar-preview-container">
                <div className="avatar-preview">
                  {avatarPreview && (
                    <img src={avatarPreview} alt="预览头像" />
                  )}
                </div>
                <p className="avatar-preview-text">预览</p>
              </div>
              
              <div className="avatar-upload-hint">
                <p>支持 JPG、PNG、GIF 格式，建议尺寸 200x200 像素</p>
              </div>
            </div>
            
            <div className="avatar-modal-footer">
              <button className="avatar-cancel-btn" onClick={handleAvatarCancel}>
                取消
              </button>
              <button className="avatar-confirm-btn" onClick={handleAvatarConfirm}>
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 个人信息模态框 */}
      {showProfileModal && (
        <div className="profile-modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>个人信息</h3>
              <button className="profile-modal-close" onClick={() => setShowProfileModal(false)}>×</button>
            </div>
            
            <div className="profile-modal-body">
              {!isEditingProfile ? (
                // 查看模式
                <div className="profile-view">
                  <div className="profile-avatar-section">
                    {typeof userAvatar === 'string' && userAvatar.startsWith('data:image') ? (
                      <div className="profile-avatar" style={{backgroundImage: `url(${userAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center'}}>
                      </div>
                    ) : (
                      <div className="profile-avatar">
                        <span>{userAvatar}</span>
                      </div>
                    )}
                    <div className="profile-avatar-actions">
                      <button className="change-avatar-btn" onClick={() => { setShowProfileModal(false); handleAvatarChange(); }}>
                        更换头像
                      </button>
                    </div>
                  </div>
                  
                  <div className="profile-info-list">
                    <div className="profile-info-item">
                      <span className="info-label">在线状态：</span>
                      <select 
                        className="status-select"
                        value={userStatus}
                        onChange={(e) => handleChangeStatus(e.target.value)}
                      >
                        <option value="online">🟢 在线</option>
                        <option value="busy">🔴 忙碌</option>
                        <option value="away">🟡 离开</option>
                        <option value="invisible">🌙 隐身</option>
                        <option value="offline">⚫ 离线</option>
                      </select>
                    </div>
                    <div className="profile-info-item">
                      <span className="info-label">昵称：</span>
                      <span className="info-value">{profileData.nickname || '未设置'}</span>
                    </div>
                    <div className="profile-info-item">
                      <span className="info-label">性别：</span>
                      <span className="info-value">{profileData.gender === 'male' ? '男' : profileData.gender === 'female' ? '女' : '其他'}</span>
                    </div>
                    <div className="profile-info-item">
                      <span className="info-label">邮箱：</span>
                      <span className="info-value">{profileData.email || '未设置'}</span>
                    </div>
                    <div className="profile-info-item">
                      <span className="info-label">手机号：</span>
                      <span className="info-value">{profileData.phone || '未设置'}</span>
                    </div>
                    <div className="profile-info-item">
                      <span className="info-label">个人简介：</span>
                      <span className="info-value">{profileData.bio || '暂无简介'}</span>
                    </div>
                  </div>
                  
                  <button className="edit-profile-btn" onClick={handleEditProfile}>
                    编辑资料
                  </button>
                </div>
              ) : (
                // 编辑模式
                <div className="profile-edit-form">
                  <div className="form-group">
                    <label htmlFor="nickname">昵称</label>
                    <input
                      type="text"
                      id="nickname"
                      value={profileData.nickname}
                      onChange={(e) => handleProfileChange('nickname', e.target.value)}
                      placeholder="请输入昵称"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="gender">性别</label>
                    <select
                      id="gender"
                      value={profileData.gender}
                      onChange={(e) => handleProfileChange('gender', e.target.value)}
                    >
                      <option value="male">男</option>
                      <option value="female">女</option>
                      <option value="other">其他</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="email">邮箱</label>
                    <input
                      type="email"
                      id="email"
                      value={profileData.email}
                      onChange={(e) => handleProfileChange('email', e.target.value)}
                      placeholder="请输入邮箱地址"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="phone">手机号</label>
                    <input
                      type="tel"
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => handleProfileChange('phone', e.target.value)}
                      placeholder="请输入手机号"
                      pattern="[0-9]{11}"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="bio">个人简介</label>
                    <textarea
                      id="bio"
                      value={profileData.bio}
                      onChange={(e) => handleProfileChange('bio', e.target.value)}
                      placeholder="介绍一下自己吧..."
                      rows="4"
                    />
                  </div>
                  
                  <div className="profile-form-buttons">
                    <button className="cancel-btn" onClick={handleCancelProfile}>
                      取消
                    </button>
                    <button className="save-btn" onClick={handleSaveProfile}>
                      保存
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 聊天详情模态框 */}
      {showChatDetail && (
        <div className="chat-detail-overlay" onClick={handleCloseChatDetail}>
          <div className="chat-detail-panel" onClick={(e) => e.stopPropagation()}>
            <div className="chat-detail-header">
              <h3>聊天详情</h3>
              <button className="chat-detail-close" onClick={handleCloseChatDetail}>×</button>
            </div>
            
            <div className="chat-detail-content">
              {/* 群聊详情 */}
              {getCurrentSession().isGroup ? (
                <div className="group-chat-detail">
                  {/* 群头像和名称 */}
                  <div className="group-info-section">
                    <div className="group-avatar-large">
                      {getCurrentSession().avatar}
                    </div>
                    <h2 className="group-name">{getCurrentSession().title}</h2>
                    <p className="group-member-count">{getCurrentSession().online} 位成员</p>
                  </div>
                  
                  {/* 群公告 */}
                  <div className="detail-section">
                    <div className="section-title">群公告</div>
                    <div className="section-content">
                      <p>欢迎加入{getCurrentSession().title}！请遵守群规，文明交流。</p>
                    </div>
                  </div>
                  
                  {/* 群主信息 */}
                  <div className="detail-section">
                    <div className="section-title">群主</div>
                    <div className="section-content owner-info">
                      <div className="owner-avatar">{getCurrentOwner().charAt(0)}</div>
                      <div className="owner-info">
                        <div className="owner-name">{getCurrentOwner()}</div>
                        <div className="owner-role">群主</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 我在本群的昵称 */}
                  <div className="detail-section">
                    <div className="section-title">我在本群的昵称</div>
                    <div className="section-content">
                      <div className="my-nickname">
                        {profileData.nickname || '未设置'}
                        <button className="edit-nickname-btn">编辑</button>
                      </div>
                    </div>
                  </div>
                  
                  {/* 消息免打扰 */}
                  <div className="detail-section">
                    <div className="section-title">消息免打扰</div>
                    <div className="section-content">
                      <label className="toggle-switch-label">
                        <input type="checkbox" className="toggle-checkbox" />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                  
                  {/* 置顶聊天 */}
                  <div className="detail-section">
                    <div className="section-title">置顶聊天</div>
                    <div className="section-content">
                      <label className="toggle-switch-label">
                        <input type="checkbox" className="toggle-checkbox" />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                  
                  {/* 查找聊天记录 */}
                  <div className="detail-section clickable">
                    <div className="section-title">查找聊天记录</div>
                    <div className="section-content">
                      <span className="arrow-icon">›</span>
                    </div>
                  </div>
                  
                  {/* 成员列表预览 */}
                  <div className="detail-section">
                    <div className="section-title">成员</div>
                    <div className="section-content members-preview">
                      {groupMembers[currentChat]?.slice(0, 8).map((member, index) => (
                        <div key={index} className="member-avatar-small" title={member.name}>
                          {member.avatar}
                        </div>
                      ))}
                      <div className="view-all-members">+</div>
                    </div>
                  </div>
                </div>
              ) : (
                // 个人聊天详情
                <div className="personal-chat-detail">
                  {/* 用户头像和昵称 */}
                  <div className="personal-info-section">
                    <div className="personal-avatar-large">
                      {getCurrentSession().avatar}
                    </div>
                    <h2 className="personal-name">{getCurrentSession().title}</h2>
                    <p className="personal-status">{'🟢 在线'}</p>
                  </div>
                  
                  {/* 个人备注 */}
                  <div className="detail-section">
                    <div className="section-title">备注</div>
                    <div className="section-content">
                      <div className="remark-input">
                        {profileData.nickname || '未设置'}
                        <button className="edit-remark-btn">编辑</button>
                      </div>
                    </div>
                  </div>
                  
                  {/* 个人标签 */}
                  <div className="detail-section">
                    <div className="section-title">标签</div>
                    <div className="section-content">
                      <span className="tag-placeholder">未设置标签</span>
                      <span className="arrow-icon">›</span>
                    </div>
                  </div>
                  
                  {/* 发消息 */}
                  <div className="detail-section clickable">
                    <div className="section-title">发消息</div>
                    <div className="section-content">
                      <span className="arrow-icon">›</span>
                    </div>
                  </div>
                  
                  {/* 音视频通话 */}
                  <div className="detail-section clickable">
                    <div className="section-title">音视频通话</div>
                    <div className="section-content">
                      <span className="arrow-icon">›</span>
                    </div>
                  </div>
                  
                  {/* 查找聊天记录 */}
                  <div className="detail-section clickable">
                    <div className="section-title">查找聊天记录</div>
                    <div className="section-content">
                      <span className="arrow-icon">›</span>
                    </div>
                  </div>
                  
                  {/* 消息免打扰 */}
                  <div className="detail-section">
                    <div className="section-title">消息免打扰</div>
                    <div className="section-content">
                      <label className="toggle-switch-label">
                        <input type="checkbox" className="toggle-checkbox" />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                  
                  {/* 置顶聊天 */}
                  <div className="detail-section">
                    <div className="section-title">置顶聊天</div>
                    <div className="section-content">
                      <label className="toggle-switch-label">
                        <input type="checkbox" className="toggle-checkbox" />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                  
                  {/* 添加到黑名单 */}
                  <div className="detail-section">
                    <div className="section-title">添加到黑名单</div>
                    <div className="section-content">
                      <label className="toggle-switch-label">
                        <input type="checkbox" className="toggle-checkbox" />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                  
                  {/* 投诉 */}
                  <div className="detail-section clickable danger">
                    <div className="section-title">投诉</div>
                    <div className="section-content">
                      <span className="arrow-icon">›</span>
                    </div>
                  </div>
                  
                  {/* 删除好友 */}
                  <div className="detail-section clickable danger">
                    <div className="section-title">删除好友</div>
                    <div className="section-content" onClick={() => handleDeleteFriend(100)}>
                      <span className="arrow-icon">›</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 添加好友模态框 */}
      {showAddFriendModal && (
        <div className="add-friend-modal-overlay" onClick={handleCloseAddFriend}>
          <div className="add-friend-modal" onClick={(e) => e.stopPropagation()}>
            <div className="add-friend-modal-header">
              <h3>添加好友</h3>
              <button className="add-friend-modal-close" onClick={handleCloseAddFriend}>×</button>
            </div>
            
            <div className="add-friend-modal-body">
              {/* 搜索输入框 */}
              <div className="friend-search-section">
                <input
                  type="text"
                  className="friend-search-input"
                  placeholder="搜索用户名、昵称或微信号"
                  value={friendSearchQuery}
                  onChange={handleSearchFriend}
                  autoFocus
                />
              </div>
              
              {/* 搜索结果 */}
              {friendSearchQuery && (
                <div className="friend-search-results">
                  <div className="search-result-item">
                    <div className="result-avatar">A</div>
                    <div className="result-info">
                      <p className="result-name">Alice</p>
                      <p className="result-subtitle">微信号：alice123</p>
                    </div>
                    <button 
                      className="send-request-btn"
                      onClick={() => handleSendFriendRequest('alice123')}
                    >
                      添加
                    </button>
                  </div>
                  
                  <div className="search-result-item">
                    <div className="result-avatar">B</div>
                    <div className="result-info">
                      <p className="result-name">Bob</p>
                      <p className="result-subtitle">微信号：bob456</p>
                    </div>
                    <button 
                      className="send-request-btn"
                      onClick={() => handleSendFriendRequest('bob456')}
                    >
                      添加
                    </button>
                  </div>
                </div>
              )}
              
              {/* 好友请求列表 */}
              {friendRequestList.length > 0 && (
                <div className="friend-requests-section">
                  <h4>新的朋友 ({friendRequestList.length})</h4>
                  {friendRequestList.map((request) => (
                    <div key={request.id} className="request-item">
                      <div className="request-avatar">{request.avatar}</div>
                      <div className="request-info">
                        <p className="request-name">{request.name}</p>
                        <p className="request-message">想添加你为好友</p>
                      </div>
                      <div className="request-actions">
                        <button 
                          className="accept-btn"
                          onClick={() => handleAcceptRequest(request.id)}
                        >
                          接受
                        </button>
                        <button 
                          className="reject-btn"
                          onClick={() => handleRejectRequest(request.id)}
                        >
                          拒绝
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 我的好友列表 */}
              {myFriends.length > 0 && !friendSearchQuery && (
                <div className="my-friends-list-section">
                  <h4>我的好友 ({myFriends.length})</h4>
                  {myFriends.map((friend) => (
                    <div key={friend.id} className="friend-list-item">
                      <div className="friend-list-avatar">{friend.avatar}</div>
                      <div className="friend-list-info">
                        <p className="friend-list-name">{friend.name}</p>
                        <p className="friend-list-status">
                          {friend.status === 'online' ? '🟢 在线' : 
                           friend.status === 'busy' ? '🔴 忙碌' : 
                           friend.status === 'away' ? '🟡 离开' : 
                           friend.status === 'invisible' ? '🌙 隐身' : '⚫ 离线'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 提示文字 */}
              {!friendSearchQuery && friendRequestList.length === 0 && (
                <div className="add-friend-hint">
                  <p>在上方搜索框中输入用户的微信号、昵称或手机号</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
