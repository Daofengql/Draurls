import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LinksPage from './pages/LinksPage'
import ApiKeysPage from './pages/ApiKeysPage'
import AdminPage from './pages/AdminPage'
import RedirectPage from './pages/RedirectPage'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
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
        <Route path="admin" element={<AdminPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
