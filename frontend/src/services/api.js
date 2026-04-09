 import axios from 'axios'

// frontend/src/services/api.js
const apiClient = axios.create({
  baseURL: 'https://backend-dyno-whatthedogdoing.app.spring26b.secoder.net',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

export function setAuthToken(token) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + token
    try {
      localStorage.setItem('auth_token', token)
    } catch (e) {
      // ignore
    }
  } else {
    delete apiClient.defaults.headers.common['Authorization']
    try {
      localStorage.removeItem('auth_token')
    } catch (e) {
      // ignore
    }
  }
}

// 自动从 localStorage 恢复 token
try {
  const _t = localStorage.getItem('auth_token')
  if (_t) setAuthToken(_t)
} catch (e) {
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
  const { confirmPassword, ...rest } = payload
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

export async function addFriend(friendId) {
  const res = await apiClient.post('/api/chat/friends/add', {
    friend_id: friendId,
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

export async function sendChatMessage(conversationId, content) {
  const res = await apiClient.post('/api/chat/messages/send', {
    conversation_id: conversationId,
    content,
  })
  return res.data
}

export function logout() {
  setAuthToken(null)
}

export function getAuthToken() {
  try {
    return localStorage.getItem('auth_token')
  } catch (e) {
    return null
  }
}

export default apiClient
