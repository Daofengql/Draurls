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
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card h-32 animate-pulse bg-gray-200" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="总用户数"
          value={summary?.total_users || 0}
          change={summary?.today_users || 0}
          changeLabel="今日新增"
        />
        <StatCard
          title="总链接数"
          value={summary?.total_links || 0}
          change={summary?.today_links || 0}
          changeLabel="今日新增"
        />
        <StatCard
          title="总点击数"
          value={summary?.total_clicks || 0}
          change={summary?.today_clicks || 0}
          changeLabel="今日点击"
        />
        <StatCard
          title="活跃用户"
          value={summary?.active_users || 0}
          suffix="人"
        />
      </div>

      {/* 趋势图表 */}
      {trends.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">近30天趋势</h2>
          <div className="h-64">
            <TrendChart data={trends} />
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  change,
  changeLabel,
  suffix = '',
}: {
  title: string
  value: number
  change?: number
  changeLabel?: string
  suffix?: string
}) {
  return (
    <div className="card">
      <h3 className="text-gray-500 text-sm">{title}</h3>
      <p className="text-3xl font-bold mt-2">
        {value.toLocaleString()}
        {suffix}
      </p>
      {change !== undefined && changeLabel && (
        <p className={`text-sm mt-2 ${change >= 0 ? 'text-green-600' : 'text-gray-500'}`}>
          {change >= 0 ? '+' : ''}{change} {changeLabel}
        </p>
      )}
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

  return (
    <div className="h-full flex items-end gap-1">
      {data.map((item, i) => (
        <div
          key={i}
          className="flex-1 flex flex-col gap-1 group"
          title={`${item.date}: ${item.links} 链接, ${item.clicks} 点击`}
        >
          {/* 点击条 */}
          <div
            className="bg-blue-400 hover:bg-blue-500 transition-colors rounded-t"
            style={{
              height: `${(item.clicks / maxValues.clicks) * 100}%`,
              minHeight: item.clicks > 0 ? '2px' : '0',
            }}
          />
          {/* 链接条 */}
          <div
            className="bg-green-400 hover:bg-green-500 transition-colors rounded-t"
            style={{
              height: `${(item.links / maxValues.links) * 30}%`,
              minHeight: item.links > 0 ? '2px' : '0',
            }}
          />
        </div>
      ))}
    </div>
  )
}
