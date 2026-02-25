import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { usersService } from '@/services/users'
import type { QuotaStatus, DashboardStats } from '@/types'
import { formatDateTime } from '@/utils/format'
import CopyButton from '@/components/CopyButton'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      usersService.getQuotaStatus(),
      usersService.getDashboard(),
    ])
      .then(([quotaRes, statsRes]) => {
        // api.ts 拦截器已经返回 data 字段内容
        setQuotaStatus(quotaRes as QuotaStatus)
        setStats(statsRes as DashboardStats)
      })
      .catch((err) => {
        console.error(err)
      })
      .finally(() => setLoading(false))
  }, [])

  const displayName = user?.Nickname || user?.Username

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">仪表盘</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((_, index) => (
            <div key={index} className="card h-32 animate-pulse bg-gray-200" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">仪表盘</h1>
        {user?.Picture && (
          <img
            src={user.Picture}
            alt={displayName}
            className="w-12 h-12 rounded-full"
          />
        )}
      </div>

      {/* 欢迎信息 */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold">
          欢迎回来，{displayName}！
        </h2>
        <p className="text-gray-600 mt-1">
          {user?.Role === 'admin' ? '管理员' : '普通用户'}
        </p>
      </div>

      {/* 配额状态 */}
      {quotaStatus && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">配额状态</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">已使用配额</span>
                <span className="font-medium">
                  {quotaStatus.quota === -1
                    ? '无限'
                    : `${quotaStatus.quota_used} / ${quotaStatus.quota}`}
                </span>
              </div>
              {quotaStatus.quota !== -1 && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(quotaStatus.percentage, 100)}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                来源: {quotaStatus.quota_source === 'unlimited' ? '无限' : quotaStatus.quota_source === 'group' ? `用户组 (${quotaStatus.group_name})` : '个人配额'}
              </p>
            </div>
            <div className="text-sm text-gray-600">
              <p>剩余配额: <strong>{quotaStatus.quota_left === -1 ? '无限' : quotaStatus.quota_left}</strong></p>
            </div>
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard key="stat-links" title="总链接数" value={stats?.total_links || 0} icon="🔗" />
        <StatCard key="stat-clicks" title="总点击数" value={stats?.total_clicks || 0} icon="👆" />
        <StatCard key="stat-today" title="今日点击" value={stats?.today_clicks || 0} icon="📊" />
      </div>

      {/* 最近创建的链接 */}
      {stats?.recent_links && stats.recent_links.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">最近创建</h3>
          <div className="space-y-2">
            {stats.recent_links.map((link) => (
              <div
                key={link.ID || link.Code}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-600">
                    /{link.Code}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{link.URL}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDateTime(link.CreatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <span className="text-sm text-gray-500">
                    {link.ClickCount} 次点击
                  </span>
                  <CopyButton
                    text={`/${link.Code}`}
                    className="text-sm px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    复制
                  </CopyButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, icon }: { title: string; value: number; icon?: string }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-gray-500 text-sm">{title}</h3>
          <p className="text-3xl font-bold mt-2">{value.toLocaleString()}</p>
        </div>
        {icon && <span className="text-4xl">{icon}</span>}
      </div>
    </div>
  )
}
