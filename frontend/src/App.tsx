import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Box, Typography, CircularProgress } from '@mui/material'
import { useAuthStore } from './store/auth'
import Layout from './components/Layout'
import ToastContainer from './components/Toast'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LinksPage from './pages/LinksPage'
import ApiKeysPage from './pages/ApiKeysPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/admin/AdminLayout'
import AdminOverviewPage from './pages/admin/AdminOverviewPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminLinksPage from './pages/admin/AdminLinksPage'
import AdminGroupsPage from './pages/admin/AdminGroupsPage'
import AdminDomainsPage from './pages/admin/AdminDomainsPage'
import AdminConfigPage from './pages/admin/AdminConfigPage'
import AdminTemplatesPage from './pages/admin/AdminTemplatesPage'
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage'

// 受保护路由组件：认证中不进行重定向
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const isInitialized = useAuthStore((state) => state.isInitialized)

  // 只有在初始化完成前显示加载状态
  if (!isInitialized || isLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography color="text.secondary">加载中...</Typography>
        </Box>
      </Box>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isInitialized = useAuthStore((state) => state.isInitialized)
  const checkAuth = useAuthStore((state) => state.checkAuth)

  useEffect(() => {
    // 应用启动时检查认证状态
    checkAuth()
  }, [checkAuth])

  // 认证状态检查中不渲染任何内容
  if (!isInitialized) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography color="text.secondary">加载中...</Typography>
        </Box>
      </Box>
    )
  }

  return (
    <>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />} />

        {/* 受保护路由 - 不带 path 的路由作为布局 */}
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="links" element={<LinksPage />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="profile" element={<ProfilePage />} />

          {/* 管理后台路由 */}
          <Route path="admin" element={<AdminPage />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="links" element={<AdminLinksPage />} />
            <Route path="groups" element={<AdminGroupsPage />} />
            <Route path="domains" element={<AdminDomainsPage />} />
            <Route path="config" element={<AdminConfigPage />} />
            <Route path="templates" element={<AdminTemplatesPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          </Route>
        </Route>

        {/* 404 - 已认证用户重定向到主页，未认证重定向到登录页 */}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      </Routes>

      {/* 全局 Toast 通知 */}
      <ToastContainer />
    </>
  )
}

export default App
