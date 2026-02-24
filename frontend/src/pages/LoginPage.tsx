import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { authService } from '@/services/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    try {
      const success = await authService.loginWithPopup()

      if (success) {
        // 登录成功，从 Cookie 获取 Token（由于是 HttpOnly Cookie，需要后端 API 配合）
        // 这里我们直接通过获取用户信息来验证
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/user/profile`, {
          credentials: 'include', // 发送 Cookie
        })

        if (response.ok) {
          const data = await response.json()
          // 临时从后端获取 token（如果后端支持在响应中返回）
          // 或者直接设置认证状态，依靠 Cookie 认证
          setAuth(
            {
              id: data.data.id,
              keycloak_id: data.data.keycloak_id,
              username: data.data.username,
              email: data.data.email,
              role: data.data.role,
              quota: data.data.quota,
              quota_used: data.data.quota_used,
              status: data.data.status,
              created_at: data.data.created_at,
              updated_at: data.data.updated_at,
            },
            data.data.access_token || 'cookie-auth',
          )
          navigate('/dashboard')
        } else {
          setError('获取用户信息失败，请重新登录')
        }
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
        <h1 className="text-2xl font-bold text-center mb-2">Surls 短链接服务</h1>
        <p className="text-gray-500 text-center mb-6">使用 Keycloak 账号登录</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4 text-sm">
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

        <div className="mt-4 text-center text-sm text-gray-400">
          <p>登录将打开新窗口，请允许弹窗</p>
        </div>
      </div>
    </div>
  )
}
