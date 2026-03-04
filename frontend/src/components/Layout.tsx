import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useSiteConfig } from '@/hooks/useSiteConfig'

const navItems = [
  { path: '/dashboard', label: '仪表盘' },
  { path: '/links', label: '我的链接' },
  { path: '/api-keys', label: 'API密钥' },
]

export default function Layout() {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const isAdmin = user?.Role === 'admin'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // 站点配置
  const { config: siteConfig } = useSiteConfig()

  // 显示名称：优先使用 nickname，其次 username
  const displayName = user?.Nickname || user?.Username

  const siteName = siteConfig.site_name || 'Draurls'
  const logoUrl = siteConfig.logo_url

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4 sm:space-x-8">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-7" />
              ) : (
                <h1 className="text-xl font-bold text-blue-600">{siteName}</h1>
              )}
              {/* 桌面端导航 */}
              <nav className="hidden sm:flex space-x-4">
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

            {/* 桌面端用户信息 */}
            <div className="hidden sm:flex items-center space-x-4">
              <Link
                to="/profile"
                className="flex items-center space-x-2 hover:bg-gray-50 rounded-lg px-3 py-1.5 transition-colors"
              >
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
                <span className="text-sm text-gray-700">{displayName || '加载中...'}</span>
              </Link>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                退出
              </button>
            </div>

            {/* 移动端菜单按钮 */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* 移动端导航菜单 */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t bg-white">
            <div className="px-4 py-3 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-sm font-medium ${
                    location.pathname === item.path
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-sm font-medium ${
                    location.pathname.startsWith('/admin')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  管理后台
                </Link>
              )}
              <div className="border-t pt-3 mt-3">
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 mb-2"
                >
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
                  <span>{displayName || '加载中...'}</span>
                </Link>
                <button
                  onClick={() => {
                    logout()
                    setMobileMenuOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  退出
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* 页脚备案信息 */}
      {siteConfig.icp_number && (
        <footer className="mt-auto py-4 text-center text-sm text-gray-500">
          <a
            href="http://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-gray-700"
          >
            <img src="//oss-fz.silverdragon.cn/loongapisources/picbed/penglong/2023/07/24/202307240118075832.png" alt="" className="w-4 h-4" />
            {siteConfig.icp_number}
          </a>
        </footer>
      )}
    </div>
  )
}
