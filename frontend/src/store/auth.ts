import { create } from 'zustand'
import api from '@/services/api'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean // 新增：标记是否已完成初始化检查
  setAuth: (user: User, token?: string) => void
  setUser: (user: User) => void
  clearAuth: () => void
  logout: () => Promise<void> // 新增：完整的退出登录
  checkAuth: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('access_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  isInitialized: false, // 初始化时设为 false

  setAuth: (user, token) => {
    if (token) {
      localStorage.setItem('access_token', token)
    }
    set({ user, token: token || null, isAuthenticated: true })
  },

  setUser: (user) => {
    set({ user, isAuthenticated: true })
  },

  clearAuth: () => {
    localStorage.removeItem('access_token')
    set({ user: null, token: null, isAuthenticated: false })
  },

  // 完整的退出登录：调用后端清除 HttpOnly Cookie
  logout: async () => {
    try {
      // 调用后端登出接口（后端会清除 HttpOnly Cookie 并调用 Keycloak logout）
      // 注意：后端会从 Cookie 中读取 refresh_token，无需前端传递
      await api.post('/auth/logout', {})
    } catch (error) {
      // 即使后端调用失败，也继续清理本地状态
      console.warn('Backend logout failed:', error)
    } finally {
      // 清理本地状态
      localStorage.removeItem('access_token')
      set({ user: null, token: null, isAuthenticated: false, isInitialized: false })
      // 跳转到登录页
      window.location.href = '/login'
    }
  },

  checkAuth: async () => {
    const state = get()

    // 如果已经初始化且有用户信息，直接返回
    if (state.isInitialized && state.user && state.isAuthenticated) {
      return true
    }

    set({ isLoading: true })

    try {
      // 使用共享的 axios 实例，复用全局拦截器和 API_BASE_URL 配置
      const data = await api.get<User>('/user/profile')

      set({
        user: data,
        token: localStorage.getItem('access_token'),
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
      })
      return true
    } catch (error) {
      // 认证失败，清除本地状态
      // 注意：401 重定向已由全局拦截器处理
      localStorage.removeItem('access_token')
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      })
      return false
    }
  },
}))
