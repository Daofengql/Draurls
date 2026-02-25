import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/Layout'
import ToastContainer from './components/Toast'
import LoginPage from './pages/LoginPage'
import TokenPage from './pages/TokenPage'
import DashboardPage from './pages/DashboardPage'
import LinksPage from './pages/LinksPage'
import ApiKeysPage from './pages/ApiKeysPage'
import AdminPage from './pages/admin/AdminLayout'
import AdminOverviewPage from './pages/admin/AdminOverviewPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminGroupsPage from './pages/admin/AdminGroupsPage'
import AdminDomainsPage from './pages/admin/AdminDomainsPage'
import AdminConfigPage from './pages/admin/AdminConfigPage'
import RedirectPage from './pages/RedirectPage'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const checkAuth = useAuthStore((state) => state.checkAuth)

  useEffect(() => {
    // 应用启动时检查认证状态
    checkAuth()
  }, [checkAuth])

  // 加载中显示 loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/r/:code" element={<RedirectPage />} />

        {/* 受保护路由 */}
        <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="links" element={<LinksPage />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="token" element={<TokenPage />} />

          {/* 管理后台路由 */}
          <Route path="admin" element={<AdminPage />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="groups" element={<AdminGroupsPage />} />
            <Route path="domains" element={<AdminDomainsPage />} />
            <Route path="config" element={<AdminConfigPage />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* 全局 Toast 通知 */}
      <ToastContainer />
    </>
  )
}

export default App
