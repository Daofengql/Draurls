import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { authService } from '@/services/auth'
import { usersService } from '@/services/users'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const setUser = useAuthStore((state) => state.setUser)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    try {
      // 获取登录 URL 并打开弹窗
      const success = await authService.loginWithPopup()

      if (success) {
        // 登录成功，先获取用户信息
        setTimeout(async () => {
          try {
            // 获取真实用户信息
            const userData = await usersService.getProfile()
            if (userData) {
              setUser(userData)
              navigate('/dashboard')
            } else {
              // 【前置逻辑说明】
              // 如果获取不到用户数据，说明登录流程并未真正完成，或者后端的 Token 验证失败。
              // 此时绝对不能伪造数据放行，必须抛出错误并清理可能残留的登录态。
              throw new Error('无法获取用户信息，请重新登录')
            }
          } catch (err) {
            console.error('获取用户信息失败:', err)
            // 清理残留状态
            useAuthStore.getState().clearAuth()
            setError('获取用户信息失败，请重试')
          }
        }, 500)
      } else {
        setError('登录已取消')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Surls 短链接服务</h1>
        <p className="text-gray-500 text-center mb-6">使用 Keycloak 账号登录</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full btn btn-primary"
        >
          {loading ? '登录中...' : '登录'}
        </button>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>点击登录按钮将打开新窗口</p>
          <p>登录成功后将自动跳转</p>
        </div>
      </div>
    </div>
  )
}
