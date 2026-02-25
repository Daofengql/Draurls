import { useEffect, useState } from 'react'
import { usersService, groupsService } from '@/services/admin'
import type { User, UserGroup } from '@/types'
import Pagination from '@/components/Pagination'
import ConfirmDialog from '@/components/ConfirmDialog'
import Modal from '@/components/Modal'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)

  // 配额编辑
  const [quotaUser, setQuotaUser] = useState<User | null>(null)
  const [quotaValue, setQuotaValue] = useState<number>(-1)

  // 用户组设置
  const [groupUser, setGroupUser] = useState<User | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [inheritQuota, setInheritQuota] = useState(false)

  // 用户组列表
  const [groups, setGroups] = useState<UserGroup[]>([])

  // 删除确认
  const [actionConfirm, setActionConfirm] = useState<{
    type: 'disable' | 'enable'
    user: User
  } | null>(null)

  const loadUsers = () => {
    setLoading(true)
    usersService
      .list({ page, page_size: pageSize })
      .then((res) => {
        setUsers(res.data || [])
        setTotal(res.total || 0)
      })
      .catch((err) => {
        console.error(err)
        toast.error('加载用户列表失败')
      })
      .finally(() => setLoading(false))
  }

  const loadGroups = () => {
    groupsService
      .list()
      .then((data) => {
        setGroups(data)
      })
      .catch((err) => {
        console.error(err)
        toast.error('加载用户组列表失败')
      })
  }

  useEffect(() => {
    loadUsers()
    loadGroups()
  }, [page])

  const handleQuotaSave = async () => {
    if (!quotaUser) return

    try {
      await usersService.updateQuota(quotaUser.ID, quotaValue)
      toast.success('配额更新成功')
      setQuotaUser(null)
      loadUsers()
    } catch (err: any) {
      toast.error(err.message || '更新失败')
    }
  }

  const handleGroupSave = async () => {
    if (!groupUser) return

    try {
      await usersService.setGroup(groupUser.ID, selectedGroupId, inheritQuota)
      toast.success('用户组设置成功')
      setGroupUser(null)
      loadUsers()
    } catch (err: any) {
      toast.error(err.message || '设置失败')
    }
  }

  const handleAction = async () => {
    if (!actionConfirm) return

    try {
      if (actionConfirm.type === 'disable') {
        await usersService.disable(actionConfirm.user.ID)
        toast.success('用户已禁用')
      } else {
        await usersService.enable(actionConfirm.user.ID)
        toast.success('用户已启用')
      }
      setActionConfirm(null)
      loadUsers()
    } catch (err: any) {
      toast.error(err.message || '操作失败')
    }
  }

  const openQuotaModal = (user: User) => {
    setQuotaUser(user)
    setQuotaValue(user.Quota)
  }

  const openGroupModal = (user: User) => {
    setGroupUser(user)
    setSelectedGroupId(user.GroupID || null)
    setInheritQuota(user.Quota === -2)
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      disabled: 'bg-red-100 text-red-800',
      deleted: 'bg-gray-100 text-gray-800',
    }
    const labels = {
      active: '正常',
      disabled: '禁用',
      deleted: '已删除',
    }
    return (
      <span className={`px-2 py-1 rounded text-xs ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">用户管理</h2>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">ID</th>
                    <th className="text-left py-3 px-4">用户名</th>
                    <th className="text-left py-3 px-4">邮箱</th>
                    <th className="text-left py-3 px-4">角色</th>
                    <th className="text-left py-3 px-4">配额</th>
                    <th className="text-left py-3 px-4">状态</th>
                    <th className="text-left py-3 px-4">创建时间</th>
                    <th className="text-right py-3 px-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.ID} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-500">{user.ID}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {user.Picture && (
                            <img
                              src={user.Picture}
                              alt=""
                              className="w-6 h-6 rounded-full"
                            />
                          )}
                          <span className="font-medium">{user.Username}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">{user.Email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            user.Role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.Role === 'admin' ? '管理员' : '用户'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {user.Quota === -1 ? '无限' : `${user.QuotaUsed}/${user.Quota}`}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(user.Status)}</td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {formatDateTime(user.CreatedAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openQuotaModal(user)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            配额
                          </button>
                          <button
                            onClick={() => openGroupModal(user)}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            分组
                          </button>
                          {user.Status === 'active' ? (
                            <button
                              onClick={() =>
                                setActionConfirm({ type: 'disable', user })
                              }
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              禁用
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                setActionConfirm({ type: 'enable', user })
                              }
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              启用
                            </button>
                          )}
                        </div>
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

      {/* 配额编辑弹窗 */}
      <Modal
        isOpen={!!quotaUser}
        onClose={() => setQuotaUser(null)}
        title="设置配额"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setQuotaUser(null)}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button onClick={handleQuotaSave} className="btn btn-primary">
              保存
            </button>
          </div>
        }
      >
        <div>
          <p className="mb-4 text-gray-600">
            为用户 <strong>{quotaUser?.Username}</strong> 设置配额限制
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            配额数量
          </label>
          <input
            type="number"
            value={quotaValue}
            onChange={(e) => setQuotaValue(Number(e.target.value))}
            className="input w-full"
            min={-1}
          />
          <p className="mt-2 text-sm text-gray-500">
            设为 -1 表示无限配额
          </p>
        </div>
      </Modal>

      {/* 用户组设置弹窗 */}
      <Modal
        isOpen={!!groupUser}
        onClose={() => setGroupUser(null)}
        title="设置用户组"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setGroupUser(null)}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button onClick={handleGroupSave} className="btn btn-primary">
              保存
            </button>
          </div>
        }
      >
        <div>
          <p className="mb-4 text-gray-600">
            为用户 <strong>{groupUser?.Username}</strong> 设置用户组
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            用户组
          </label>
          <select
            value={selectedGroupId || ''}
            onChange={(e) =>
              setSelectedGroupId(e.target.value ? Number(e.target.value) : null)
            }
            className="input w-full"
          >
            <option value="">无用户组</option>
            {groups.map((g) => (
              <option key={g.ID} value={g.ID}>
                {g.Name}
              </option>
            ))}
          </select>
          <div className="mt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={inheritQuota}
                onChange={(e) => setInheritQuota(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">继承用户组配额</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* 操作确认 */}
      <ConfirmDialog
        isOpen={!!actionConfirm}
        title={
          actionConfirm?.type === 'disable'
            ? '禁用用户'
            : '启用用户'
        }
        message={`确定要${actionConfirm?.type === 'disable' ? '禁用' : '启用'}用户 "${actionConfirm?.user.Username}" 吗？`}
        type={actionConfirm?.type === 'disable' ? 'warning' : 'info'}
        onConfirm={handleAction}
        onCancel={() => setActionConfirm(null)}
      />
    </div>
  )
}
