import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { usersService } from '@/services/users'
import { domainsService } from '@/services/admin'
import type { QuotaStatus, DashboardStats, Domain } from '@/types'
import { formatDateTime } from '@/utils/format'
import CopyButton from '@/components/CopyButton'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  LinearProgress,
  Chip,
  Link,
  Divider,
  Alert,
  Skeleton,
} from '@mui/material'
import {
  Link as LinkIcon,
  BarChart,
  Today,
  InsertChart,
  Info,
} from '@mui/icons-material'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    domainsService.list().then((data) => {
      setDomains(data || [])
    }).catch(console.error)
  }, [])

  useEffect(() => {
    Promise.all([
      usersService.getQuotaStatus(),
      usersService.getDashboard(),
    ])
      .then(([quotaRes, statsRes]) => {
        setQuotaStatus(quotaRes as QuotaStatus)
        setStats(statsRes as DashboardStats)
      })
      .catch((err) => {
        console.error(err)
      })
      .finally(() => setLoading(false))
  }, [])

  const displayName = user?.Nickname || user?.Username

  const getFullUrl = (link: any) => {
    if (link.Domain) {
      const protocol = link.Domain.SSL ? 'https' : 'http'
      return `${protocol}://${link.Domain.Name}/r/${link.Code}`
    }
    const domain = domains.find((d) => d.ID === link.DomainID) || domains[0]
    if (domain) {
      const protocol = domain.SSL ? 'https' : 'http'
      return `${protocol}://${domain.Name}/r/${link.Code}`
    }
    return `/r/${link.Code}`
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <Stack spacing={3}>
      {/* 欢迎信息 */}
      <Card
        sx={{
          background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
          border: 'none',
          boxShadow: 3,
        }}
      >
        <CardContent>
          <Typography variant="h6" fontWeight={600}>
            欢迎回来，{displayName}！
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.5 }}>
            {user?.Role === 'admin' ? '管理员' : '普通用户'}
          </Typography>
        </CardContent>
      </Card>

      {/* ��额状态 */}
      {quotaStatus && (
        <Card sx={{ overflow: 'hidden' }}>
          <CardContent sx={{ overflow: 'visible' }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={3}>
              <InsertChart color="primary" />
              <Typography variant="h6" fontWeight={600}>
                配额状态
              </Typography>
            </Stack>

            <Stack spacing={2}>
              {/* 进度条 */}
              <Box>
                <Stack direction="row" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    已使用配额
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {quotaStatus.quota === -1
                      ? '∞'
                      : `${quotaStatus.quota_used}/${quotaStatus.quota}`}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant={quotaStatus.quota === -1 ? 'indeterminate' : 'determinate'}
                  value={quotaStatus.quota === -1 ? 100 : quotaStatus.percentage}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: quotaStatus.percentage > 90
                        ? 'error.main'
                        : quotaStatus.percentage > 70
                          ? 'warning.main'
                          : 'primary.main',
                    },
                  }}
                />
                {quotaStatus.quota !== -1 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    使用率: {quotaStatus.percentage.toFixed(1)}%
                    {quotaStatus.percentage > 80 && (
                      <Chip
                        label="配额即将用完"
                        size="small"
                        color="warning"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                )}
                {quotaStatus.quota === -1 && (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    您拥有无限配额
                  </Alert>
                )}
              </Box>

              <Divider />

              {/* 来源信息 */}
              <Typography variant="caption" color="text.secondary">
                配额来源:{' '}
                {quotaStatus.quota_source === 'unlimited'
                  ? '无限'
                  : quotaStatus.quota_source === 'group'
                    ? `用户组 (${quotaStatus.group_name || '默认'})`
                    : '个人配额'}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* 统计卡片 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        <StatCard
          title="总链接数"
          value={stats?.total_links || 0}
          icon={<LinkIcon />}
          color="primary"
        />
        <StatCard
          title="总点击数"
          value={stats?.total_clicks || 0}
          icon={<BarChart />}
          color="success"
        />
        <StatCard
          title="今日点击"
          value={stats?.today_clicks || 0}
          icon={<Today />}
          color="secondary"
        />
      </Box>

      {/* 最近创建的链接 */}
      {stats?.recent_links && stats.recent_links.length > 0 && (
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} mb={3}>
              <Today color="primary" />
              <Typography variant="h6" fontWeight={600}>
                最近创建
              </Typography>
            </Stack>

            <Stack spacing={2}>
              {stats.recent_links.map((link) => {
                const fullUrl = getFullUrl(link)
                return (
                  <Box
                    key={link.ID || link.Code}
                    sx={{
                      p: 2,
                      bgcolor: 'action.hover',
                      borderRadius: 2,
                      '&:hover': { bgcolor: 'action.selected' },
                      transition: 'bgcolor 0.2s',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      spacing={2}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Link
                          href={fullUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                          color="primary"
                          fontWeight={500}
                          sx={{ display: 'block', mb: 0.5 }}
                        >
                          {fullUrl}
                        </Link>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                          title={link.URL}
                        >
                          {link.URL}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {formatDateTime(link.CreatedAt)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ textAlign: 'center', minWidth: 50 }}>
                          <Typography variant="caption" color="text.secondary">
                            点击
                          </Typography>
                          <Typography variant="body1" fontWeight={600}>
                            {link.ClickCount}
                          </Typography>
                        </Box>
                        <CopyButton text={fullUrl}>复制</CopyButton>
                      </Stack>
                    </Stack>
                  </Box>
                )
              })}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* 空状态 */}
      {stats?.recent_links && stats.recent_links.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Info sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary" gutterBottom>
              还没有创建任何短链接
            </Typography>
            <Box component={Link} href="/links" sx={{ mt: 2, display: 'inline-block' }}>
              创建第一个短链接
            </Box>
          </CardContent>
        </Card>
      )}
    </Stack>
  )
}

// 骨架屏
function DashboardSkeleton() {
  return (
    <Stack spacing={3}>
      <Skeleton variant="rectangular" height={80} />

      <Card>
        <CardContent>
          <Skeleton variant="text" width={120} height={28} sx={{ mb: 3 }} />
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="100%" sx={{ mb: 1 }} />
              <Skeleton variant="rectangular" height={8} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width={160} />
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent>
              <Skeleton variant="text" width={80} sx={{ mb: 2 }} />
              <Skeleton variant="text" width={100} height={40} />
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  )
}

interface StatCardProps {
  title: string
  value: number
  icon: React.ReactNode
  color: 'primary' | 'success' | 'secondary'
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorConfig = {
    primary: { bg: 'primary.50', color: 'primary.main' },
    success: { bg: 'success.50', color: 'success.main' },
    secondary: { bg: 'secondary.50', color: 'secondary.main' },
  }

  const config = colorConfig[color]

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={700} mt={1}>
              {value.toLocaleString()}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: config.bg,
              color: config.color,
              display: 'flex',
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}
