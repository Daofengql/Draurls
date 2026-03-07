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
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="-semibold">
                近30天趋势
              </Typography>
            </Stack>
            <Box sx={{ height: { xs: 192, sm: 256 } }}>
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
          <Skeleton variant="rectangular" height={256} width="100%" />
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
  const maxValues = data.reduce(
    (acc, item) => ({
      links: Math.max(acc.links, item.links),
      clicks: Math.max(acc.clicks, item.clicks),
    }),
    { links: 1, clicks: 1 }
  )

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  // SVG 尺寸配置
  const svgWidth = 800
  const svgHeight = 200
  const padding = { top: 20, right: 20, bottom: 20, left: 40 }

  // 计算绘图区域
  const plotWidth = svgWidth - padding.left - padding.right
  const plotHeight = svgHeight - padding.top - padding.bottom

  // 生成点击数据路径
  const clicksPath = data.map((item, i) => {
    const x = padding.left + (i / (data.length - 1)) * plotWidth
    const y = padding.top + plotHeight - (item.clicks / maxValues.clicks) * plotHeight
    return `${x},${y}`
  }).join(' ')

  // 生成链接数据路径
  const linksPath = data.map((item, i) => {
    const x = padding.left + (i / (data.length - 1)) * plotWidth
    const y = padding.top + plotHeight - (item.links / maxValues.links) * plotHeight
    return `${x},${y}`
  }).join(' ')

  // 生成数据点
  const clicksPoints = data.map((item, i) => {
    const x = padding.left + (i / (data.length - 1)) * plotWidth
    const y = padding.top + plotHeight - (item.clicks / maxValues.clicks) * plotHeight
    return { x, y, value: item.clicks, date: item.date }
  })

  const linksPoints = data.map((item, i) => {
    const x = padding.left + (i / (data.length - 1)) * plotWidth
    const y = padding.top + plotHeight - (item.links / maxValues.links) * plotHeight
    return { x, y, value: item.links, date: item.date }
  })

  // Y轴刻度
  const yAxisTicks = [0, 25, 50, 75, 100].map(pct => ({
    y: padding.top + plotHeight - (pct / 100) * plotHeight,
    label: Math.round(maxValues.clicks * pct / 100)
  }))

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        position: 'relative',
      }}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', height: '100%' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y轴标签 */}
        {yAxisTicks.map((tick, i) => (
          <text
            key={i}
            x={padding.left - 8}
            y={tick.y + 4}
            textAnchor="end"
            fill="#9ca3af"
            fontSize="12"
          >
            {tick.label}
          </text>
        ))}

        {/* 水平网格线 */}
        {[0, 25, 50, 75, 100].map((pct, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={padding.top + plotHeight - (pct / 100) * plotHeight}
            x2={svgWidth - padding.right}
            y2={padding.top + plotHeight - (pct / 100) * plotHeight}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {/* 点击折线 */}
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          points={clicksPath}
        />

        {/* 链接折线 */}
        <polyline
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          points={linksPath}
        />

        {/* 点击数据点 */}
        {clicksPoints.map((point, i) => (
          <circle
            key={`click-${i}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#3b82f6"
            style={{ transition: 'r 0.2s', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.setAttribute('r', '6')}
            onMouseLeave={(e) => e.currentTarget.setAttribute('r', '4')}
          />
        ))}

        {/* 链接数据点 */}
        {linksPoints.map((point, i) => (
          <circle
            key={`link-${i}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#22c55e"
            style={{ transition: 'r 0.2s', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.setAttribute('r', '6')}
            onMouseLeave={(e) => e.currentTarget.setAttribute('r', '4')}
          />
        ))}
      </svg>

      {/* 图例 - 右上角 */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          display: 'flex',
          gap: 2,
          fontSize: '0.75rem',
          bgcolor: 'rgba(255, 255, 255, 0.8)',
          px: 1,
          py: 0.5,
          borderRadius: 1,
        }}
      >
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: 'primary.main',
            }}
          />
          <Typography variant="caption" color="text.secondary">
            点击数
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: 'success.main',
            }}
          />
          <Typography variant="caption" color="text.secondary">
            链接数
          </Typography>
        </Stack>
      </Box>

      {/* 悬停提示 */}
      {data.map((item, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            inset: 0,
            left: `${((i / (data.length - 1)) * plotWidth / svgWidth) * 100}%`,
            width: `${(plotWidth / (data.length - 1) / svgWidth) * 100}%`,
            top: 0,
            height: '100%',
            '&:hover .tooltip': {
              opacity: 1,
            },
          }}
        >
          <Box
            className="tooltip"
            sx={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              mb: 0.5,
              px: 1,
              py: 0.5,
              bgcolor: 'grey.800',
              color: 'white',
              fontSize: '0.75rem',
              borderRadius: 0.5,
              opacity: 0,
              transition: 'opacity 0.2s',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 10,
            }}
          >
            {formatDate(item.date)}: {item.links} 链接, {item.clicks} 点击
          </Box>
        </Box>
      ))}
    </Box>
  )
}
