import { useEffect, useState } from 'react'
import { usersService, groupsService } from '@/services/admin'
import { useAuthStore } from '@/store/auth'
import type { User, UserGroup } from '@/types'
import Pagination from '@/components/Pagination'
import ConfirmDialog from '@/components/ConfirmDialog'
import Modal from '@/components/Modal'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'

export default function AdminUsersPage() {
  const { user: currentUser } = useAuthStore()
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
    type: 'disable' | 'enable' | 'delete'
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
      } else if (actionConfirm.type === 'enable') {
        await usersService.enable(actionConfirm.user.ID)
        toast.success('用户已启用')
      } else if (actionConfirm.type === 'delete') {
        await usersService.delete(actionConfirm.user.ID)
        toast.success('用户已删除')
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
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold">用户管理</h2>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : (
          <>
            {/* 移动端卡片布局 */}
            <div className="sm:hidden space-y-4">
              {users.map((user) => (
                <div key={user.ID} className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {user.Picture && (
                        <img
                          src={user.Picture}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{user.Username}</p>
                        <p className="text-xs text-gray-500">ID: {user.ID}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(user.Status)}
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          user.Role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.Role === 'admin' ? '管理员' : '用户'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">邮箱</p>
                    <p className="text-sm text-gray-700">{user.Email}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">配额</p>
                      <p className="text-sm text-gray-700">
                        {user.Quota === -1 ? '无限' : `${user.QuotaUsed}/${user.Quota}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">用户组</p>
                      {user.Role === 'admin' ? (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                          管理员组
                        </span>
                      ) : user.GroupID ? (
                        <span className="text-sm text-gray-700">
                          组ID: {user.GroupID}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">无</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">创建时间</p>
                    <p className="text-sm text-gray-700">{formatDateTime(user.CreatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={() => openQuotaModal(user)}
                      className="text-xs px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      配额
                    </button>
                    {user.Role !== 'admin' && (
                      <button
                        onClick={() => openGroupModal(user)}
                        className="text-xs px-3 py-1.5 text-green-600 hover:bg-green-50 rounded"
                      >
                        分组
                      </button>
                    )}
                    {user.Status === 'active' ? (
                      !(user.Role === 'admin' && user.ID === currentUser?.ID) ? (
                        <button
                          onClick={() => setActionConfirm({ type: 'disable', user })}
                          className="text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 rounded"
                        >
                          禁用
                        </button>
                      ) : null
                    ) : (
                      <button
                        onClick={() => setActionConfirm({ type: 'enable', user })}
                        className="text-xs px-3 py-1.5 text-green-600 hover:bg-green-50 rounded"
                      >
                        启用
                      </button>
                    )}
                    {user.Role !== 'admin' && (
                      <button
                        onClick={() => setActionConfirm({ type: 'delete', user })}
                        className="text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        删除
                      </button>
                    )}
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
                    <th className="text-left py-3 px-4">用户名</th>
                    <th className="text-left py-3 px-4">邮箱</th>
                    <th className="text-left py-3 px-4">角色</th>
                    <th className="text-left py-3 px-4">用户组</th>
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
                        {user.Role === 'admin' ? (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">
                            虚拟组
                          </span>
                        ) : user.GroupID ? (
                          <span className="text-gray-600">组ID: {user.GroupID}</span>
                        ) : (
                          <span className="text-gray-400">无</span>
                        )}
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
                          {user.Role !== 'admin' && (
                            <button
                              onClick={() => openGroupModal(user)}
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              分组
                            </button>
                          )}
                          {user.Status === 'active' ? (
                            !(user.Role === 'admin' && user.ID === currentUser?.ID) ? (
                              <button
                                onClick={() =>
                                  setActionConfirm({ type: 'disable', user })
                                }
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                禁用
                              </button>
                            ) : null
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
                          {user.Role !== 'admin' && (
                            <button
                              onClick={() => setActionConfirm({ type: 'delete', user })}
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
        size="medium"
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
          <p className="mb-4 text-gray-600 text-sm">
            为用户 <strong>{quotaUser?.Username}</strong> 设置配额限制
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            配额数量
          </label>
          <input
            type="number"
            value={quotaValue}
            onChange={(e) => setQuotaValue(Number(e.target.value))}
            className="input w-full text-sm"
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
        size="medium"
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
          <p className="mb-4 text-gray-600 text-sm">
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
            className="input w-full text-sm"
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
          actionConfirm?.type === 'delete'
            ? '删除用户'
            : actionConfirm?.type === 'disable'
            ? '禁用用户'
            : '启用用户'
        }
        message={
          actionConfirm?.type === 'delete'
            ? `确定要删除用户 "${actionConfirm?.user.Username}" 吗？此操作将同时删除该用户的所有短链接、API密钥等数据，且不可恢复！`
            : `确定要${actionConfirm?.type === 'disable' ? '禁用' : '启用'}用户 "${actionConfirm?.user.Username}" 吗？`
        }
        type={actionConfirm?.type === 'delete' ? 'danger' : actionConfirm?.type === 'disable' ? 'warning' : 'info'}
        onConfirm={handleAction}
        onCancel={() => setActionConfirm(null)}
      />
    </div>
  )
}
