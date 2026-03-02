import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { usersService } from '@/services/users'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'
import type { User, QuotaStatus } from '@/types'

export default function ProfilePage() {
  const setUser = useAuthStore((state) => state.setUser)
  const logout = useAuthStore((state) => state.logout)
  const currentUser = useAuthStore((state) => state.user)

  const [user, setUser] = useState<User | null>(null)
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ nickname: '' })

  const loadProfile = async () => {
    setLoading(true)
    try {
      const [profileData, quotaData] = await Promise.all([
        usersService.getProfile(),
        usersService.getQuotaStatus(),
      ])
      setUser(profileData)
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

  const handleEdit = () => {
    setEditForm({ nickname: user?.Nickname || '' })
    setEditing(true)
  }

  const handleSave = async () => {
    // TODO: 调用更新用户信息API
    setUser(user ? { ...user, Nickname: editForm.nickname } : null)
    setEditing(false)
    toast.success('个人信息已更新')
  }

  const handleCancel = () => {
    setEditing(false)
    setEditForm({ nickname: user?.Nickname || '' })
  }

  const handleLogout = () => {
    logout()
    toast.success('已退出登录')
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

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">无法加载用户信息</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">���人信息</h1>
      </div>

      {/* 基本信息卡片 */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">基本信息</h2>
          {!editing && (
            <button
              onClick={handleEdit}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              编辑
            </button>
          )}
        </div>

        <div className="flex items-start gap-6">
          {/* 头像 */}
          <div className="flex-shrink-0">
            {user.Picture ? (
              <img
                src={user.Picture}
                alt={user.Nickname || user.Username}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
                {(user.Nickname || user.Username).charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* 用户信息 */}
          <div className="flex-1">
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    昵称
                  </label>
                  <input
                    type="text"
                    value={editForm.nickname}
                    onChange={(e) => setEditForm({ nickname: e.target.value })}
                    className="input w-full max-w-xs"
                    placeholder="输入昵称"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleSave} className="btn btn-primary">
                    保存
                  </button>
                  <button onClick={handleCancel} className="btn btn-secondary">
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {user.Nickname || user.Username}
                  </h3>
                  {user.Role === 'admin' && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                      管理员
                    </span>
                  )}
                  <span className={`text-sm ${getStatusColor(user.Status)}`}>
                    {getStatusLabel(user.Status)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>用户名: {user.Username}</p>
                  <p>邮箱: {user.Email}</p>
                  <p>角色: {getRoleLabel(user.Role)}</p>
                  <p>注册时间: {formatDateTime(user.CreatedAt)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 配额信息卡片 */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">配额信息</h2>

        {quotaStatus ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">配额类型</span>
              <span className="font-medium text-gray-900">
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

      {/* 账户操作 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">账户操作</h2>
        <div className="space-y-4">
          <button
            onClick={() => {
              // TODO: 实现修改密码功能
              toast.info('修改密码功能即将推出')
            }}
            className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span>修改密码</span>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

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
    </div>
  )
}
