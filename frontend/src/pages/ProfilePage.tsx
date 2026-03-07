import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { usersService } from '@/services/users'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'
import type { User, QuotaStatus } from '@/types'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Avatar,
  Chip,
  LinearProgress,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material'
import { Logout, AdminPanelSettings } from '@mui/icons-material'

export default function ProfilePage() {
  const setUser = useAuthStore((state) => state.setUser)
  const logout = useAuthStore((state) => state.logout)

  const [profile, setProfile] = useState<User | null>(null)
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async () => {
    setLoading(true)
    try {
      const [profileData, quotaData] = await Promise.all([
        usersService.getProfile(),
        usersService.getQuotaStatus(),
      ])
      setUser(profileData)
      setProfile(profileData)
      setQuotaStatus(quotaData)
    } catch (err) {
      console.error(err)
      toast.error('加载用户信息失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const handleLogout = async () => {
    await logout()
  }

  const getRoleLabel = (role: string) => {
    return role === 'admin' ? '管理员' : '普通用户'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: '正常',
      disabled: '已禁用',
      deleted: '已删除',
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string): 'success' | 'error' | 'default' => {
    const colors: Record<string, 'success' | 'error' | 'default'> = {
      active: 'success',
      disabled: 'error',
      deleted: 'default',
    }
    return colors[status] || 'default'
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 20 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!profile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 20 }}>
        <Typography color="text.secondary">无法加载用户信息</Typography>
      </Box>
    )
  }

  const displayName = profile.Nickname || profile.Username
  const quotaPercentage = quotaStatus && quotaStatus.quota !== -1 ? quotaStatus.percentage : 0
  const getQuotaColor = () => {
    if (quotaPercentage >= 90) return 'error'
    if (quotaPercentage >= 70) return 'warning'
    return 'primary'
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Stack spacing={3}>
        {/* 页面标题 */}
        <Box>
          <Typography variant="h4" fontWeight={700}>
            个人信息
          </Typography>
        </Box>

        {/* 基本信息 */}
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              基本信息
            </Typography>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={3}
              alignItems={{ xs: 'center', sm: 'flex-start' }}
            >
              {/* 头像 */}
              <Box sx={{ flexShrink: 0 }}>
                {profile.Picture ? (
                  <Avatar
                    src={profile.Picture}
                    alt={displayName}
                    sx={{ width: 80, height: 80 }}
                  />
                ) : (
                  <Avatar
                    sx={{
                      width: 80,
                      height: 80,
                      background: 'linear-gradient(135deg, #3b82f6 0%, #9333ea 100%)',
                      fontSize: '2rem',
                      fontWeight: 600,
                    }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </Avatar>
                )}
              </Box>

              {/* 用户信息 */}
              <Box sx={{ flex: 1, width: '100%' }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'center', sm: 'flex-start' }}
                  spacing={1}
                  justifyContent={{ xs: 'center', sm: 'flex-start' }}
                >
                  <Typography variant="h5" fontWeight={600}>
                    {displayName}
                  </Typography>
                  {profile.Role === 'admin' && (
                    <Chip
                      label="管理员"
                      icon={<AdminPanelSettings fontSize="small" />}
                      color="secondary"
                      size="small"
                    />
                  )}
                  <Chip
                    label={getStatusLabel(profile.Status)}
                    color={getStatusColor(profile.Status)}
                    size="small"
                  />
                </Stack>

                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        用户ID
                      </Typography>
                      <Typography variant="body2">{profile.ID}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        角色
                      </Typography>
                      <Typography variant="body2">{getRoleLabel(profile.Role)}</Typography>
                    </Box>
                    <Box sx={{ gridColumn: { xs: 'span 2', sm: 'span 1' } }}>
                      <Typography variant="caption" color="text.secondary">
                        用户名
                      </Typography>
                      <Typography variant="body2" noWrap>
                        {profile.Username}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      邮箱
                    </Typography>
                    <Typography variant="body2" noWrap>
                      {profile.Email}
                    </Typography>
                  </Box>
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      注册时间
                    </Typography>
                    <Typography variant="body2">
                      {formatDateTime(profile.CreatedAt)}
                    </Typography>
                  </Box>
                  {profile.LastLoginAt && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        上次登录
                      </Typography>
                      <Typography variant="body2">
                        {formatDateTime(profile.LastLoginAt)}
                      </Typography>
                    </Box>
                  )}
                  {profile.LastLoginIP && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        登录IP
                      </Typography>
                      <Typography variant="body2" noWrap>
                        {profile.LastLoginIP}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* 配额信息 */}
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              配额信息
            </Typography>

            {quotaStatus ? (
              <Stack spacing={3}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body1" color="text.secondary">
                    配额类型
                  </Typography>
                  <Typography variant="body1" fontWeight={500} textAlign="right">
                    {quotaStatus.quota_source === 'unlimited'
                      ? '无限配额'
                      : quotaStatus.group_name
                        ? `用户组 (${quotaStatus.group_name})`
                        : '用户配额'}
                  </Typography>
                </Stack>

                {quotaStatus.quota !== -1 && (
                  <>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          已使用
                        </Typography>
                        <Typography variant="body2">
                          {quotaStatus.quota_used} / {quotaStatus.quota}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(quotaPercentage, 100)}
                        color={getQuotaColor()}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          剩余
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={500}
                          color={getQuotaColor() + '.main' as any}
                        >
                          {quotaStatus.quota_left}
                        </Typography>
                      </Stack>
                    </Stack>
                  </>
                )}

                {quotaStatus.quota === -1 && (
                  <Alert severity="success">
                    您拥有无限配额，可创建无限数量的短链接
                  </Alert>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                加载配额信息中...
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* 退出登录 */}
        <Card>
          <Button
            onClick={handleLogout}
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<Logout />}
            sx={{
              justifyContent: 'flex-start',
              py: 2,
              borderColor: 'error.light',
              '&:hover': {
                borderColor: 'error.main',
                bgcolor: 'error.50',
              },
            }}
          >
            退出登录
          </Button>
        </Card>
      </Stack>
    </Box>
  )
}
