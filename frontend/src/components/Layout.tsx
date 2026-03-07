import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Avatar,
  Container,
  Stack,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Logout,
  AccountCircle,
  AdminPanelSettings,
} from '@mui/icons-material'
import { useAuthStore } from '@/store/auth'
import { useSiteConfig } from '@/hooks/useSiteConfig'

const navItems = [
  { path: '/dashboard', label: '仪表盘' },
  { path: '/links', label: '我的链接' },
  { path: '/api-keys', label: 'API密钥' },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const isAdmin = user?.Role === 'admin'
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null)
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null)

  const mobileMenuOpen = Boolean(mobileMenuAnchor)
  const userMenuOpen = Boolean(userMenuAnchor)

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchor(event.currentTarget)
  }

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null)
  }

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget)
  }

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null)
  }

  // 站点配置
  const { config: siteConfig } = useSiteConfig()

  // 显示名称：优先使用 nickname，其次 username
  const displayName = user?.Nickname || user?.Username

  const siteName = siteConfig.site_name || 'Draurls'
  const logoUrl = siteConfig.logo_url

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname.startsWith('/admin')
    }
    return location.pathname === path
  }

  const handleNav = (path: string) => {
    navigate(path)
    handleMobileMenuClose()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* 顶部导航 */}
      <AppBar
        position="sticky"
        elevation={4}
        sx={{
          bgcolor: '#ffffff',
          color: 'text.primary',
          borderBottom: '2px solid',
          borderColor: 'grey.200',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ height: 64 }}>
            {/* Logo 和 站点名称 */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexGrow: 0,
                mr: { xs: 2, sm: 4 },
                cursor: 'pointer',
              }}
              onClick={() => handleNav('/dashboard')}
            >
              {logoUrl ? (
                <Box
                  component="img"
                  src={logoUrl}
                  alt={siteName}
                  sx={{ height: 40 }}
                />
              ) : (
                <Typography
                  variant="h6"
                  component="div"
                  sx={{
                    background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 700,
                    fontSize: '1.5rem',
                  }}
                >
                  {siteName}
                </Typography>
              )}
            </Box>

            {/* 桌面端导航 */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5, flexGrow: 1, ml: 4 }}>
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  color="inherit"
                  variant="text"
                  size="small"
                  sx={{
                    borderRadius: 2.5,
                    px: 2,
                    py: 1,
                    fontWeight: isActive(item.path) ? 600 : 500,
                    fontSize: '0.95rem',
                    bgcolor: isActive(item.path) ? 'primary.main' : 'transparent',
                    color: isActive(item.path) ? '#fff' : 'text.primary',
                    '&:hover': {
                      bgcolor: isActive(item.path) ? 'primary.dark' : 'action.hover',
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}
              {isAdmin && (
                <Button
                  onClick={() => handleNav('/admin')}
                  color="inherit"
                  variant="text"
                  size="small"
                  startIcon={<AdminPanelSettings fontSize="small" />}
                  sx={{
                    borderRadius: 2.5,
                    px: 2,
                    py: 1,
                    fontWeight: isActive('/admin') ? 600 : 500,
                    fontSize: '0.95rem',
                    bgcolor: isActive('/admin') ? 'secondary.main' : 'transparent',
                    color: isActive('/admin') ? '#fff' : 'text.primary',
                    '&:hover': {
                      bgcolor: isActive('/admin') ? 'secondary.dark' : 'action.hover',
                    },
                  }}
                >
                  管理后台
                </Button>
              )}
            </Box>

            {/* 桌面端用户信息 */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
              <Button
                onClick={handleUserMenuOpen}
                sx={{
                  borderRadius: 2.5,
                  px: 1.5,
                  py: 0.75,
                  bgcolor: 'transparent',
                  color: 'text.primary',
                  fontWeight: 500,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                {user?.Picture ? (
                  <Avatar src={user.Picture} alt={displayName} sx={{ width: 32, height: 32, mr: 1 }}>
                    {displayName?.charAt(0).toUpperCase() || '?'}
                  </Avatar>
                ) : (
                  <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'primary.main', fontWeight: 600 }}>
                    {displayName?.charAt(0).toUpperCase() || '?'}
                  </Avatar>
                )}
                <Typography variant="body2">
                  {displayName || '加载中...'}
                </Typography>
              </Button>

              <Menu
                anchorEl={userMenuAnchor}
                open={userMenuOpen}
                onClose={handleUserMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                  paper: {
                    sx: {
                      mt: 1.5,
                      minWidth: 180,
                      border: '1px solid',
                      borderColor: 'grey.200',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    },
                  },
                }}
              >
                <MenuItem onClick={() => { handleNav('/profile'); handleUserMenuClose() }}>
                  <ListItemIcon><AccountCircle fontSize="small" /></ListItemIcon>
                  <ListItemText>个人资料</ListItemText>
                </MenuItem>
                <Divider sx={{ borderColor: 'grey.200' }} />
                <MenuItem onClick={() => { logout(); handleUserMenuClose() }}>
                  <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
                  <ListItemText>退出登录</ListItemText>
                </MenuItem>
              </Menu>
            </Box>

            {/* 移动端菜单按钮 */}
            <Box sx={{ ml: 'auto', display: { xs: 'flex', sm: 'none' } }}>
              <IconButton
                size="large"
                edge="end"
                onClick={handleMobileMenuOpen}
                sx={{ color: 'text.primary' }}
              >
                <MenuIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* 移动端导航菜单 */}
      <Menu
        anchorEl={mobileMenuAnchor}
        open={mobileMenuOpen}
        onClose={handleMobileMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        sx={{ display: { sm: 'none' } }}
        slotProps={{
          paper: {
            sx: {
              width: 280,
              maxWidth: '100%',
              mt: 1.5,
              border: '1px solid',
              borderColor: 'grey.200',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '2px solid', borderColor: 'grey.100' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {user?.Picture ? (
              <Avatar src={user.Picture} alt={displayName} sx={{ width: 40, height: 40 }}>
                {displayName?.charAt(0).toUpperCase() || '?'}
              </Avatar>
            ) : (
              <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontWeight: 600 }}>
                {displayName?.charAt(0).toUpperCase() || '?'}
              </Avatar>
            )}
            <Typography variant="subtitle1" fontWeight={500}>
              {displayName || '加载中...'}
            </Typography>
          </Stack>
        </Box>

        <MenuItem
          onClick={() => handleNav('/dashboard')}
          selected={isActive('/dashboard')}
          sx={{
            bgcolor: isActive('/dashboard') ? 'primary.50' : 'transparent',
            fontWeight: isActive('/dashboard') ? 600 : 400,
          }}
        >
          仪表盘
        </MenuItem>
        <MenuItem
          onClick={() => handleNav('/links')}
          selected={isActive('/links')}
          sx={{
            bgcolor: isActive('/links') ? 'primary.50' : 'transparent',
            fontWeight: isActive('/links') ? 600 : 400,
          }}
        >
          我的链接
        </MenuItem>
        <MenuItem
          onClick={() => handleNav('/api-keys')}
          selected={isActive('/api-keys')}
          sx={{
            bgcolor: isActive('/api-keys') ? 'primary.50' : 'transparent',
            fontWeight: isActive('/api-keys') ? 600 : 400,
          }}
        >
          API密钥
        </MenuItem>

        {isAdmin && (
          <>
            <Divider sx={{ borderColor: 'grey.200' }} />
            <MenuItem
              onClick={() => handleNav('/admin')}
              selected={isActive('/admin')}
              sx={{
                bgcolor: isActive('/admin') ? 'secondary.50' : 'transparent',
                fontWeight: isActive('/admin') ? 600 : 400,
              }}
            >
              <ListItemIcon><AdminPanelSettings fontSize="small" /></ListItemIcon>
              <ListItemText>管理后台</ListItemText>
            </MenuItem>
          </>
        )}

        <Divider sx={{ borderColor: 'grey.200' }} />

        <MenuItem onClick={() => { handleNav('/profile'); handleMobileMenuClose() }}>
          <ListItemIcon><AccountCircle fontSize="small" /></ListItemIcon>
          <ListItemText>个人资料</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { logout(); handleMobileMenuClose() }}>
          <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
          <ListItemText>退出登录</ListItemText>
        </MenuItem>
      </Menu>

      {/* 主内容区 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: { xs: 2, sm: 3, lg: 4 },
          py: { xs: 3, sm: 4 },
        }}
      >
        <Container maxWidth="xl" disableGutters>
          <Outlet />
        </Container>
      </Box>

      {/* 页脚备案信息 */}
      {siteConfig.icp_number && (
        <Box
          component="footer"
          sx={{
            py: 2,
            textAlign: 'center',
            borderTop: '2px solid',
            borderColor: 'grey.200',
          }}
        >
          <Box
            component="a"
            href="http://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              color: 'text.secondary',
              textDecoration: 'none',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <Box
              component="img"
              src="//oss-fz.silverdragon.cn/loongapisources/picbed/penglong/2023/07/24/202307240118075832.png"
              alt=""
              sx={{ width: 16, height: 16 }}
            />
            <Typography variant="body2" color="inherit">
              {siteConfig.icp_number}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}
