import axios from 'axios'

// Use relative base URL so requests go through nginx in production
// and through vite proxy in development
const apiClient = axios.create({
  baseURL: '',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

export function setAuthToken(token) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + token
    try {
      localStorage.setItem('auth_token', token)
    } catch {
      // ignore
    }
  } else {
    delete apiClient.defaults.headers.common['Authorization']
    try {
      localStorage.removeItem('auth_token')
    } catch {
      // ignore
    }
  }
}

// 自动从 localStorage 恢复 token
try {
  const _t = localStorage.getItem('auth_token')
  if (_t) setAuthToken(_t)
} catch {
  // ignore
}

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    // 详细错误日志
    if (err.response) {
      console.error('API Error:', {
        status: err.response.status,
        data: err.response.data,
        url: err.config?.url,
        method: err.config?.method
      })
      // 返回更友好的错误信息
      const message = err.response.data?.detail || err.response.data?.message || `请求失败 (${err.response.status})`
      err.message = message
    } else if (err.request) {
      console.error('Network Error:', err.message)
      err.message = '网络连接失败，请检查后端服务是否运行'
    } else {
      console.error('Error:', err.message)
    }
    return Promise.reject(err)
  }
)

export async function login({ username, password }) {
  const params = new URLSearchParams()
  params.append('username', username)
  params.append('password', password)
  const res = await apiClient.post('/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  const data = res.data
  const token = data.access_token || data.token
  if (token) setAuthToken(token)
  return data
}

export async function register(payload) {
  // 移除前端特有字段（如 confirmPassword），避免后端 Pydantic 校验 422 报错
  const { confirmPassword: _confirmPassword, ...rest } = payload
  const res = await apiClient.post('/auth/register', rest)
  return res.data
}

export async function getCurrentUser() {
  try {
    const res = await apiClient.get('/auth/me')
    return res.data
  } catch (err) {
    if (err.response && err.response.status === 401) return null
    throw err
  }
}

export async function changePassword(oldPassword, newPassword) {
  const res = await apiClient.put('/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword,
  })
  return res.data
}

export async function deleteMyAccount() {
  const res = await apiClient.delete('/api/users/me')
  return res.data
}

export async function updateStatus(status) {
  const res = await apiClient.put('/auth/status', {
    status: status,
  })
  return res.data
}

export async function searchUsers(query) {
  const keyword = query.trim()
  if (!keyword) return []
  const res = await apiClient.get('/api/chat/users/search', {
    params: { q: keyword },
  })
  return res.data
}

export async function getFriends() {
  const res = await apiClient.get('/api/chat/friends')
  return res.data
}

export async function getFriendRequests() {
  const res = await apiClient.get('/api/chat/friends/requests')
  return res.data
}

export async function sendFriendRequest(friendId) {
  const res = await apiClient.post('/api/chat/friends/requests', {
    friend_id: friendId,
  })
  return res.data
}

export async function acceptFriendRequest(requestId) {
  const res = await apiClient.post(`/api/chat/friends/requests/${requestId}/accept`)
  return res.data
}

export async function rejectFriendRequest(requestId) {
  const res = await apiClient.post(`/api/chat/friends/requests/${requestId}/reject`)
  return res.data
}

export async function addFriend(friendId) {
  const res = await apiClient.post('/api/chat/friends/add', {
    friend_id: friendId,
  })
  return res.data
}

export async function deleteFriend(friendId) {
  const res = await apiClient.delete(`/api/chat/friends/${friendId}`)
  return res.data
}

export async function updateFriendRemark(friendId, remark) {
  const res = await apiClient.put(`/api/chat/friends/${friendId}/remark`, {
    remark: remark,
  })
  return res.data
}

export async function updateFriendGroup(friendId, groupName) {
  const res = await apiClient.put(`/api/chat/friends/${friendId}/group`, {
    group_name: groupName,
  })
  return res.data
}

export async function getSessions() {
  const res = await apiClient.get('/api/chat/sessions')
  return res.data
}

export async function getMessages(conversationId) {
  const res = await apiClient.get(`/api/chat/sessions/${conversationId}/messages`)
  return res.data
}

export async function pinChatSession(conversationId) {
  const res = await apiClient.post(`/api/chat/sessions/${conversationId}/pin`)
  return res.data
}

export async function unpinChatSession(conversationId) {
  const res = await apiClient.delete(`/api/chat/sessions/${conversationId}/pin`)
  return res.data
}

export async function updateSessionMute(conversationId, muted) {
  const res = await apiClient.put(`/api/chat/sessions/${conversationId}/mute`, {
    muted,
  })
  return res.data
}

export async function getNotes() {
  const res = await apiClient.get('/api/chat/notes')
  return res.data
}

export async function createNote(payload) {
  const res = await apiClient.post('/api/chat/notes', payload)
  return res.data
}

export async function updateNote(noteId, payload) {
  const res = await apiClient.put(`/api/chat/notes/${noteId}`, payload)
  return res.data
}

export async function deleteNote(noteId) {
  const res = await apiClient.delete(`/api/chat/notes/${noteId}`)
  return res.data
}

export async function createGroup(name, memberIds) {
  const res = await apiClient.post('/api/chat/groups', {
    name,
    member_ids: memberIds,
  })
  return res.data
}

export async function getGroupMembers(conversationId) {
  const res = await apiClient.get(`/api/chat/groups/${conversationId}/members`)
  return res.data
}

export async function renameGroup(conversationId, name) {
  const res = await apiClient.put(`/api/chat/groups/${conversationId}`, { name })
  return res.data
}

export async function exitGroup(conversationId) {
  const res = await apiClient.post(`/api/chat/groups/${conversationId}/exit`)
  return res.data
}

export async function dismissGroup(conversationId) {
  const res = await apiClient.delete(`/api/chat/groups/${conversationId}`)
  return res.data
}

export async function inviteGroupMembers(conversationId, memberIds) {
  const res = await apiClient.post(`/api/chat/groups/${conversationId}/invite`, {
    member_ids: memberIds,
  })
  return res.data
}

export async function createGroupInviteRequest(conversationId, inviteeId) {
  const res = await apiClient.post(`/api/chat/groups/${conversationId}/invite-requests`, {
    invitee_id: inviteeId,
  })
  return res.data
}

export async function getGroupInviteRequests() {
  const res = await apiClient.get('/api/chat/groups/invite-requests')
  return res.data
}

export async function approveGroupInviteRequest(requestId) {
  const res = await apiClient.post(`/api/chat/groups/invite-requests/${requestId}/approve`)
  return res.data
}

export async function rejectGroupInviteRequest(requestId) {
  const res = await apiClient.post(`/api/chat/groups/invite-requests/${requestId}/reject`)
  return res.data
}

export async function getGroupAnnouncements(conversationId) {
  const res = await apiClient.get(`/api/chat/groups/${conversationId}/announcements`)
  return res.data
}

export async function publishGroupAnnouncement(conversationId, content) {
  const res = await apiClient.post(`/api/chat/groups/${conversationId}/announcements`, { content })
  return res.data
}

export async function getUnconfirmedAnnouncements(conversationId) {
  const res = await apiClient.get(`/api/chat/groups/${conversationId}/announcements/unconfirmed`)
  return res.data
}

export async function confirmAnnouncement(conversationId, announcementId) {
  const res = await apiClient.post(`/api/chat/groups/${conversationId}/announcements/${announcementId}/confirm`)
  return res.data
}

export async function sendChatMessage(conversationId, content, replyToId) {
  const payload = { conversation_id: conversationId, content }
  if (replyToId) payload.reply_to_id = replyToId
  const res = await apiClient.post('/api/chat/messages/send', payload)
  return res.data
}

export async function sendForwardMessage(conversationId, forwardTitle, forwardMessages) {
  const payload = {
    conversation_id: conversationId,
    forward_title: forwardTitle,
    forward_messages: forwardMessages,
  }
  const res = await apiClient.post('/api/chat/messages/send-forward', payload)
  return res.data
}

export async function sendImageMessage(conversationId, file, replyToId = null) {
  const formData = new FormData()
  formData.append('file', file)
  
  const params = { conversation_id: conversationId }
  if (replyToId) params.reply_to_id = replyToId
  
  const res = await apiClient.post('/api/chat/messages/send-image', formData, {
    params,
    headers: { 'Content-Type': undefined },
  })
  return res.data
}

export async function sendVideoMessage(conversationId, file, replyToId = null) {
  const formData = new FormData()
  formData.append('file', file)
  
  const params = { conversation_id: conversationId }
  if (replyToId) params.reply_to_id = replyToId
  
  const res = await apiClient.post('/api/chat/messages/send-video', formData, {
    params,
    timeout: 120000,
    headers: { 'Content-Type': undefined },
  })
  return res.data
}

export async function sendFileMessage(conversationId, file, replyToId = null) {
  const formData = new FormData()
  formData.append('file', file)
  const params = { conversation_id: conversationId }
  if (replyToId) params.reply_to_id = replyToId
  const res = await apiClient.post('/api/chat/messages/send-file', formData, {
    params,
    timeout: 60000,
    headers: { 'Content-Type': undefined },
  })
  return res.data
}

export async function sendVoiceMessage(conversationId, file, replyToId = null) {
  const formData = new FormData()
  formData.append('file', file)
  const params = { conversation_id: conversationId }
  if (replyToId) params.reply_to_id = replyToId
  const res = await apiClient.post('/api/chat/messages/send-voice', formData, { params, headers: { 'Content-Type': undefined } })
  return res.data
}

export async function revokeMessage(messageId) {
  const res = await apiClient.delete(`/api/chat/messages/${messageId}`)
  return res.data
}

export async function transferGroupOwnership(conversationId, newOwnerId) {
  const res = await apiClient.post(`/api/chat/groups/${conversationId}/transfer`, { new_owner_id: newOwnerId })
  return res.data
}

export async function kickGroupMember(conversationId, userId) {
  const res = await apiClient.post(`/api/chat/groups/${conversationId}/kick`, { user_id: userId })
  return res.data
}

export async function setGroupAdmin(conversationId, userId, isAdmin) {
  const res = await apiClient.put(`/api/chat/groups/${conversationId}/admin`, { user_id: userId, is_admin: isAdmin })
  return res.data
}

export async function updateGroupNickname(conversationId, nickname) {
  const res = await apiClient.put(`/api/chat/groups/${conversationId}/nickname`, { nickname })
  return res.data
}

export async function logout() {
  try {
    await apiClient.post('/auth/logout')
  } catch {
    // 忽略错误，继续清除本地状态
  }
  setAuthToken(null)
}

export function getAuthToken() {
  try {
    return localStorage.getItem('auth_token')
  } catch {
    return null
  }
}

export default apiClient

export async function getProfile() {
  const res = await apiClient.get('/auth/profile')
  return res.data
}

export async function updateProfile(payload) {
  const res = await apiClient.put('/auth/profile', payload)
  return res.data
}

export async function updateSensitiveInfo(payload) {
  const res = await apiClient.post('/auth/profile/sensitive', payload)
  return res.data
}
