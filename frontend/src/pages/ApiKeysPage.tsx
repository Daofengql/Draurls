import { useEffect, useState } from 'react'
import { apiKeysService } from '@/services/apikeys'
import type { APIKey } from '@/types'
import { CopyInput } from '@/components/CopyButton'
import ConfirmDialog from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import Modal from '@/components/Modal'

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null)

  const loadApiKeys = () => {
    setLoading(true)
    apiKeysService
      .list()
      .then((data) => {
        console.log('API Keys received:', data)
        setApiKeys(data || [])
      })
      .catch((err) => {
        console.error(err)
        toast.error('加载API密钥失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadApiKeys()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return

    setCreating(true)
    try {
      const res = await apiKeysService.create({ name: newKeyName })
      setNewKey((res as unknown as { Key: string }).Key)
      setNewKeyName('')
      setShowCreateModal(false)
      loadApiKeys()
      toast.success('API密钥创建成功')
    } catch (err: any) {
      toast.error(err.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return

    try {
      await apiKeysService.delete(deleteConfirm.id)
      toast.success('API密钥已删除')
      setDeleteConfirm(null)
      loadApiKeys()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      disabled: 'bg-gray-100 text-gray-800',
      expired: 'bg-red-100 text-red-800',
    }
    const labels: Record<string, string> = {
      active: '启用',
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
        <h1 className="text-2xl font-bold">API密钥</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          创建密钥
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-gray-500 text-center py-8">加载中...</p>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <p className="text-gray-500 mb-4">暂无API密钥</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              创建第一个API密钥
            </button>
          </div>
        ) : (
          <>
            {/* 移动端卡片布局 */}
            <div className="sm:hidden space-y-4">
              {apiKeys.map((keyItem) => (
                <div key={keyItem.ID} className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">{keyItem.Name}</h3>
                    {getStatusBadge(keyItem.Status)}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">密钥</p>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {keyItem.Key ? `${keyItem.Key.slice(0, 8)}...` : 'N/A'}
                    </code>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">最后使用</p>
                      <p className="text-gray-600">
                        {keyItem.LastUsedAt
                          ? new Date(keyItem.LastUsedAt).toLocaleString('zh-CN')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">创建时间</p>
                      <p className="text-gray-600">
                        {new Date(keyItem.CreatedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <button
                      onClick={() => setDeleteConfirm({ id: keyItem.ID, name: keyItem.Name })}
                      className="text-red-600 hover:text-red-800 text-sm"
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
                    <th className="text-left py-3 px-4">名称</th>
                    <th className="text-left py-3 px-4">密钥</th>
                    <th className="text-left py-3 px-4">状态</th>
                    <th className="text-left py-3 px-4">最后使用</th>
                    <th className="text-left py-3 px-4">创建时间</th>
                    <th className="text-right py-3 px-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((keyItem) => (
                    <tr key={keyItem.ID} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{keyItem.Name}</td>
                      <td className="py-3 px-4">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {keyItem.Key ? `${keyItem.Key.slice(0, 8)}...` : 'N/A'}
                        </code>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(keyItem.Status)}</td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {keyItem.LastUsedAt
                          ? new Date(keyItem.LastUsedAt).toLocaleString('zh-CN')
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(keyItem.CreatedAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setDeleteConfirm({ id: keyItem.ID, name: keyItem.Name })}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 创建密钥弹窗 */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="创建API密钥"
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
              form="create-key-form"
              type="submit"
              disabled={creating || !newKeyName.trim()}
              className="btn btn-primary disabled:bg-gray-300"
            >
              {creating ? '创建中...' : '创建'}
            </button>
          </div>
        }
      >
        <form id="create-key-form" onSubmit={handleCreate}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密钥名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="例如：生产环境、测试环境"
              className="input w-full text-sm"
              autoFocus
            />
            <p className="mt-2 text-sm text-gray-500">
              创建后将显示完整的密钥，请妥善保存。密钥只会显示一次。
            </p>
          </div>
        </form>
      </Modal>

      {/* 新密钥展示 */}
      {newKey && (
        <Modal
          isOpen={!!newKey}
          onClose={() => setNewKey(null)}
          title="API密钥创建成功"
          footer={
            <div className="flex justify-end">
              <button
                onClick={() => setNewKey(null)}
                className="btn btn-primary"
              >
                我已保存
              </button>
            </div>
          }
        >
          <div>
            <p className="mb-4 text-gray-600">
              请立即复制并保存您的API密钥。出于安全考虑，它只会显示这一次。
            </p>
            <CopyInput value={newKey} />
            <p className="mt-4 text-sm text-yellow-600 bg-yellow-50 p-3 rounded">
              ⚠️ 请勿将API密钥泄露给他人，或提交到公开的代码仓库中。
            </p>
          </div>
        </Modal>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="删除API密钥"
        message={`确定要删除API密钥 "${deleteConfirm?.name}" 吗？此操作不可撤销。`}
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
