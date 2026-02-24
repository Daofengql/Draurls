import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleLogin = () => {
    setLoading(true)
    // TODO: 实现Keycloak登录
    // 暂时模拟登录
    setTimeout(() => {
      setLoading(false)
      navigate('/')
    }, 1000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Surls 短链接服务</h1>
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full btn btn-primary"
        >
          {loading ? '登录中...' : '使用 Keycloak 登录'}
        </button>
      </div>
    </div>
  )
}
