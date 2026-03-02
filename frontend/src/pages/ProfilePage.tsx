import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { usersService } from '@/services/users'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'
import type { User, QuotaStatus } from '@/types'

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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'text-green-600',
      disabled: 'text-red-600',
      deleted: 'text-gray-400',
    }
    return colors[status] || 'text-gray-600'
  }

  const getQuotaPercentage = () => {
    if (!quotaStatus || quotaStatus.quota === -1) return 0
    return quotaStatus.percentage
  }

  const getQuotaColor = () => {
    const percentage = getQuotaPercentage()
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 70) return 'text-yellow-600'
    return 'text-green-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">无法加载用户信息</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-0">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">个人信息</h1>
      </div>

      {/* 基本信息 */}
      <div className="card mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">基本信息</h2>

        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          {/* 头像 - 居中 */}
          <div className="flex-shrink-0 mx-auto sm:mx-0">
            {profile.Picture ? (
              <img
                src={profile.Picture}
                alt={profile.Nickname || profile.Username}
                className="w-16 h-16 sm:w-24 sm:h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl sm:text-2xl font-semibold">
                {(profile.Nickname || profile.Username).charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* 用户信息 */}
          <div className="flex-1 w-full">
            <div className="space-y-2 sm:space-y-2 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 items-center justify-center sm:justify-start">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {profile.Nickname || profile.Username}
                </h3>
                {profile.Role === 'admin' && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                    管理员
                  </span>
                )}
                <span className={`text-sm ${getStatusColor(profile.Status)}`}>
                  {getStatusLabel(profile.Status)}
                </span>
              </div>

              {/* 网格布局信息 */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600 mt-3 sm:mt-0">
                <div className="break-words">
                  <span className="text-gray-400 text-xs">用户ID:</span> {profile.ID}
                </div>
                <div className="break-words">
                  <span className="text-gray-400 text-xs">角色:</span> {getRoleLabel(profile.Role)}
                </div>
                <div className="col-span-2 break-all">
                  <span className="text-gray-400 text-xs">用户名:</span> {profile.Username}
                </div>
                <div className="col-span-2 break-all">
                  <span className="text-gray-400 text-xs">邮箱:</span> {profile.Email}
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400 text-xs">注册:</span> {formatDateTime(profile.CreatedAt)}
                </div>
                {profile.LastLoginAt && (
                  <div className="col-span-2">
                    <span className="text-gray-400 text-xs">上次:</span> {formatDateTime(profile.LastLoginAt)}
                  </div>
                )}
                {profile.LastLoginIP && (
                  <div className="col-span-2 break-all">
                    <span className="text-gray-400 text-xs">IP:</span> {profile.LastLoginIP}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 配额信息 */}
      <div className="card mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">配额信息</h2>

        {quotaStatus ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm sm:text-base text-gray-600">配额类型</span>
              <span className="font-medium text-gray-900 text-sm sm:text-base text-right">
                {quotaStatus.quota_source === 'unlimited'
                  ? '无限配额'
                  : quotaStatus.group_name
                    ? `用户组 (${quotaStatus.group_name})`
                    : '用户配额'}
              </span>
            </div>

            {quotaStatus.quota !== -1 && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">已使用</span>
                    <span className="text-gray-900">
                      {quotaStatus.quota_used} / {quotaStatus.quota}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(getQuotaPercentage(), 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">剩余</span>
                    <span className={`font-medium ${getQuotaColor()}`}>
                      {quotaStatus.quota_left}
                    </span>
                  </div>
                </div>
              </>
            )}

            {quotaStatus.quota === -1 && (
              <div className="text-sm text-gray-500">
                您拥有无限配额，可创建无限数量的短链接
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500 text-sm">加载配额信息中...</div>
        )}
      </div>

      {/* 退出登录 */}
      <div className="card">
        <button
          onClick={handleLogout}
          className="w-full text-left px-4 py-3 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-red-600"
        >
          <div className="flex items-center justify-between">
            <span>退出登录</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4h-3m-1-4h4m-3 4h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </button>
      </div>
    </div>
  )
}
