import { useEffect, useState } from 'react'
import { domainsService } from '@/services/admin'
import type { Domain } from '@/types'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'
import { getDomainValidationError } from '@/utils/validator'

export default function AdminDomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)

  // 创建/编辑
  const [showModal, setShowModal] = useState(false)
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ssl: true,
    is_active: true,
  })
  const [nameError, setNameError] = useState<string | null>(null)

  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<Domain | null>(null)

  const loadDomains = () => {
    setLoading(true)
    domainsService
      .list()
      .then((data) => setDomains(data || []))
      .catch((err) => {
        console.error(err)
        toast.error('加载域名列表失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadDomains()
  }, [])

  const handleCreate = () => {
    setEditingDomain(null)
    setFormData({ name: '', description: '', ssl: true, is_active: true })
    setNameError(null)
    setShowModal(true)
  }

  const handleEdit = (domain: Domain) => {
    setEditingDomain(domain)
    setFormData({
      name: domain.Name,
      description: domain.Description || '',
      ssl: domain.SSL,
      is_active: domain.IsActive,
    })
    setNameError(null)
    setShowModal(true)
  }

  const handleNameChange = (value: string) => {
    setFormData({ ...formData, name: value })
    // 实时验证
    if (value.trim()) {
      const error = getDomainValidationError(value)
      setNameError(error)
    } else {
      setNameError(null)
    }
  }

  const handleSave = async () => {
    // 前端验证
    const error = getDomainValidationError(formData.name)
    if (error) {
      setNameError(error)
      toast.error(error)
      return
    }

    try {
      if (editingDomain) {
        await domainsService.update(editingDomain.ID, formData)
        toast.success('域名更新成功')
      } else {
        await domainsService.create(formData)
        toast.success('域名创建成功')
      }
      setShowModal(false)
      loadDomains()
    } catch (err: any) {
      toast.error(err.message || '保存失败')
    }
  }

  const handleSetDefault = async (id: number) => {
    try {
      await domainsService.setDefault(id)
      toast.success('默认域名已设置')
      loadDomains()
    } catch (err: any) {
      toast.error(err.message || '操作失败')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return

    try {
      await domainsService.delete(deleteConfirm.ID)
      toast.success('域名已删除')
      setDeleteConfirm(null)
      loadDomains()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold">域名管理</h2>
        <button onClick={handleCreate} className="btn btn-primary w-full sm:w-auto">
          添加域名
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : domains.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无域名</div>
        ) : (
          <>
            {/* 移动端卡片布局 */}
            <div className="sm:hidden space-y-4">
              {domains.map((domain) => (
                <div key={domain.ID} className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{domain.Name}</span>
                      {domain.IsDefault && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                          默认
                        </span>
                      )}
                    </div>
                  </div>
                  {domain.Description && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">描述</p>
                      <p className="text-sm text-gray-600">{domain.Description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">协议</p>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          domain.SSL
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {domain.SSL ? 'HTTPS' : 'HTTP'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">状态</p>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          domain.IsActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {domain.IsActive ? '启用' : '禁用'}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-gray-500 mb-1">创建时间</p>
                    <p className="text-gray-600">{formatDateTime(domain.CreatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                    {!domain.IsDefault && (
                      <button
                        onClick={() => handleSetDefault(domain.ID)}
                        className="text-xs px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded"
                      >
                        设为默认
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(domain)}
                      className="text-xs px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(domain)}
                      className="text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 桌面端表格布局 */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">域名</th>
                    <th className="text-left py-3 px-4">描述</th>
                    <th className="text-left py-3 px-4">协议</th>
                    <th className="text-left py-3 px-4">状态</th>
                    <th className="text-left py-3 px-4">默认</th>
                    <th className="text-left py-3 px-4">创建时间</th>
                    <th className="text-right py-3 px-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((domain) => (
                    <tr key={domain.ID} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{domain.Name}</span>
                          {domain.IsDefault && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              默认
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {domain.Description || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            domain.SSL
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {domain.SSL ? 'HTTPS' : 'HTTP'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            domain.IsActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {domain.IsActive ? '启用' : '禁用'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {domain.IsDefault ? (
                          <span className="text-green-600">是</span>
                        ) : (
                          <button
                            onClick={() => handleSetDefault(domain.ID)}
                            className="text-purple-600 hover:text-purple-800 text-sm"
                          >
                            设为默认
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {formatDateTime(domain.CreatedAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(domain)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(domain)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 创建/编辑弹窗 */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingDomain ? '编辑域名' : '添加域名'}
        size="medium"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowModal(false)}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!formData.name.trim() || !!nameError}
              className="btn btn-primary disabled:bg-gray-300"
            >
              {editingDomain ? '保存' : '添加'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              域名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className={`input w-full text-sm ${nameError ? 'border-red-500 focus:border-red-500' : ''}`}
              placeholder="例如：example.com 或 example.com:8080"
            />
            {nameError ? (
              <p className="mt-1 text-sm text-red-500">{nameError}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-500">
                支持域名、域名:端口、IP、IP:端口、localhost
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              描述
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="input w-full text-sm"
              placeholder="域名用途说明"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-4 gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.ssl}
                onChange={(e) => setFormData({ ...formData, ssl: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">启用 HTTPS</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">启用状态</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="删除域名"
        message={`确定要删除域名 "${deleteConfirm?.Name}" 吗？删除后该域名将无法用于创建短链接。`}
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
