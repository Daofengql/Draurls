import { useEffect, useState } from 'react'
import { linksService } from '@/services/links'
import { domainsService } from '@/services/domains'
import type { ShortLink, Domain } from '@/types'
import Pagination from '@/components/Pagination'
import CopyButton from '@/components/CopyButton'
import ConfirmDialog from '@/components/ConfirmDialog'
import Modal from '@/components/Modal'
import { toast } from '@/components/Toast'
import { formatDateTime, truncate } from '@/utils/format'

export default function LinksPage() {
  const [links, setLinks] = useState<ShortLink[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)

  // 创建表单
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [url, setUrl] = useState('')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<number>(1)
  const [submitting, setSubmitting] = useState(false)

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
    domainsService.listActive().then((data) => {
      setDomains(data || [])
      if (data && data.length > 0) {
        setSelectedDomain(data.find((d) => d.IsDefault)?.ID || data[0].ID)
      }
    }).catch(console.error)
  }, [])

  // 加载链接列表
  const loadLinks = () => {
    setLoading(true)
    linksService
      .list({ page, page_size: pageSize })
      .then((res) => {
        console.log('Links received:', res)
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
  }, [page])

  // 创建短链接
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await linksService.create({
        url,
        code: code || undefined,
        title: title || undefined,
        domain_id: selectedDomain,
      })
      toast.success('短链接创建成功')
      setUrl('')
      setCode('')
      setTitle('')
      setShowCreateModal(false)
      loadLinks()
    } catch (err: any) {
      toast.error(err.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 打开编辑弹窗
  const openEditModal = async (link: ShortLink) => {
    setEditLink(link)
    setEditForm({ title: link.Title || '', url: link.URL, status: link.Status })
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editLink) return

    try {
      await linksService.update(editLink.code, {
        title: editForm.title,
        url: editForm.url,
        status: editForm.status as any,
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
    try {
      const data = await linksService.stats(link.Code)
      setStats(data || null)
    } catch (err) {
      console.error(err)
    }
  }

  // 删除链接
  const handleDelete = async () => {
    if (!deleteConfirm) return

    try {
      await linksService.delete(deleteConfirm.Code)
      toast.success('链接已删除')
      setDeleteConfirm(null)
      loadLinks()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    }
  }

  // 获取链接的完整URL
  const getFullUrl = (link: ShortLink) => {
    const domain = domains.find((d) => d.ID === link.DomainID) || domains[0]
    if (domain) {
      const protocol = domain.SSL ? 'https' : 'http'
      return `${protocol}://${domain.Name}/${link.Code}`
    }
    return `/${link.Code}`
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">我的链接</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          创建短链接
        </button>
      </div>

      {/* 链接列表 */}
      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : links.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-4">暂无链接</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              创建第一个短链接
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">短链接</th>
                    <th className="text-left py-3 px-4">目标URL</th>
                    <th className="text-left py-3 px-4">标题</th>
                    <th className="text-left py-3 px-4">状态</th>
                    <th className="text-left py-3 px-4">点击</th>
                    <th className="text-left py-3 px-4">创建时间</th>
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
                        <td className="py-3 px-4">{getStatusBadge(link.Status)}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => viewStats(link)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            {link.ClickCount}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {formatDateTime(link.CreatedAt)}
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

      {/* 创建弹窗 */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="创建短链接"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreateModal(false)}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button
              form="create-form"
              type="submit"
              disabled={submitting || !url}
              className="btn btn-primary disabled:bg-gray-300"
            >
              {submitting ? '创建中...' : '创建'}
            </button>
          </div>
        }
      >
        <form id="create-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              目标URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/very/long/url"
              className="input w-full"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                自定义短码
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="留空自动生成"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                选择域名
              </label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(Number(e.target.value))}
                className="input w-full"
              >
                {domains.map((domain) => (
                  <option key={domain.ID} value={domain.ID}>
                    {domain.Name} {domain.IsDefault ? '(默认)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              标题
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="链接标题"
              className="input w-full"
            />
          </div>
        </form>
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        isOpen={!!editLink}
        onClose={() => setEditLink(null)}
        title="编辑短链接"
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
              className="input w-full"
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
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              状态
            </label>
            <select
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              className="input w-full"
            >
              <option key="active" value="active">正常</option>
              <option key="disabled" value="disabled">禁用</option>
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
