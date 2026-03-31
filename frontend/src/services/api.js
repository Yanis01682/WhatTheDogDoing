import axios from 'axios'

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

export function setAuthToken(token) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = \`Bearer \${token}\`
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

// 自动从 localStorage 恢复 token（页面刷新时使用）
try {
  const _t = localStorage.getItem('auth_token')
  if (_t) setAuthToken(_t)
} catch (e) {
  // ignore
}

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    // 统一错误处理点，可扩展 401 自动刷新逻辑
    return Promise.reject(err)
  }
)

export async function login({ username, password }) {
  try {
    // FastAPI OAuth2PasswordRequestForm expects form-encoded data
    const params = new URLSearchParams()
    params.append('username', username)
    params.append('password', password)
    const res = await apiClient.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const data = res.data
    const token = data.token || data.access_token || data.accessToken
    if (token) setAuthToken(token)
    return data
  } catch (err) {
    // 规范错误抛出，组件层方便显示错误信息
    const message = err.response?.data?.detail || err.response?.data?.message || err.message || '登录失败'
    throw new Error(message)
  }
}

export async function register(payload) {
  try {
    const res = await apiClient.post('/auth/register', payload)
    const data = res.data
    // 如果注册同时返回 token，则自动设置
    const token = data.token || data.access_token || data.accessToken
    if (token) setAuthToken(token)
    return data
  } catch (err) {
    const message = err.response?.data?.detail || err.response?.data?.message || err.message || '注册失败'
    throw new Error(message)
  }
}

export async function getCurrentUser() {
  try {
    const res = await apiClient.get('/auth/me')
    return res.data
  } catch (err) {
    // 如果未认证或 token 无效，返回 null 让调用方处理
    if (err.response && err.response.status === 401) return null
    const message = err.response?.data?.detail || err.response?.data?.message || err.message || '获取用户信息失败'
    throw new Error(message)
  }
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

export function isAuthenticated() {
  return !!getAuthToken()
}

export default apiClient
