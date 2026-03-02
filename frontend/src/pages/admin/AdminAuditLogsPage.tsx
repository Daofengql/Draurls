import { useEffect, useState } from 'react'
import { auditLogsService } from '@/services/admin'
import type { AuditLog } from '@/types'
import Pagination from '@/components/Pagination'
import { formatDateTime } from '@/utils/format'

// 操作类型选项
const actionOptions = [
  { value: '', label: '全部操作' },
  { value: 'user.create', label: '创建用户' },
  { value: 'user.update', label: '更新用户' },
  { value: 'user.delete', label: '删除用户' },
  { value: 'user.disable', label: '禁用用户' },
  { value: 'user.enable', label: '启用用户' },
  { value: 'user.set_group', label: '设置用户组' },
  { value: 'user.update_quota', label: '更新用户配额' },
  { value: 'link.create', label: '创建短链' },
  { value: 'link.update', label: '更新短链' },
  { value: 'link.delete', label: '删除短链' },
  { value: 'apikey.create', label: '创建API密钥' },
  { value: 'apikey.delete', label: '删除API密钥' },
  { value: 'config.update', label: '更新配置' },
  { value: 'domain.create', label: '创建域名' },
  { value: 'domain.update', label: '更新域名' },
  { value: 'domain.delete', label: '删除域名' },
  { value: 'group.create', label: '创建用户组' },
  { value: 'group.update', label: '更新用户组' },
  { value: 'group.delete', label: '删除用户组' },
]

// 操作类型显示标签映射
const actionLabels: Record<string, string> = {
  'user.create': '创建用户',
  'user.update': '更新用户',
  'user.delete': '删除用户',
  'user.disable': '禁用用户',
  'user.enable': '启用用户',
  'user.set_group': '设置用户组',
  'user.update_quota': '更新配额',
  'link.create': '创建短链',
  'link.update': '更新短链',
  'link.delete': '删除短链',
  'apikey.create': '创建密钥',
  'apikey.delete': '删除密钥',
  'config.update': '更新配置',
  'domain.create': '创建域名',
  'domain.update': '更新域名',
  'domain.delete': '删除域名',
  'group.create': '创建用户组',
  'group.update': '更新用户组',
  'group.delete': '删除用户组',
}

// 资源类型显示标签映射
const resourceLabels: Record<string, string> = {
  'user': '用户',
  'link': '短链',
  'apikey': 'API密钥',
  'config': '配置',
  'domain': '域名',
  'group': '用户组',
}

// 获取操作类型标签
const getActionLabel = (action: string) => {
  return actionLabels[action] || action
}

// 获取资源类型标签
const getResourceLabel = (resource: string) => {
  return resourceLabels[resource] || resource
}

// 获取操作类型样式
const getActionBadgeStyle = (action: string) => {
  // 创建操作 - 绿色
  if (action.endsWith('.create')) {
    return 'bg-green-100 text-green-800'
  }
  // 更新操作 - 蓝色
  if (action.endsWith('.update')) {
    return 'bg-blue-100 text-blue-800'
  }
  // 删除操作 - 红色
  if (action.endsWith('.delete') || action.endsWith('.disable')) {
    return 'bg-red-100 text-red-800'
  }
  // 启用操作 - 绿色
  if (action.endsWith('.enable')) {
    return 'bg-green-100 text-green-800'
  }
  // 默认 - 灰色
  return 'bg-gray-100 text-gray-800'
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)

  // 筛选条件
  const [filterAction, setFilterAction] = useState('')
  const [filterActorId, setFilterActorId] = useState('')

  const loadLogs = () => {
    setLoading(true)
    const params: { page: number; page_size: number; actor_id?: number; action?: string } = {
      page,
      page_size: pageSize,
    }

    if (filterAction) {
      params.action = filterAction
    }
    if (filterActorId) {
      params.actor_id = Number(filterActorId)
    }

    auditLogsService
      .list(params)
      .then((res) => {
        setLogs(res.Logs || [])
        setTotal(res.Total || 0)
      })
      .catch((err) => {
        console.error(err)
        // 使用 toast 需要导入，这里简单处理
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadLogs()
  }, [page, filterAction, filterActorId])

  const handleFilterChange = () => {
    setPage(1) // 重置到第一页
  }

  const handleActionChange = (value: string) => {
    setFilterAction(value)
    setPage(1)
  }

  const handleActorIdChange = (value: string) => {
    setFilterActorId(value)
    setPage(1)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold">审计日志</h2>
      </div>

      {/* 筛选器 */}
      <div className="card mb-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              操作类型
            </label>
            <select
              value={filterAction}
              onChange={(e) => handleActionChange(e.target.value)}
              className="input w-full text-sm"
            >
              {actionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              操作者 ID
            </label>
            <input
              type="number"
              value={filterActorId}
              onChange={(e) => handleActorIdChange(e.target.value)}
              placeholder="输入用户ID"
              className="input w-full text-sm"
              min={1}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无审计日志</div>
        ) : (
          <>
            {/* 移动端卡片布局 */}
            <div className="sm:hidden space-y-4">
              {logs.map((log) => (
                <div key={log.ID} className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded text-xs ${getActionBadgeStyle(log.Action)}`}>
                      {getActionLabel(log.Action)}
                    </span>
                    <span className="text-xs text-gray-500">#{log.ID}</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">资源</p>
                    <p className="text-sm text-gray-700">
                      {getResourceLabel(log.Resource)}
                      {log.ResourceID && ` #${log.ResourceID}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">操作者</p>
                    <p className="text-sm text-gray-700">用户 ID: {log.ActorID}</p>
                  </div>
                  {log.Details && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">详情</p>
                      <p className="text-xs text-gray-600 break-all font-mono bg-white p-2 rounded">
                        {log.Details}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">IP地址</p>
                      <p className="text-xs text-gray-700">{log.IPAddress || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">时间</p>
                      <p className="text-xs text-gray-700">{formatDateTime(log.CreatedAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 桌面端表格布局 */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">ID</th>
                    <th className="text-left py-3 px-4">操作</th>
                    <th className="text-left py-3 px-4">资源</th>
                    <th className="text-left py-3 px-4">操作者</th>
                    <th className="text-left py-3 px-4">详情</th>
                    <th className="text-left py-3 px-4">IP地址</th>
                    <th className="text-left py-3 px-4">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.ID} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-500">#{log.ID}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${getActionBadgeStyle(log.Action)}`}>
                          {getActionLabel(log.Action)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {getResourceLabel(log.Resource)}
                        {log.ResourceID && (
                          <span className="text-gray-500"> #{log.ResourceID}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        用户 {log.ActorID}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate font-mono">
                        {log.Details || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {log.IPAddress || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {formatDateTime(log.CreatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / pageSize)}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
