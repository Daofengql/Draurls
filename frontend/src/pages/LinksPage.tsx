import { useEffect, useState } from 'react'
import { linksService } from '@/services/links'
import { domainsService } from '@/services/domains'
import type { ShortLink, Domain } from '@/types'

export default function LinksPage() {
  const [links, setLinks] = useState<ShortLink[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<number>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 加载���名列表
  useEffect(() => {
    domainsService.listActive().then(setDomains).catch(console.error)
  }, [])

  // 加载链接列表
  const loadLinks = () => {
    setLoading(true)
    linksService
      .list({ page: 1, page_size: 50 })
      .then((res) => setLinks(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadLinks()
  }, [])

  // 创建短链接
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await linksService.create({
        url,
        code: code || undefined,
        title: title || undefined,
        domain_id: selectedDomain,
      })
      setUrl('')
      setCode('')
      setTitle('')
      loadLinks()
    } catch (err: any) {
      setError(err.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 复制链接
  const copyLink = (code: string, domain: Domain) => {
    const protocol = domain.ssl ? 'https' : 'http'
    const fullUrl = `${protocol}://${domain.name}/${code}`
    navigator.clipboard.writeText(fullUrl)
  }

  // 删除链接
  const handleDelete = async (code: string) => {
    if (!confirm('确定要删除这个链接吗？')) return
    try {
      await linksService.delete(code)
      loadLinks()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">我的链接</h1>

      {/* 创建链接表单 */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">创建短链接</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              目标URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/very/long/url"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                自定义短码（可选）
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="留空自动生成"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                选择域名
              </label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {domains.map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.name} {domain.is_default ? '(默认)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              标题（可选）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="链接标题"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting || !url}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {submitting ? '创建中...' : '创建短链接'}
          </button>
        </form>
      </div>

      {/* 链接列表 */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">链接列表</h2>
        {loading ? (
          <p className="text-gray-500">加载中...</p>
        ) : links.length === 0 ? (
          <p className="text-gray-500">暂无链接</p>
        ) : (
          <div className="space-y-3">
            {links.map((link) => {
              const domain = domains.find((d) => d.id === link.domain_id) || domains[0]
              const protocol = domain?.ssl ? 'https' : 'http'
              const fullUrl = domain ? `${protocol}://${domain.name}/${link.code}` : `/${link.code}`

              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={fullUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-medium truncate"
                      >
                        {fullUrl}
                      </a>
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                        {link.click_count} 次点击
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">{link.url}</p>
                    {link.title && (
                      <p className="text-sm text-gray-600 mt-1">{link.title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => copyLink(link.code, domain)}
                      className="text-sm px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      复制
                    </button>
                    <button
                      onClick={() => handleDelete(link.code)}
                      className="text-sm px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      删除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
