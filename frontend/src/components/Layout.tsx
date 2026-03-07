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
      <AppBar position="sticky" elevation={1} sx={{ bgcolor: '#ffffff', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            {/* Logo 和 站点名称 */}
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 0, mr: 4 }}>
              {logoUrl ? (
                <Box
                  component="img"
                  src={logoUrl}
                  alt={siteName}
                  sx={{ height: 40, cursor: 'pointer' }}
                  onClick={() => handleNav('/dashboard')}
                />
              ) : (
                <Typography
                  variant="h6"
                  component="div"
                  sx={{ color: 'primary.main', fontWeight: 700, cursor: 'pointer', fontSize: '1.5rem' }}
                  onClick={() => handleNav('/dashboard')}
                >
                  {siteName}
                </Typography>
              )}
            </Box>

            {/* 桌面端导航 */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5, flexGrow: 1 }}>
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  color={isActive(item.path) ? 'primary' : 'inherit'}
                  variant="text"
                  size="small"
                  sx={{
                    borderRadius: 2,
                    color: isActive(item.path) ? 'primary.main' : 'text.primary',
                    bgcolor: isActive(item.path) ? 'primary.50' : 'transparent',
                    fontWeight: isActive(item.path) ? 600 : 400,
                  }}
                >
                  {item.label}
                </Button>
              ))}
              {isAdmin && (
                <Button
                  onClick={() => handleNav('/admin')}
                  color={isActive('/admin') ? 'primary' : 'inherit'}
                  variant="text"
                  size="small"
                  startIcon={<AdminPanelSettings fontSize="small" />}
                  sx={{
                    borderRadius: 2,
                    color: isActive('/admin') ? 'primary.main' : 'text.primary',
                    bgcolor: isActive('/admin') ? 'primary.50' : 'transparent',
                    fontWeight: isActive('/admin') ? 600 : 400,
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
                  borderRadius: 2,
                  px: 1.5,
                  py: 0.75,
                  bgcolor: 'transparent',
                  color: 'text.primary',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                {user?.Picture ? (
                  <Avatar src={user.Picture} alt={displayName} sx={{ width: 32, height: 32, mr: 1 }}>
                    {displayName?.charAt(0).toUpperCase() || '?'}
                  </Avatar>
                ) : (
                  <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'primary.main' }}>
                    {displayName?.charAt(0).toUpperCase() || '?'}
                  </Avatar>
                )}
                <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                  {displayName || '加载中...'}
                </Typography>
              </Button>

              <Menu
                anchorEl={userMenuAnchor}
                open={userMenuOpen}
                onClose={handleUserMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem onClick={() => { handleNav('/profile'); handleUserMenuClose() }}>
                  <ListItemIcon><AccountCircle fontSize="small" /></ListItemIcon>
                  <ListItemText>个人资料</ListItemText>
                </MenuItem>
                <Divider />
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
                color="inherit"
                onClick={handleMobileMenuOpen}
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
        PaperProps={{
          sx: { width: 280, maxWidth: '100%' },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {user?.Picture ? (
              <Avatar src={user.Picture} alt={displayName} sx={{ width: 40, height: 40 }}>
                {displayName?.charAt(0).toUpperCase() || '?'}
              </Avatar>
            ) : (
              <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}>
                {displayName?.charAt(0).toUpperCase() || '?'}
              </Avatar>
            )}
            <Typography variant="subtitle1" fontWeight={500}>
              {displayName || '加载中...'}
            </Typography>
          </Stack>
        </Box>

        <MenuItem onClick={() => handleNav('/dashboard')} selected={isActive('/dashboard')}>
          仪表盘
        </MenuItem>
        <MenuItem onClick={() => handleNav('/links')} selected={isActive('/links')}>
          我的链接
        </MenuItem>
        <MenuItem onClick={() => handleNav('/api-keys')} selected={isActive('/api-keys')}>
          API密钥
        </MenuItem>

        {isAdmin && (
          <>
            <Divider />
            <MenuItem onClick={() => handleNav('/admin')} selected={isActive('/admin')}>
              <ListItemIcon><AdminPanelSettings fontSize="small" /></ListItemIcon>
              <ListItemText>管理后台</ListItemText>
            </MenuItem>
          </>
        )}

        <Divider />

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
            borderTop: 1,
            borderColor: 'divider',
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
