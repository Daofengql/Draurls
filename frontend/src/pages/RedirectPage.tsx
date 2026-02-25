import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/services/api'

interface LinkInfo {
  url: string
}

export default function RedirectPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [message, setMessage] = useState('正在跳转...')

  useEffect(() => {
    if (!code) {
      setMessage('无效的短码')
      return
    }

    // 【前置逻辑说明】
    // 在开发环境中，前后端端口不同，前端需要通过 API 获取目标 URL 后进行跳转。
    // 在生产环境中，前后端同域时，这个路由一般不会被触发（后端 nginx 会直接拦截）。
    // 但为了开发体验和某些特殊场景（如需要统计点击的前端中间页），保留此实现。
    const fetchAndRedirect = async () => {
      try {
        // 调用后端 API 获取原始 URL（或触发统计）
        const response = await api.get<LinkInfo>(`/links/${code}`)

        if (response?.url) {
          // 使用 window.location.href 进行跳转（类似后端 302）
          window.location.href = response.url
        } else {
          setMessage(`短码 ${code} 不存在`)
        }
      } catch (err) {
        console.error('Redirect error:', err)
        // 可能是 404，说明短码不存在
        setMessage(`短码 ${code} 不存在或已失效`)
        // 3秒后返回首页
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 3000)
      }
    }

    fetchAndRedirect()
  }, [code, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}
