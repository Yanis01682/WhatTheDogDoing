// src/services/api.js
import axios from 'axios';

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api', // 根据后端实际地址修改
  timeout: 5000,
});

// 请求拦截器：在每次请求前附加 token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // 或者从全局状态获取
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：统一处理错误
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// 封装接口函数
export const login = async (username, password) => {
  return apiClient.post('/login', { username, password });
};

export const register = async (userData) => {
  return apiClient.post('/register', userData);
};

export const getUserInfo = async () => {
  return apiClient.get('/user');
};

// 其他接口可以继续在这里扩展
