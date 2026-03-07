import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Container,
  Stack,
} from '@mui/material'
import { useAuthStore } from '@/store/auth'
import { authService } from '@/services/auth'
import { usersService } from '@/services/users'
import { useSiteConfig } from '@/hooks/useSiteConfig'

export default function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { config: siteConfig } = useSiteConfig()

  const siteName = siteConfig.site_name || 'Draurls'
  const logoUrl = siteConfig.logo_url

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    try {
      const success = await authService.loginWithPopup()

      if (success) {
        setTimeout(async () => {
          try {
            const userData = await usersService.getProfile()
            if (userData) {
              setUser(userData)
              navigate('/dashboard')
            } else {
              throw new Error('无法获取用户信息，请重新登录')
            }
          } catch (err) {
            console.error('获取用户信息失败:', err)
            useAuthStore.getState().clearAuth()
            setError('获取用户信息失败，请重试')
          }
        }, 500)
      } else {
        setError('登录已取消')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Container maxWidth="sm">
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Stack spacing={3} alignItems="center">
              {/* Logo 和 站点名称 */}
              <Box sx={{ textAlign: 'center', width: '100%' }}>
                {logoUrl ? (
                  <Box
                    component="img"
                    src={logoUrl}
                    alt={siteName}
                    sx={{ height: 48, mb: 2 }}
                  />
                ) : (
                  <Typography variant="h4" color="primary.main" fontWeight={700}>
                    {siteName}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  短链接服务
                </Typography>
              </Box>

              {/* 提示信息 */}
              <Typography variant="body2" color="text.secondary">
                使用 Keycloak 账号登录
              </Typography>

              {/* 错误提示 */}
              {error && (
                <Alert severity="error" sx={{ width: '100%' }}>
                  {error}
                </Alert>
              )}

              {/* 登录按钮 */}
              <Button
                onClick={handleLogin}
                disabled={loading}
                variant="contained"
                fullWidth
                size="large"
              >
                {loading ? '登录中...' : '登录'}
              </Button>

              {/* 底部提示 */}
              <Stack spacing={0.5} sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" textAlign="center">
                  点击登录按钮将打开新窗口
                </Typography>
                <Typography variant="caption" color="text.secondary" textAlign="center">
                  登录成功后将自动跳转
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
