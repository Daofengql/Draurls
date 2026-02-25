import { useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { usersService } from '@/services/users'

const navItems = [
  { path: '/dashboard', label: '仪表盘' },
  { path: '/links', label: '我的链接' },
  { path: '/api-keys', label: 'API密钥' },
  { path: '/token', label: 'Token' },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, setUser, clearAuth } = useAuthStore()
  const isAdmin = user?.Role === 'admin'

  // 显示名称：优先使用 nickname，其次 username
  const displayName = user?.Nickname || user?.Username

  // 如果没有用户信息，尝试获取
  useEffect(() => {
    if (!user || !user.Username) {
      usersService.getProfile()
        .then((userData) => {
          if (userData) {
            setUser(userData)
          }
        })
        .catch(() => {
          // 获取失败，可能认证已过期
          clearAuth()
          navigate('/login')
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-blue-600">Surls</h1>
              <nav className="flex space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      location.pathname === item.path
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    to="/admin"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      location.pathname.startsWith('/admin')
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    管理后台
                  </Link>
                )}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              {/* 头像 */}
              {user?.Picture ? (
                <img
                  src={user.Picture}
                  alt={displayName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                  {displayName?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <span className="text-sm text-gray-700">
                {displayName || '加载中...'}
                {user && user.Quota !== undefined && (
                  <span className="ml-2 text-xs text-gray-500">
                    配额: {user?.Quota === -1 ? '无限' : `${user?.QuotaUsed}/${user?.Quota}`}
                  </span>
                )}
              </span>
              <button
                onClick={clearAuth}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
