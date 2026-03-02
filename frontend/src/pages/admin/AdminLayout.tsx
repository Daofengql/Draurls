import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const adminTabs = [
  { path: '/admin', label: '概览', id: 'overview' },
  { path: '/admin/users', label: '用户管理', id: 'users' },
  { path: '/admin/groups', label: '用户组', id: 'groups' },
  { path: '/admin/domains', label: '域名管理', id: 'domains' },
  { path: '/admin/config', label: '站点配置', id: 'config' },
  { path: '/admin/templates', label: '跳转模板', id: 'templates' },
  { path: '/admin/audit-logs', label: '审计日志', id: 'audit-logs' },
]

export default function AdminPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [, setActiveTab] = useState('overview')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // 根据路径确定当前标签
  const getCurrentTab = () => {
    const path = location.pathname
    if (path === '/admin' || path === '/admin/') return 'overview'
    // 按路径长度倒序匹配，确保更具体的路径优先匹配
    const sortedTabs = [...adminTabs].sort((a, b) => b.path.length - a.path.length)
    const tab = sortedTabs.find((t) => path === t.path || path.startsWith(t.path + '/'))
    return tab?.id || 'overview'
  }

  const currentTab = getCurrentTab()

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    const tab = adminTabs.find((t) => t.id === tabId)
    if (tab) {
      navigate(tab.path)
      setMobileMenuOpen(false)
    }
  }

  const getCurrentTabLabel = () => {
    return adminTabs.find((t) => t.id === currentTab)?.label || '概览'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">管理后台</h1>
        {/* 移动端菜单按钮 */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="sm:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          aria-label="切换菜单"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* 标签页导航 */}
      <div className="border-b border-gray-200 mb-4 sm:mb-6">
        {/* 移动端下拉菜单 */}
        <div className="sm:hidden">
          {mobileMenuOpen && (
            <div className="py-2 space-y-1">
              {adminTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full text-left px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    currentTab === tab.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          {!mobileMenuOpen && (
            <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
              当前: <span className="font-medium">{getCurrentTabLabel()}</span>
            </div>
          )}
        </div>

        {/* 桌面端标签导航 */}
        <nav className="hidden sm:flex space-x-1">
          {adminTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 sm:px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                currentTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 内容区域 - 这里会渲染子路由 */}
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  )
}
