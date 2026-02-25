import { useEffect, useState } from 'react'
import { domainsService } from '@/services/admin'
import type { Domain } from '@/types'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'

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
    setShowModal(true)
  }

  const handleSave = async () => {
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">域名管理</h2>
        <button onClick={handleCreate} className="btn btn-primary">
          添加域名
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : domains.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无域名</div>
        ) : (
          <div className="overflow-x-auto">
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
                      {!domain.IsDefault && (
                        <button
                          onClick={() => handleSetDefault(domain.ID)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
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
                        {!domain.IsDefault && (
                          <button
                            onClick={() => setDeleteConfirm(domain)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 创建/编辑弹窗 */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingDomain ? '编辑域名' : '添加域名'}
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
              disabled={!formData.name.trim()}
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
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              placeholder="例如：example.com"
            />
            <p className="mt-1 text-sm text-gray-500">不包含 http:// 或 https://</p>
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
              className="input w-full"
              placeholder="域名用途说明"
            />
          </div>
          <div className="flex gap-4">
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
