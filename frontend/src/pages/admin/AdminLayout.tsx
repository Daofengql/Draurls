import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const adminTabs = [
  { path: '/admin', label: '概览', id: 'overview' },
  { path: '/admin/users', label: '用户管理', id: 'users' },
  { path: '/admin/groups', label: '用户组', id: 'groups' },
  { path: '/admin/domains', label: '域名管理', id: 'domains' },
  { path: '/admin/config', label: '站点配置', id: 'config' },
  { path: '/admin/templates', label: '跳转模板', id: 'templates' },
]

export default function AdminPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [, setActiveTab] = useState('overview')

  // 根据路径确定当前标签
  const getCurrentTab = () => {
    const path = location.pathname
    if (path === '/admin') return 'overview'
    const tab = adminTabs.find((t) => path.startsWith(t.path))
    return tab?.id || 'overview'
  }

  const currentTab = getCurrentTab()

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    const tab = adminTabs.find((t) => t.id === tabId)
    if (tab) navigate(tab.path)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">管理后台</h1>

      {/* 标签页导航 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-1">
          {adminTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
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
