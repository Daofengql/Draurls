import { create } from 'zustand'
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

  checkAuth: async () => {
    const state = get()
    const token = localStorage.getItem('access_token')

    // 如果已经初始化且有用户信息，直接返回
    if (state.isInitialized && state.user && state.isAuthenticated) {
      return true
    }

    set({ isLoading: true })

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
        credentials: 'include',
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.code === 0 && data.data) {
          set({
            user: data.data,
            token: token,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          })
          return true
        }
      }
      // 认证失败
      localStorage.removeItem('access_token')
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      })
      return false
    } catch {
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
