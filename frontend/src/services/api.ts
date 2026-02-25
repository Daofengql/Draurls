import axios, { AxiosError } from 'axios'
import type { ApiResponse } from '@/types'

// 【前置逻辑说明】
// 开发环境：使用 Vite proxy，API_BASE_URL 为空字符串
// 生产环境（同域）：API_BASE_URL 为空字符串，请求相对路径
// 生产环境（跨域）：通过 VITE_API_URL 环境变量指定完整的 API 地址
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// 扩展 axios 类型以支持我们的响应拦截器
declare module 'axios' {
  interface AxiosInstance {
    get<T = any, D = any, R = T>(url: string, config?: D): Promise<R>
    delete<T = any, D = any, R = T>(url: string, config?: D): Promise<R>
    head<T = any, D = any, R = T>(url: string, config?: D): Promise<R>
    options<T = any, D = any, R = T>(url: string, config?: D): Promise<R>
    post<T = any, D = any, R = T>(url: string, data?: D, config?: D): Promise<R>
    put<T = any, D = any, R = T>(url: string, data?: D, config?: D): Promise<R>
    patch<T = any, D = any, R = T>(url: string, data?: D, config?: D): Promise<R>
  }
}

const api = axios.create({
  baseURL: API_BASE_URL ? `${API_BASE_URL}/api` : '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器
api.interceptors.response.use(
  (response): any => {
    // 后端返回格式: { code: 0, message: "success", data: ... }
    // 【前置逻辑说明】
    // 只要后端返回的 code 为 0，就代表业务逻辑处理成功。
    // 有些接口（如删除、修改状态）可能没有具体的 data 返回，此时不能因为没有 data 就抛出错误。
    const res = response.data as ApiResponse
    if (res.code === 0) {
      // 如果后端没有返回 data，给一个默认的 true，防止后续解构报错
      return res.data !== undefined ? res.data : true
    }
    // 明确判定失败的逻辑
    return Promise.reject({
      code: res.code || -1,
      message: res.message || '请求失败',
    })
  },
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      // Token过期，跳转登录
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    // 返回标准化的错误格式
    const errorData = error.response?.data
    if (errorData && typeof errorData === 'object' && 'code' in errorData) {
      // 是后端的错误响应格式
      return Promise.reject(errorData)
    }
    // 其他错误，包装成统一格式
    return Promise.reject({
      code: -1,
      message: error.message || '网络请求失败',
    })
  }
)

export default api
