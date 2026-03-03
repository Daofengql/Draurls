import { useEffect, useState } from 'react'
import { adminLinksService, domainsService } from '@/services/admin'
import type { ShortLink, Domain } from '@/types'
import Pagination from '@/components/Pagination'
import CopyButton from '@/components/CopyButton'
import ConfirmDialog from '@/components/ConfirmDialog'
import Modal from '@/components/Modal'
import { toast } from '@/components/Toast'
import { formatDateTime, truncate } from '@/utils/format'

export default function AdminLinksPage() {
  const [links, setLinks] = useState<ShortLink[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)

  // 过滤器
  const [filterDomain, setFilterDomain] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterUserId, setFilterUserId] = useState<string>('')

  // 编辑弹窗
  const [editLink, setEditLink] = useState<ShortLink | null>(null)
  const [editForm, setEditForm] = useState({ title: '', url: '', status: 'active' })

  // 统计弹窗
  const [statsLink, setStatsLink] = useState<ShortLink | null>(null)
  const [stats, setStats] = useState<{ click_count: number; unique_ips: number } | null>(null)

  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<ShortLink | null>(null)

  // 加载域名列表
  useEffect(() => {
    domainsService.list().then((data) => {
      setDomains(data || [])
    }).catch(console.error)
  }, [])

  // 加载链接列表
  const loadLinks = () => {
    setLoading(true)
    const params: {
      page: number
      page_size: number
      domain_id?: number
      status?: string
      user_id?: number
    } = {
      page,
      page_size: pageSize,
    }
    if (filterDomain) params.domain_id = filterDomain
    if (filterStatus) params.status = filterStatus
    if (filterUserId) params.user_id = Number(filterUserId)

    adminLinksService
      .list(params)
      .then((res) => {
        setLinks(res.data || [])
        setTotal(res.total || 0)
      })
      .catch((err) => {
        console.error(err)
        toast.error('加载链接列表失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadLinks()
  }, [page, filterDomain, filterStatus, filterUserId])

  // 打开编辑弹窗
  const openEditModal = async (link: ShortLink) => {
    setEditLink(link)
    setEditForm({
      title: link.Title || '',
      url: link.URL,
      status: link.Status,
    })
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editLink) return

    try {
      await adminLinksService.update(editLink.ID, {
        url: editForm.url,
        title: editForm.title,
        status: editForm.status,
      })
      toast.success('链接更新成功')
      setEditLink(null)
      loadLinks()
    } catch (err: any) {
      toast.error(err.message || '更新失败')
    }
  }

  // 查看统计
  const viewStats = async (link: ShortLink) => {
    setStatsLink(link)
    // TODO: 后端需要添加管理员获取统计的接口
    // 暂时跳过
    setStats({ click_count: link.ClickCount, unique_ips: 0 })
  }

  // 删除链接
  const handleDelete = async () => {
    if (!deleteConfirm) return

    try {
      await adminLinksService.delete(deleteConfirm.ID)
      toast.success('链接已删除')
      setDeleteConfirm(null)
      loadLinks()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    }
  }

  // 重置过滤器
  const resetFilters = () => {
    setFilterDomain(null)
    setFilterStatus('')
    setFilterUserId('')
  }

  // 获取链接的完整URL
  const getFullUrl = (link: ShortLink) => {
    const domain = domains.find((d) => d.ID === link.DomainID) || domains[0]
    if (domain) {
      const protocol = domain.SSL ? 'https' : 'http'
      return `${protocol}://${domain.Name}/r/${link.Code}`
    }
    return `/r/${link.Code}`
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      disabled: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    }
    const labels: Record<string, string> = {
      active: '正常',
      disabled: '禁用',
      expired: '过期',
    }
    const style = styles[status] || 'bg-gray-100 text-gray-800'
    const label = labels[status] || '未知'
    return (
      <span className={`px-2 py-1 rounded text-xs ${style}`}>
        {label}
      </span>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold">短链接管理</h2>
      </div>

      {/* 过滤器 */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">域名</label>
            <select
              value={filterDomain || ''}
              onChange={(e) => setFilterDomain(e.target.value ? Number(e.target.value) : null)}
              className="input w-full text-sm"
            >
              <option value="">全部域名</option>
              {domains.map((d) => (
                <option key={d.ID} value={d.ID}>
                  {d.Name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input w-full text-sm"
            >
              <option value="">全部状态</option>
              <option value="active">正常</option>
              <option value="disabled">禁用</option>
              <option value="expired">过期</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户ID</label>
            <input
              type="number"
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              placeholder="输入用户ID"
              className="input w-full text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="btn btn-secondary w-full text-sm"
            >
              重置过滤
            </button>
          </div>
        </div>
      </div>

      {/* 链接列表 */}
      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : links.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>暂无链接</p>
          </div>
        ) : (
          <>
            {/* 移动端卡片布局 */}
            <div className="sm:hidden space-y-4">
              {links.map((link) => {
                const fullUrl = getFullUrl(link)
                return (
                  <div key={link.ID} className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <a
                        href={fullUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm break-all"
                      >
                        {fullUrl}
                      </a>
                      {getStatusBadge(link.Status)}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">目标URL</p>
                      <p className="text-sm text-gray-600 truncate" title={link.URL}>
                        {truncate(link.URL, 60)}
                      </p>
                    </div>
                    {link.Title && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">标题</p>
                        <p className="text-sm text-gray-600">{link.Title}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">创建者</p>
                        <p className="text-gray-600">ID: {link.UserID}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">点击数</p>
                        <button
                          onClick={() => viewStats(link)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {link.ClickCount}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                      <CopyButton text={fullUrl} className="text-xs px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded">
                        复制
                      </CopyButton>
                      <button
                        onClick={() => openEditModal(link)}
                        className="text-xs px-3 py-1.5 text-green-600 hover:bg-green-50 rounded"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(link)}
                        className="text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 桌面端表格布局 */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">短链接</th>
                    <th className="text-left py-3 px-4">目标URL</th>
                    <th className="text-left py-3 px-4">标题</th>
                    <th className="text-left py-3 px-4">创建者</th>
                    <th className="text-left py-3 px-4">状态</th>
                    <th className="text-left py-3 px-4">点击</th>
                    <th className="text-right py-3 px-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => {
                    const fullUrl = getFullUrl(link)
                    return (
                      <tr key={link.ID} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {fullUrl}
                          </a>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <p className="text-sm text-gray-500 truncate" title={link.URL}>
                            {truncate(link.URL, 50)}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {link.Title || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          ID: {link.UserID}
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(link.Status)}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => viewStats(link)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            {link.ClickCount}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <CopyButton
                              text={fullUrl}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              复制
                            </CopyButton>
                            <button
                              onClick={() => openEditModal(link)}
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(link)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
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

      {/* 编辑弹窗 */}
      <Modal
        isOpen={!!editLink}
        onClose={() => setEditLink(null)}
        title="编辑短链接"
        size="medium"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setEditLink(null)}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button onClick={handleSaveEdit} className="btn btn-primary">
              保存
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              目标URL
            </label>
            <input
              type="url"
              value={editForm.url}
              onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
              className="input w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              标题
            </label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="input w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              状态
            </label>
            <select
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              className="input w-full text-sm"
            >
              <option value="active">正常</option>
              <option value="disabled">禁用</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* 统计弹窗 */}
      <Modal
        isOpen={!!statsLink}
        onClose={() => setStatsLink(null)}
        title="链接统计"
        footer={
          <div className="flex justify-end">
            <button
              onClick={() => setStatsLink(null)}
              className="btn btn-primary"
            >
              关闭
            </button>
          </div>
        }
      >
        {statsLink && (
          <div>
            <p className="mb-4 text-gray-600">
              短链接: <strong>{getFullUrl(statsLink)}</strong>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">总点击数</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.click_count || 0}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">独立IP</p>
                <p className="text-2xl font-bold text-green-600">{stats?.unique_ips || 0}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="删除短链接"
        message={`确定要删除短链接 "${deleteConfirm?.Code}" 吗？此操作不可撤销。`}
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
