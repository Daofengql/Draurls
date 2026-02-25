import { useEffect, useState } from 'react'
import { groupsService, domainsService } from '@/services/admin'
import type { UserGroup, Domain } from '@/types'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null)
  const [groupDetail, setGroupDetail] = useState<any>(null)

  // 创建/编辑
  const [showModal, setShowModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    default_quota: 100,
    is_default: false,
  })

  // 域名管理弹窗
  const [showDomainModal, setShowDomainModal] = useState(false)

  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<UserGroup | null>(null)

  const loadGroups = () => {
    setLoading(true)
    Promise.all([
      groupsService.list(),
      domainsService.list(),
    ])
      .then(([groupsData, domainsData]) => {
        setGroups(groupsData || [])
        setDomains(domainsData || [])
      })
      .catch((err) => {
        console.error(err)
        toast.error('加载数据失败')
      })
      .finally(() => setLoading(false))
  }

  const loadGroupDetail = (groupId: number) => {
    groupsService
      .get(groupId)
      .then((data) => {
        setGroupDetail(data)
      })
      .catch((err) => {
        console.error(err)
        toast.error('加载用户组详情失败')
      })
  }

  useEffect(() => {
    loadGroups()
  }, [])

  const handleCreate = () => {
    setEditingGroup(null)
    setFormData({ name: '', description: '', default_quota: 100, is_default: false })
    setShowModal(true)
  }

  const handleEdit = (group: UserGroup) => {
    setEditingGroup(group)
    setFormData({
      name: group.Name,
      description: group.Description,
      default_quota: group.DefaultQuota,
      is_default: group.IsDefault,
    })
    setShowModal(true)
  }

  const handleManageDomains = (group: UserGroup) => {
    setSelectedGroup(group)
    loadGroupDetail(group.ID)
    setShowDomainModal(true)
  }

  const handleSave = async () => {
    try {
      if (editingGroup) {
        await groupsService.update(editingGroup.ID, {
          name: formData.name,
          description: formData.description,
          default_quota: formData.default_quota,
          is_default: formData.is_default,
        })
        toast.success('用户组更新成功')
      } else {
        await groupsService.create({
          name: formData.name,
          description: formData.description,
          default_quota: formData.default_quota,
          is_default: formData.is_default,
        })
        toast.success('用户组创建成功')
      }
      setShowModal(false)
      loadGroups()
    } catch (err: any) {
      toast.error(err.message || '保存失败')
    }
  }

  const handleSetDefault = async (group: UserGroup) => {
    try {
      await groupsService.setDefault(group.ID)
      toast.success('已设置为默认用户组')
      loadGroups()
    } catch (err: any) {
      toast.error(err.message || '设置失败')
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

  const handleAddDomain = async (domainId: number) => {
    if (!selectedGroup) return
    try {
      await groupsService.addDomain(selectedGroup.ID, domainId)
      toast.success('域名已添加')
      loadGroupDetail(selectedGroup.ID)
    } catch (err: any) {
      toast.error(err.message || '添加失败')
    }
  }

  const handleRemoveDomain = async (domainId: number) => {
    if (!selectedGroup) return
    try {
      await groupsService.removeDomain(selectedGroup.ID, domainId)
      toast.success('域名已移除')
      loadGroupDetail(selectedGroup.ID)
    } catch (err: any) {
      toast.error(err.message || '移除失败')
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold">用户组管理</h2>
        <button onClick={handleCreate} className="btn btn-primary w-full sm:w-auto">
          创建用户组
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>暂无用户组</p>
          </div>
        ) : (
          <>
            {/* 移动端卡片布局 */}
            <div className="sm:hidden space-y-4">
              {groups.map((group) => (
                <div key={group.ID} className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{group.Name}</h3>
                      {group.IsDefault && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">
                          默认
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">ID: {group.ID}</span>
                  </div>
                  {group.Description && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">描述</p>
                      <p className="text-sm text-gray-600">{group.Description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">默认配额</p>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {group.DefaultQuota === -1 ? '无限' : group.DefaultQuota}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">创建时间</p>
                      <p className="text-gray-600">{formatDateTime(group.CreatedAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gray-200 flex-wrap">
                    <button
                      onClick={() => handleEdit(group)}
                      className="text-xs px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleManageDomains(group)}
                      className="text-xs px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded"
                    >
                      域名
                    </button>
                    {!group.IsDefault && (
                      <button
                        onClick={() => handleSetDefault(group)}
                        className="text-xs px-3 py-1.5 text-green-600 hover:bg-green-50 rounded"
                      >
                        设为默认
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(group)}
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
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{group.Name}</span>
                          {group.IsDefault && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">
                              默认
                            </span>
                          )}
                        </div>
                      </td>
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
                            onClick={() => handleManageDomains(group)}
                            className="text-purple-600 hover:text-purple-800 text-sm"
                          >
                            域名
                          </button>
                          {!group.IsDefault && (
                            <button
                              onClick={() => handleSetDefault(group)}
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              设为默认
                            </button>
                          )}
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
          </>
        )}
      </div>

      {/* 创建/编辑弹窗 */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingGroup ? '编辑用户组' : '创建用户组'}
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
              className="input w-full text-sm"
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
              className="input w-full text-sm"
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
              className="input w-full text-sm"
              min={-1}
            />
            <p className="mt-1 text-sm text-gray-500">设为 -1 表示无限配额</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_default"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="is_default" className="text-sm font-medium text-gray-700">
              设为默认用户组（新注册用户自动加入）
            </label>
          </div>
        </div>
      </Modal>

      {/* 域名管理弹窗 */}
      <Modal
        isOpen={showDomainModal}
        onClose={() => {
          setShowDomainModal(false)
          setSelectedGroup(null)
          setGroupDetail(null)
        }}
        title={`管理可用域名 - ${selectedGroup?.Name || ''}`}
        size="medium"
        footer={
          <div className="flex justify-end">
            <button
              onClick={() => {
                setShowDomainModal(false)
                setSelectedGroup(null)
                setGroupDetail(null)
              }}
              className="btn btn-secondary"
            >
              关闭
            </button>
          </div>
        }
      >
        {groupDetail && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              选择此用户组可以使用的域名。如果为空，则只能使用系统默认域名。
            </p>

            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {domains.map((domain) => {
                const isAllowed = groupDetail?.domains?.some((d: Domain) => d.ID === domain.ID)
                return (
                  <div
                    key={domain.ID}
                    className="flex items-center justify-between p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`domain-${domain.ID}`}
                        checked={isAllowed}
                        onChange={() => {
                          if (isAllowed) {
                            handleRemoveDomain(domain.ID)
                          } else {
                            handleAddDomain(domain.ID)
                          }
                        }}
                        className="rounded"
                      />
                      <label
                        htmlFor={`domain-${domain.ID}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium text-sm">{domain.Name}</div>
                        {domain.Description && (
                          <div className="text-xs text-gray-500">{domain.Description}</div>
                        )}
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      {domain.IsDefault && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                          默认
                        </span>
                      )}
                      {!domain.IsActive && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          已禁用
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {domains.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">
                暂无可用域名，请先在域名管理中添加域名
              </div>
            )}
          </div>
        )}
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
