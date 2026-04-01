import axios from 'axios'

// frontend/src/services/api.js
const apiClient = axios.create({
  // 把原来的 http://localhost:8000 改成你的后端域名
  baseURL: 'http://backend-dyno-WhatTheDogDoing.app.spring26b.secoder.net',
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
  const res = await apiClient.post('/auth/register', payload)
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
