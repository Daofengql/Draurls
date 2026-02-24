import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { linksService } from '@/services/links'
import type { ShortLink } from '@/types'

interface DashboardStats {
  total_links: number
  total_clicks: number
  today_clicks: number
  recent_links: ShortLink[]
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats>({
    total_links: 0,
    total_clicks: 0,
    today_clicks: 0,
    recent_links: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 获取用户统计数据
    fetch('/api/user/dashboard')
      .then((res) => res.json())
      .then((res) => {
        if (res.code === 200 && res.data) {
          setStats(res.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const displayName = user?.nickname || user?.username

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">仪表盘</h1>
        {user?.picture && (
          <img
            src={user.picture}
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
          {user?.role === 'admin' ? '管理员' : '用户'}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <h3 className="text-gray-500 text-sm">总链接数</h3>
          <p className="text-3xl font-bold mt-2">
            {loading ? '...' : stats.total_links}
          </p>
        </div>
        <div className="card">
          <h3 className="text-gray-500 text-sm">总点击数</h3>
          <p className="text-3xl font-bold mt-2">
            {loading ? '...' : stats.total_clicks}
          </p>
        </div>
        <div className="card">
          <h3 className="text-gray-500 text-sm">今日点击</h3>
          <p className="text-3xl font-bold mt-2">
            {loading ? '...' : stats.today_clicks}
          </p>
        </div>
      </div>

      {/* 最近创建的链接 */}
      {stats.recent_links && stats.recent_links.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">最近创建</h2>
          <div className="space-y-2">
            {stats.recent_links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={`/${link.code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    /{link.code}
                  </a>
                  <p className="text-sm text-gray-500 truncate">{link.url}</p>
                </div>
                <span className="text-sm text-gray-500 ml-4">
                  {link.click_count} 次点击
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
