import { create } from 'zustand'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
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
    // 如果已经有 token，检查是否有效
    const state = get()
    if (state.token && state.isAuthenticated) {
      return true
    }

    // 没有 token，尝试通过 Cookie 认证获取用户信息
    set({ isLoading: true })
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
      const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.code === 0 && data.data) {
          set({
            user: data.data,
            isAuthenticated: true,
            isLoading: false,
          })
          return true
        }
      }
      set({ isAuthenticated: false, isLoading: false })
      return false
    } catch {
      set({ isAuthenticated: false, isLoading: false })
      return false
    }
  },
}))
