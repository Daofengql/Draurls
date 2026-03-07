import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  IconButton,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
  Stack,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Group as GroupIcon,
  Link as LinkIcon,
  Language as LanguageIcon,
  Settings as SettingsIcon,
  Description as DescriptionIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material'

interface TabConfig {
  path: string
  label: string
  id: string
  icon: React.ReactNode
}

const adminTabs: TabConfig[] = [
  { path: '/admin', label: '概览', id: 'overview', icon: <DashboardIcon /> },
  { path: '/admin/users', label: '用户管理', id: 'users', icon: <PeopleIcon /> },
  { path: '/admin/groups', label: '用户组', id: 'groups', icon: <GroupIcon /> },
  { path: '/admin/links', label: '短链接管理', id: 'links', icon: <LinkIcon /> },
  { path: '/admin/domains', label: '域名管理', id: 'domains', icon: <LanguageIcon /> },
  { path: '/admin/config', label: '站点配置', id: 'config', icon: <SettingsIcon /> },
  { path: '/admin/templates', label: '跳转模板', id: 'templates', icon: <DescriptionIcon /> },
  { path: '/admin/audit-logs', label: '审计日志', id: 'audit-logs', icon: <AssessmentIcon /> },
]

export default function AdminPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null)

  // 根据路径确定当前标签
  const getCurrentTab = () => {
    const path = location.pathname
    if (path === '/admin' || path === '/admin/') return 'overview'
    const sortedTabs = [...adminTabs].sort((a, b) => b.path.length - a.path.length)
    const tab = sortedTabs.find((t) => path === t.path || path.startsWith(t.path + '/'))
    return tab?.id || 'overview'
  }

  const currentTab = getCurrentTab()

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    const tab = adminTabs.find((t) => t.id === newValue)
    if (tab) {
      navigate(tab.path)
    }
  }

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchor(event.currentTarget)
  }

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null)
  }

  const handleMobileTabSelect = (tabId: string) => {
    const tab = adminTabs.find((t) => t.id === tabId)
    if (tab) {
      navigate(tab.path)
    }
    handleMobileMenuClose()
  }

  return (
    <Box>
      {/* 页面标题和移动端菜单 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>
          管理后台
        </Typography>
        {isMobile && (
          <IconButton onClick={handleMobileMenuOpen} aria-label="切换菜单">
            <MenuIcon />
          </IconButton>
        )}
      </Stack>

      {/* 移动端菜单 */}
      <Menu
        anchorEl={mobileMenuAnchor}
        open={Boolean(mobileMenuAnchor)}
        onClose={handleMobileMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: { width: 200 },
        }}
      >
        {adminTabs.map((tab) => (
          <MenuItem
            key={tab.id}
            onClick={() => handleMobileTabSelect(tab.id)}
            selected={currentTab === tab.id}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {tab.icon}
              {tab.label}
            </Box>
          </MenuItem>
        ))}
      </Menu>

      {/* 标签页导航 */}
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          mb: 3,
        }}
      >
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons="auto"
          sx={{
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          {adminTabs.map((tab) => (
            <Tab
              key={tab.id}
              value={tab.id}
              label={!isMobile ? tab.label : ' '}
              icon={tab.icon as any}
              iconPosition="start"
              sx={{
                minWidth: isMobile ? 48 : 80,
                px: isMobile ? 1.5 : 2,
              }}
            />
          ))}
        </Tabs>
      </Box>

      {/* 内容区域 */}
      <Box className="admin-content">
        <Outlet />
      </Box>
    </Box>
  )
}
