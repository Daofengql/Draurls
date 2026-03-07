import { useEffect, useState } from 'react'
import { dashboardService } from '@/services/admin'
import type { AdminSummary, TrendData } from '@/types'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  useTheme,
  useMediaQuery,
  Skeleton,
} from '@mui/material'
import {
  TrendingUp,
  People,
  Link as LinkIcon,
  TouchApp,
  CheckCircle,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material'
import { LineChart } from '@mui/x-charts/LineChart'

export default function AdminOverviewPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [trends, setTrends] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      dashboardService.getSummary(),
      dashboardService.getTrends(30),
    ])
      .then(([summaryData, trendData]) => {
        setSummary(summaryData)
        setTrends(trendData.daily_data || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <AdminOverviewSkeleton />
  }

  return (
    <Box
      sx={{
        animation: 'fadeIn 0.3s ease-in-out',
        '@keyframes fadeIn': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
    >
      {/* 统计卡片 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: { xs: 2, sm: 3 },
          mb: { xs: 3, sm: 4 },
        }}
      >
        <StatCard
          title="总用户数"
          value={summary?.total_users || 0}
          change={summary?.today_users || 0}
          changeLabel="今日新增"
          icon="users"
          color="blue"
        />
        <StatCard
          title="总链接数"
          value={summary?.total_links || 0}
          change={summary?.today_links || 0}
          changeLabel="今日新增"
          icon="links"
          color="green"
        />
        <StatCard
          title="总点击数"
          value={summary?.total_clicks || 0}
          change={summary?.today_clicks || 0}
          changeLabel="今日点击"
          icon="clicks"
          color="purple"
        />
        <StatCard
          title="活跃用户"
          value={summary?.active_users || 0}
          suffix="人"
          icon="active"
          color="orange"
        />
      </Box>

      {/* 趋势图表 */}
      {trends.length > 0 && (
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 3 }}>
              <TrendingUp color="primary" />
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="semibold">
                近30天趋势
              </Typography>
            </Stack>
            <Box sx={{ height: { xs: 240, sm: 300 }, width: '100%' }}>
              <TrendChart data={trends} />
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}

// 骨架屏
function AdminOverviewSkeleton() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        gap: 3,
        mb: 4,
      }}
    >
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardContent>
            <Skeleton variant="text" width={80} height={20} sx={{ mb: 1 }} />
            <Skeleton variant="text" width={96} height={40} sx={{ mb: 1 }} />
            <Skeleton variant="text" width={128} height={16} />
          </CardContent>
        </Card>
      ))}
      <Card sx={{ gridColumn: '1 / -1' }}>
        <CardContent>
          <Skeleton variant="text" width={128} height={28} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={300} width="100%" />
        </CardContent>
      </Card>
    </Box>
  )
}

interface StatCardProps {
  title: string
  value: number
  change?: number
  changeLabel?: string
  suffix?: string
  icon: 'users' | 'links' | 'clicks' | 'active'
  color: 'blue' | 'green' | 'purple' | 'orange'
}

const colorConfigs: Record<
  StatCardProps['color'],
  { bg: string; color: string }
> = {
  blue: { bg: 'primary.50', color: 'primary.main' },
  green: { bg: 'success.50', color: 'success.main' },
  purple: { bg: 'secondary.50', color: 'secondary.main' },
  orange: { bg: 'warning.50', color: 'warning.main' },
}

function StatCard({
  title,
  value,
  change,
  changeLabel,
  suffix = '',
  icon,
  color,
}: StatCardProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const config = colorConfigs[color]

  const icons = {
    users: <People />,
    links: <LinkIcon />,
    clicks: <TouchApp />,
    active: <CheckCircle />,
  }

  return (
    <Card
      sx={{
        height: '100%',
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: theme.shadows[4],
        },
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant={isMobile ? 'caption' : 'body2'}
              color="text.secondary"
              sx={{ textTransform: 'none' }}
            >
              {title}
            </Typography>
            <Typography
              variant={isMobile ? 'h4' : 'h3'}
              fontWeight="bold"
              sx={{ mt: { xs: 0.5, sm: 1 } }}
            >
              {value.toLocaleString()}
              {suffix}
            </Typography>
            {change !== undefined && changeLabel && (
              <Stack
                direction="row"
                alignItems="center"
                gap={0.5}
                sx={{
                  mt: { xs: 1, sm: 1.5 },
                  color:
                    change > 0
                      ? 'success.main'
                      : change < 0
                      ? 'error.main'
                      : 'text.secondary',
                }}
              >
                {change > 0 ? (
                  <ArrowUpward sx={{ fontSize: { xs: 14, sm: 16 } }} />
                ) : change < 0 ? (
                  <ArrowDownward sx={{ fontSize: { xs: 14, sm: 16 } }} />
                ) : null}
                <Typography
                  variant={isMobile ? 'caption' : 'body2'}
                  component="span"
                  sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {change >= 0 ? '+' : ''}{change} {changeLabel}
                </Typography>
              </Stack>
            )}
          </Box>
          <Box
            sx={{
              p: { xs: 1.5, sm: 2 },
              borderRadius: 2,
              bgcolor: config.bg,
              color: config.color,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box sx={{ fontSize: { xs: 20, sm: 28 } }}>
              {icons[icon]}
            </Box>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

function TrendChart({ data }: { data: TrendData[] }) {
  const theme = useTheme()

  // 格式化日期显示
  const xAxisLabels = data.map((item) => {
    const date = new Date(item.date)
    return `${date.getMonth() + 1}/${date.getDate()}`
  })

  const linksData = data.map((item) => item.links)
  const clicksData = data.map((item) => item.clicks)

  return (
    <LineChart
      series={[
        {
          data: clicksData,
          label: '点击数',
          color: theme.palette.primary.main,
          valueFormatter: (v) => `${v ?? 0} 次`,
        },
        {
          data: linksData,
          label: '链接数',
          color: theme.palette.success.main,
          valueFormatter: (v) => `${v ?? 0} 个`,
        },
      ]}
      xAxis={[{ scaleType: 'point', data: xAxisLabels }]}
      sx={{
        '& .MuiLineElement-root': {
          strokeWidth: 2,
        },
      }}
      height={300}
      margin={{ top: 10, right: 30, bottom: 30, left: 40 }}
    />
  )
}
