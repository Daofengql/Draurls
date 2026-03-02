import { useEffect, useState } from 'react'
import { linksService } from '@/services/links'
import { domainsService } from '@/services/domains'
import { configService, type SiteConfig } from '@/services/config'
import type { ShortLink, Domain, RedirectTemplate } from '@/types'
import Pagination from '@/components/Pagination'
import CopyButton from '@/components/CopyButton'
import ConfirmDialog from '@/components/ConfirmDialog'
import Modal from '@/components/Modal'
import { toast } from '@/components/Toast'
import { formatDateTime, truncate } from '@/utils/format'
import { HelpModal } from '@/components/HelpTooltip'

export default function LinksPage() {
  const [links, setLinks] = useState<ShortLink[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [templates, setTemplates] = useState<RedirectTemplate[]>([])
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null)
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
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 编辑弹窗
  const [editLink, setEditLink] = useState<ShortLink | null>(null)
  const [editForm, setEditForm] = useState({ title: '', url: '', status: 'active', template_id: null as number | null })

  // 统计弹窗
  const [statsLink, setStatsLink] = useState<ShortLink | null>(null)
  const [stats, setStats] = useState<{ click_count: number; unique_ips: number } | null>(null)

  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<ShortLink | null>(null)

  // 帮助文档弹窗
  const [showHelpModal, setShowHelpModal] = useState(false)

  // 加载域名列表和站点配置
  useEffect(() => {
    domainsService.listActive().then((data) => {
      setDomains(data || [])
      if (data && data.length > 0) {
        setSelectedDomain(data.find((d) => d.IsDefault)?.ID || data[0].ID)
      }
    }).catch(console.error)

    // 加载站点配置
    configService.get().then((config) => {
      setSiteConfig(config as SiteConfig)
    }).catch(console.error)

    // 加载模板列表
    configService.getTemplates().then((data) => {
      setTemplates(data || [])
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
        template_id: selectedTemplate ?? null,
      })
      toast.success('短链接创建成功')
      setUrl('')
      setCode('')
      setTitle('')
      setSelectedTemplate(null)
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
    setEditForm({
      title: link.Title || '',
      url: link.URL,
      status: link.Status,
      template_id: link.TemplateID || null
    })
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editLink) return

    try {
      await linksService.update(editLink.Code, {
        Title: editForm.title,
        URL: editForm.url,
        Status: editForm.status as any,
        TemplateID: editForm.template_id ?? null,
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">我的链接</h1>
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="text-gray-400 hover:text-gray-600 focus:outline-none p-1"
            title="查看使用说明"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
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
                        <p className="text-xs text-gray-500">点击数</p>
                        <button
                          onClick={() => viewStats(link)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {link.ClickCount}
                        </button>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">创建时间</p>
                        <p className="text-gray-600">{formatDateTime(link.CreatedAt)}</p>
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
        title={
          <div className="flex items-center gap-2">
            创建短链接
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
              title="查看使用说明"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        }
        size="medium"
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
              className="input w-full text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                自定义短码
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="留空自动生成"
                className="input w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                选择域名
              </label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(Number(e.target.value))}
                className="input w-full text-sm"
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
              className="input w-full text-sm"
            />
          </div>
          {/* 跳转模板选择 - 仅在启用跳转页且允许用户选择时显示 */}
          {siteConfig?.redirect_page_enabled === 'true' && siteConfig?.allow_user_template === 'true' && templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                跳转模板
              </label>
              <select
                value={selectedTemplate || ''}
                onChange={(e) => setSelectedTemplate(e.target.value ? Number(e.target.value) : null)}
                className="input w-full text-sm"
              >
                <option value="">使用默认模板</option>
                {templates.map((template) => (
                  <option key={template.ID} value={template.ID}>
                    {template.Name} {template.IsDefault ? '(默认)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                选择用户访问此链接时显示的跳转页面模板
              </p>
            </div>
          )}
        </form>
      </Modal>

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
              <option key="active" value="active">正常</option>
              <option key="disabled" value="disabled">禁用</option>
            </select>
          </div>
          {/* 跳转模板选择 - 仅在启用跳转页且允许用户选择时显示 */}
          {siteConfig?.redirect_page_enabled === 'true' && siteConfig?.allow_user_template === 'true' && templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                跳转模板
              </label>
              <select
                value={editForm.template_id || ''}
                onChange={(e) => setEditForm({ ...editForm, template_id: e.target.value ? Number(e.target.value) : null })}
                className="input w-full text-sm"
              >
                <option value="">使用默认模板</option>
                {templates.map((template) => (
                  <option key={template.ID} value={template.ID}>
                    {template.Name} {template.IsDefault ? '(默认)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
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

      {/* 创建链接帮助文档 */}
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="创建短链接说明"
      >
        <div className="space-y-4">
          <section>
            <h4 className="font-medium text-gray-900 mb-2">字段说明</h4>
            <dl className="space-y-2">
              <div className="bg-gray-50 p-3 rounded">
                <dt className="font-medium text-gray-700">目标URL *</dt>
                <dd className="text-sm text-gray-600">需要缩短的长链接，必须以 http:// 或 https:// 开头</dd>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <dt className="font-medium text-gray-700">自定义短码</dt>
                <dd className="text-sm text-gray-600">
                  可选。留空则系统自动生成随机短码。
                  自定义短码建议使用字母、数字组合，便于记忆。
                </dd>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <dt className="font-medium text-gray-700">选择域名</dt>
                <dd className="text-sm text-gray-600">
                  选择短链接使用的域名。不同域名可以用于不同业务场景。
                </dd>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <dt className="font-medium text-gray-700">标题</dt>
                <dd className="text-sm text-gray-600">
                  可选。为链接添加描述性标题，便于后续管理和识别。
                </dd>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <dt className="font-medium text-blue-700">跳转模板</dt>
                <dd className="text-sm text-gray-600">
                  选择用户访问短链接时显示的跳转页面模板。
                  仅在管理员启用了跳转页面并允许用户选择模板时可用。
                  不同模板可以有不同的视觉风格和提示信息。
                </dd>
              </div>
            </dl>
          </section>
          <section>
            <h4 className="font-medium text-gray-900 mb-2">使用提示</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>相同的目标URL会自动复用已有的短链接</li>
              <li>自定义短码不能与已有短码重复</li>
              <li>短链接创建后可以随时编辑目标URL和标题</li>
              <li>如果未选择模板，将使用系统默认跳转模板</li>
            </ul>
          </section>
          {siteConfig?.redirect_page_enabled !== 'true' && (
            <section className="bg-yellow-50 border border-yellow-200 p-3 rounded">
              <h4 className="font-medium text-yellow-800 mb-1">模板功能未启用</h4>
              <p className="text-sm text-yellow-700">
                当前跳转页面功能未启用，模板选择不可用。
                如需使用，请联系管理员在"站点配置"中启用"跳转页面设置"。
              </p>
            </section>
          )}
        </div>
      </HelpModal>
    </div>
  )
}
