import axios from 'axios'

// frontend/src/services/api.js
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
  (err) => Promise.reject(err)
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

export async function getSessions() {
  const res = await apiClient.get('/api/chat/sessions')
  return res.data
}

export async function getMessages(conversationId) {
  const res = await apiClient.get(`/api/chat/sessions/${conversationId}/messages`)
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

export async function sendChatMessage(conversationId, content, replyToId) {
  const payload = { conversation_id: conversationId, content }
  if (replyToId) payload.reply_to_id = replyToId
  const res = await apiClient.post('/api/chat/messages/send', payload)
  return res.data
}

export async function revokeMessage(messageId) {
  const res = await apiClient.delete(`/api/chat/messages/${messageId}`)
  return res.data
}

export function logout() {
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
