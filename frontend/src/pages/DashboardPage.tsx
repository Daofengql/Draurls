import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { usersService } from '@/services/users'
import { domainsService } from '@/services/admin'
import type { QuotaStatus, DashboardStats, Domain } from '@/types'
import { formatDateTime } from '@/utils/format'
import CopyButton from '@/components/CopyButton'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 加载域名列表
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

  // 获取链接的完整URL
  const getFullUrl = (link: any) => {
    // 如果后端返回了 Domain 对象，直接使用
    if (link.Domain) {
      const protocol = link.Domain.SSL ? 'https' : 'http'
      return `${protocol}://${link.Domain.Name}/r/${link.Code}`
    }
    // 否则从域名列表中查找
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
    <div className="animate-fade-in space-y-6">
      {/* 欢迎信息 - 移动端简化 */}
      <div className="card bg-gradient-to-r from-blue-500 to-blue-600 text-white border-none">
        <h2 className="text-lg font-semibold">
          欢迎回来，{displayName}！
        </h2>
        <p className="text-blue-100 mt-1">
          {user?.Role === 'admin' ? '管理员' : '普通用户'}
        </p>
      </div>

      {/* 配额状态 */}
      {quotaStatus && (
        <div className="card">
          <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            配额状态
          </h3>
          <div className="space-y-4">
            {/* 进度条 */}
            <div>
              <div className="mb-2">
                <span className="text-sm text-gray-600">已使用配额</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  {quotaStatus.quota === -1 ? (
                    <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style={{ width: '100%' }} />
                  ) : (
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        quotaStatus.percentage > 90
                          ? 'bg-red-500'
                          : quotaStatus.percentage > 70
                            ? 'bg-yellow-500'
                            : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(quotaStatus.percentage, 100)}%` }}
                    />
                  )}
                </div>
                <span className="text-sm font-medium text-gray-700 min-w-[60px] text-right">
                  {quotaStatus.quota === -1
                    ? '∞'
                    : `${quotaStatus.quota_used}/${quotaStatus.quota}`}
                </span>
              </div>
              {quotaStatus.quota !== -1 && (
                <p className="text-xs text-gray-500 mt-1.5">
                  使用率: {quotaStatus.percentage.toFixed(1)}%
                  {quotaStatus.percentage > 80 && (
                    <span className="text-orange-600 ml-2">
                      ⚠️ 配额即将用完
                    </span>
                  )}
                </p>
              )}
              {quotaStatus.quota === -1 && (
                <p className="text-xs text-green-600 mt-1.5">
                  ✨ 您拥有无限配额
                </p>
              )}
            </div>

            {/* 来源信息 */}
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                配额来源:{' '}
                {quotaStatus.quota_source === 'unlimited'
                  ? '无限'
                  : quotaStatus.quota_source === 'group'
                    ? `用户组 (${quotaStatus.group_name || '默认'})`
                    : '个人配额'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <StatCard
          title="总链接数"
          value={stats?.total_links || 0}
          icon="link"
          color="blue"
        />
        <StatCard
          title="总点击数"
          value={stats?.total_clicks || 0}
          icon="chart"
          color="green"
        />
        <StatCard
          title="今日点击"
          value={stats?.today_clicks || 0}
          icon="today"
          color="purple"
        />
      </div>

      {/* 最近创建的链接 */}
      {stats?.recent_links && stats.recent_links.length > 0 && (
        <div className="card">
          <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            最近创建
          </h3>
          <div className="space-y-2">
            {stats.recent_links.map((link) => {
              const fullUrl = getFullUrl(link)
              return (
                <div
                  key={link.ID || link.Code}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <a
                      href={fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {fullUrl}
                    </a>
                    <p className="text-sm text-gray-500 truncate" title={link.URL}>{link.URL}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDateTime(link.CreatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:gap-4 ml-0 sm:ml-4">
                    <div className="text-center">
                      <span className="text-xs text-gray-500">点击</span>
                      <p className="font-semibold text-gray-700">{link.ClickCount}</p>
                    </div>
                    <CopyButton
                      text={fullUrl}
                      className="text-sm px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      复制
                    </CopyButton>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 如果没有最近链接 */}
      {stats?.recent_links && stats.recent_links.length === 0 && (
        <div className="card text-center py-8 sm:py-12">
          <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p className="text-gray-500 mb-4">还没有创建任何短链接</p>
          <a
            href="/links"
            className="btn btn-primary inline-block"
          >
            创建第一个短链接
          </a>
        </div>
      )}
    </div>
  )
}

// 骨架屏
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-20 w-full rounded-lg" />

      <div className="card">
        <div className="skeleton-text h-6 w-32 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="skeleton-text h-4 w-full mb-2" />
            <div className="skeleton h-2 w-full rounded-full" />
          </div>
          <div className="skeleton-text h-4 w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div className="skeleton-text h-4 w-20 mb-4" />
            <div className="skeleton-text h-10 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: number
  icon: 'link' | 'chart' | 'today'
  color: 'blue' | 'green' | 'purple'
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  const icons = {
    link: (
      <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    chart: (
      <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
    today: (
      <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  }

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-gray-500 text-xs sm:text-sm">{title}</h3>
          <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{value.toLocaleString()}</p>
        </div>
        <div className={`p-2 sm:p-3 rounded-lg ${colorClasses[color]}`}>
          {icons[icon]}
        </div>
      </div>
    </div>
  )
}
