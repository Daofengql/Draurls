import { useEffect, useState } from 'react'
import { groupsService } from '@/services/admin'
import type { UserGroup } from '@/types'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [loading, setLoading] = useState(true)

  // 创建/编辑
  const [showModal, setShowModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    default_quota: 100,
  })

  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<UserGroup | null>(null)

  const loadGroups = () => {
    setLoading(true)
    groupsService
      .list()
      .then((data) => setGroups(data || []))
      .catch((err) => {
        console.error(err)
        toast.error('加载用户组失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadGroups()
  }, [])

  const handleCreate = () => {
    setEditingGroup(null)
    setFormData({ name: '', description: '', default_quota: 100 })
    setShowModal(true)
  }

  const handleEdit = (group: UserGroup) => {
    setEditingGroup(group)
    setFormData({
      name: group.Name,
      description: group.Description,
      default_quota: group.DefaultQuota,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      if (editingGroup) {
        await groupsService.update(editingGroup.ID, formData)
        toast.success('用户组更新成功')
      } else {
        await groupsService.create(formData)
        toast.success('用户组创建成功')
      }
      setShowModal(false)
      loadGroups()
    } catch (err: any) {
      toast.error(err.message || '保存失败')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return

    try {
      await groupsService.delete(deleteConfirm.ID)
      toast.success('用户组已删除')
      setDeleteConfirm(null)
      loadGroups()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">用户组管理</h2>
        <button onClick={handleCreate} className="btn btn-primary">
          创建用户组
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无用户组</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">ID</th>
                  <th className="text-left py-3 px-4">名称</th>
                  <th className="text-left py-3 px-4">描述</th>
                  <th className="text-left py-3 px-4">默认配额</th>
                  <th className="text-left py-3 px-4">创建时间</th>
                  <th className="text-right py-3 px-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.ID} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-500">{group.ID}</td>
                    <td className="py-3 px-4 font-medium">{group.Name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {group.Description || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {group.DefaultQuota === -1 ? '无限' : group.DefaultQuota}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {formatDateTime(group.CreatedAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(group)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(group)}
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
        )}
      </div>

      {/* 创建/编辑弹窗 */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingGroup ? '编辑用户组' : '创建用户组'}
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
              {editingGroup ? '保存' : '创建'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              placeholder="例如：VIP用户、免费用户"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="input w-full"
              rows={3}
              placeholder="用户组描述..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              默认配额
            </label>
            <input
              type="number"
              value={formData.default_quota}
              onChange={(e) =>
                setFormData({ ...formData, default_quota: Number(e.target.value) })
              }
              className="input w-full"
              min={-1}
            />
            <p className="mt-1 text-sm text-gray-500">设为 -1 表示无限配额</p>
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="删除用户组"
        message={`确定要删除用户组 "${deleteConfirm?.Name}" 吗？此操作不会影响已分组的用户，但会解除他们与该用户组的关联。`}
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
