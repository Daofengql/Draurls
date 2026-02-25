import { useEffect, useState } from 'react'
import { dashboardService } from '@/services/admin'
import type { AdminSummary, TrendData } from '@/types'

export default function AdminOverviewPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [trends, setTrends] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      dashboardService.getSummary(),
      dashboardService.getTrends(30),
    ])
      .then(([summaryData, trendData]) => {
        // api.ts 拦截器已经返回 data 字段内容
        setSummary(summaryData)
        // 趋势数据是嵌套在 daily_data 中的
        setTrends(trendData.daily_data || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <AdminOverviewSkeleton />
  }

  return (
    <div className="animate-fade-in">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
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
      </div>

      {/* 趋势图表 */}
      {trends.length > 0 && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              近30天趋势
            </h2>
            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span className="text-gray-600">点击数</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span className="text-gray-600">链接数</span>
              </div>
            </div>
          </div>
          <div className="h-48 sm:h-64">
            <TrendChart data={trends} />
          </div>
        </div>
      )}
    </div>
  )
}

// 骨架屏
function AdminOverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card">
          <div className="skeleton-text h-4 w-20 mb-2" />
          <div className="skeleton-text h-8 w-24 mb-2" />
          <div className="skeleton-text h-3 w-32" />
        </div>
      ))}
      <div className="card lg:col-span-4">
        <div className="skeleton-text h-6 w-32 mb-4" />
        <div className="skeleton h-64 w-full" />
      </div>
    </div>
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

function StatCard({
  title,
  value,
  change,
  changeLabel,
  suffix = '',
  icon,
  color,
}: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  }

  const icons = {
    users: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    links: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    clicks: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
    ),
    active: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-gray-500 text-xs sm:text-sm">{title}</h3>
          <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">
            {value.toLocaleString()}
            {suffix}
          </p>
          {change !== undefined && changeLabel && (
            <p className={`text-xs sm:text-sm mt-1.5 sm:mt-2 flex items-center gap-1 ${
              change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
            }`}>
              {change > 0 ? (
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              ) : change < 0 ? (
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              ) : null}
              <span className="truncate">{change >= 0 ? '+' : ''}{change} {changeLabel}</span>
            </p>
          )}
        </div>
        <div className={`p-2 sm:p-2.5 rounded-lg ${colorClasses[color]} flex-shrink-0`}>
          <div className="w-5 h-5 sm:w-7 sm:h-7">
            {icons[icon]}
          </div>
        </div>
      </div>
    </div>
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

  return (
    <div className="h-full flex items-end gap-1">
      {data.map((item, i) => (
        <div
          key={i}
          className="flex-1 flex flex-col gap-0.5 group relative"
          title={`${item.date}: ${item.links} 链接, ${item.clicks} 点击`}
        >
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            {formatDate(item.date)}: {item.links} 链接, {item.clicks} 点击
          </div>

          {/* 点击条 */}
          <div
            className="bg-blue-500 hover:bg-blue-600 transition-colors rounded-t"
            style={{
              height: `${(item.clicks / maxValues.clicks) * 80}%`,
              minHeight: item.clicks > 0 ? '2px' : '0',
            }}
          />
          {/* 链接条 */}
          <div
            className="bg-green-500 hover:bg-green-600 transition-colors rounded-t"
            style={{
              height: `${(item.links / maxValues.links) * 20}%`,
              minHeight: item.links > 0 ? '2px' : '0',
            }}
          />
        </div>
      ))}
    </div>
  )
}
