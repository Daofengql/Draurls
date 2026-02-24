import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// 从 Cookie 读取 token 的辅助函数
const getCookie = (name: string): string => {
  const value = '; ' + document.cookie
  const parts = value.split('; ' + name + '=')
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || ''
  }
  return ''
}

export default function TokenPage() {
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [userInfo, setUserInfo] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 从 Cookie 读取 token
    const accessToken = getCookie('access_token')
    setToken(accessToken)

    if (!accessToken) {
      navigate('/login')
      return
    }

    // 获取用户信息
    fetch('http://localhost:8080/api/user/profile', {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        console.log('用户信息:', data)
        if (data.code === 0) {
          setUserInfo(data.data)
        } else {
          console.error('获取用户信息失败:', data)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('请求失败:', err)
        setLoading(false)
      })
  }, [navigate])

  const handleCopy = () => {
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogout = async () => {
    // 调用登出接口
    const refreshToken = getCookie('refresh_token')
    await fetch('http://localhost:8080/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        refresh_token: refreshToken,
        redirect_to: window.location.origin,
      }),
    })
    // 清除本地 Cookie 并跳转
    document.cookie = 'access_token=; path=/; max-age=0'
    document.cookie = 'refresh_token=; path=/; max-age=0'
    window.location.href = '/login'
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="card">
          <h1 className="text-2xl font-bold mb-6">Token 信息</h1>

          <div className="space-y-4">
            {/* 用户信息 */}
            {userInfo && (
              <div>
                <label className="label">用户信息</label>
                <div className="mt-1 p-4 bg-gray-50 rounded border">
                  {/* 头像 */}
                  {userInfo.Picture || userInfo.picture ? (
                    <div className="mb-4">
                      <img
                        src={userInfo.Picture || userInfo.picture}
                        alt="头像"
                        className="w-16 h-16 rounded-full"
                      />
                    </div>
                  ) : null}
                  <p><strong>ID:</strong> {userInfo.ID || userInfo.id}</p>
                  <p><strong>Keycloak ID:</strong> {userInfo.KeycloakID || userInfo.keycloak_id}</p>
                  <p><strong>用户名:</strong> {userInfo.Username || userInfo.username}</p>
                  {userInfo.Nickname || userInfo.nickname ? (
                    <p><strong>昵称:</strong> {userInfo.Nickname || userInfo.nickname}</p>
                  ) : null}
                  <p><strong>邮箱:</strong> {userInfo.Email || userInfo.email}</p>
                  <p><strong>角色:</strong> {userInfo.Role || userInfo.role}</p>
                  <p><strong>配额:</strong> {(userInfo.Quota || userInfo.quota) === -1 ? '无限制' : (userInfo.Quota || userInfo.quota)}</p>
                  <p><strong>已用:</strong> {userInfo.QuotaUsed || userInfo.quota_used}</p>
                  <p><strong>状态:</strong> {userInfo.Status || userInfo.status}</p>
                </div>
              </div>
            )}

            {/* Token 显示 */}
            <div>
              <label className="label">Access Token</label>
              <div className="mt-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={token}
                    className="input flex-1 font-mono text-sm"
                  />
                  <button onClick={handleCopy} className="btn btn-secondary">
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Token 长度: {token.length} 字符
                </p>
              </div>
            </div>

            {/* curl 示例 */}
            <div>
              <label className="label">cURL 示例</label>
              <div className="mt-1 p-4 bg-gray-900 rounded text-green-400 text-sm overflow-x-auto">
                <pre>curl http://localhost:8080/api/links \</pre>
                <pre>  -H "Authorization: Bearer YOUR_TOKEN" \</pre>
                <pre>  -H "Content-Type: application/json" \</pre>
                <pre>{'  -d \'{"url":"https://example.com"}\''}</pre>
              </div>
            </div>

            {/* Postman 配置 */}
            <div>
              <label className="label">Postman 配置</label>
              <div className="mt-1 p-4 bg-blue-50 rounded border border-blue-200 text-sm">
                <p className="mb-2"><strong>方式 1: Authorization Header</strong></p>
                <p className="ml-4">Key: <code>Authorization</code></p>
                <p className="ml-4">Value: <code>Bearer {token.substring(0, 30)}...</code></p>
                <p className="mt-2"><strong>方式 2: Cookie</strong></p>
                <p className="ml-4">Key: <code>access_token</code></p>
                <p className="ml-4">Value: <code>{token.substring(0, 30)}...</code></p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
              返回首页
            </button>
            <button onClick={handleLogout} className="btn btn-outline">
              退出登录
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
