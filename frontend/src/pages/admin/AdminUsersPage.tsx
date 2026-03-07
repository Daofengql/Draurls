import { useEffect, useState } from 'react'
import { usersService, groupsService } from '@/services/admin'
import { useAuthStore } from '@/store/auth'
import type { User, UserGroup } from '@/types'
import Pagination from '@/components/Pagination'
import ConfirmDialog from '@/components/ConfirmDialog'
import Modal from '@/components/Modal'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'
import {
  Box,
  Typography,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Avatar,
  useTheme,
  useMediaQuery,
  CircularProgress,
} from '@mui/material'
import {
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material'

const getStatusColor = (status: string): 'success' | 'error' | 'default' => {
  const colors: Record<string, 'success' | 'error' | 'default'> = {
    active: 'success',
    disabled: 'error',
    deleted: 'default',
  }
  return colors[status] || 'default'
}

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    active: '正常',
    disabled: '禁用',
    deleted: '已删除',
  }
  return labels[status] || '未知'
}

const getRoleColor = (role: string): 'default' | 'secondary' => {
  return role === 'admin' ? 'secondary' : 'default'
}

const getRoleLabel = (role: string): string => {
  return role === 'admin' ? '管理员' : '用户'
}

export default function AdminUsersPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
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

  return (
    <Box>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: { xs: 2, sm: 3 } }}
      >
        <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="semibold">
          用户管理
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={8}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* 移动端卡片布局 */}
              <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                <Stack spacing={2}>
                  {users.map((user) => (
                    <Card
                      key={user.ID}
                      variant="outlined"
                      sx={{ bgcolor: 'grey.50' }}
                    >
                      <CardContent>
                        <Stack spacing={2}>
                          {/* 用户信息头部 */}
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                          >
                            <Stack direction="row" alignItems="center" gap={1}>
                              {user.Picture && (
                                <Avatar src={user.Picture} sx={{ width: 32, height: 32 }} />
                              )}
                              <Box>
                                <Typography variant="subtitle2" fontWeight="medium">
                                  {user.Username}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ID: {user.ID}
                                </Typography>
                              </Box>
                            </Stack>
                            <Stack alignItems="flex-end" spacing={0.5}>
                              <Chip
                                label={getStatusLabel(user.Status)}
                                color={getStatusColor(user.Status)}
                                size="small"
                              />
                              <Chip
                                label={getRoleLabel(user.Role)}
                                color={getRoleColor(user.Role)}
                                size="small"
                                icon={user.Role === 'admin' ? <AdminIcon fontSize="small" /> : undefined}
                              />
                            </Stack>
                          </Stack>

                          {/* 邮箱 */}
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                              邮箱
                            </Typography>
                            <Typography variant="body2">{user.Email}</Typography>
                          </Box>

                          {/* 配额和用户组 */}
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                                配额
                              </Typography>
                              <Typography variant="body2">
                                {user.Quota === -1 ? '无限' : `${user.QuotaUsed}/${user.Quota}`}
                              </Typography>
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                                用户组
                              </Typography>
                              {user.Role === 'admin' ? (
                                <Chip label="管理员组" color="secondary" size="small" />
                              ) : user.GroupID ? (
                                <Typography variant="body2">组ID: {user.GroupID}</Typography>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  无
                                </Typography>
                              )}
                            </Box>
                          </Box>

                          {/* 创建时间 */}
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                              创建时间
                            </Typography>
                            <Typography variant="body2">{formatDateTime(user.CreatedAt)}</Typography>
                          </Box>

                          {/* 操作按钮 */}
                          <Stack
                            direction="row"
                            flexWrap="wrap"
                            gap={1}
                            sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}
                          >
                            <Button
                              size="small"
                              onClick={() => openQuotaModal(user)}
                              color="primary"
                            >
                              配额
                            </Button>
                            {user.Role !== 'admin' && (
                              <Button
                                size="small"
                                onClick={() => openGroupModal(user)}
                                color="success"
                              >
                                分组
                              </Button>
                            )}
                            {user.Status === 'active' ? (
                              !(user.Role === 'admin' && user.ID === currentUser?.ID) ? (
                                <Button
                                  size="small"
                                  onClick={() => setActionConfirm({ type: 'disable', user })}
                                  color="error"
                                >
                                  禁用
                                </Button>
                              ) : null
                            ) : (
                              <Button
                                size="small"
                                onClick={() => setActionConfirm({ type: 'enable', user })}
                                color="success"
                              >
                                启用
                              </Button>
                            )}
                            {user.Role !== 'admin' && (
                              <Button
                                size="small"
                                onClick={() => setActionConfirm({ type: 'delete', user })}
                                color="error"
                              >
                                删除
                              </Button>
                            )}
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>

              {/* 桌面端表格布局 */}
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>用户名</TableCell>
                        <TableCell>邮箱</TableCell>
                        <TableCell>角色</TableCell>
                        <TableCell>用户组</TableCell>
                        <TableCell>配额</TableCell>
                        <TableCell>状态</TableCell>
                        <TableCell>创建时间</TableCell>
                        <TableCell align="right">操作</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow
                          key={user.ID}
                          hover
                          sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                        >
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {user.ID}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" gap={1}>
                              {user.Picture && (
                                <Avatar src={user.Picture} sx={{ width: 24, height: 24 }} />
                              )}
                              <Typography variant="body2" fontWeight="medium">
                                {user.Username}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{user.Email}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getRoleLabel(user.Role)}
                              color={getRoleColor(user.Role)}
                              size="small"
                              icon={user.Role === 'admin' ? <AdminIcon fontSize="small" /> : undefined}
                            />
                          </TableCell>
                          <TableCell>
                            {user.Role === 'admin' ? (
                              <Chip label="虚拟组" color="secondary" size="small" />
                            ) : user.GroupID ? (
                              <Typography variant="body2" color="text.secondary">
                                组ID: {user.GroupID}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.disabled">
                                无
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {user.Quota === -1 ? '无限' : `${user.QuotaUsed}/${user.Quota}`}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getStatusLabel(user.Status)}
                              color={getStatusColor(user.Status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {formatDateTime(user.CreatedAt)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" gap={0.5} justifyContent="flex-end">
                              <Button
                                size="small"
                                onClick={() => openQuotaModal(user)}
                                color="primary"
                              >
                                配额
                              </Button>
                              {user.Role !== 'admin' && (
                                <Button
                                  size="small"
                                  onClick={() => openGroupModal(user)}
                                  color="success"
                                >
                                  分组
                                </Button>
                              )}
                              {user.Status === 'active' ? (
                                !(user.Role === 'admin' && user.ID === currentUser?.ID) ? (
                                  <Button
                                    size="small"
                                    onClick={() => setActionConfirm({ type: 'disable', user })}
                                    color="error"
                                  >
                                    禁用
                                  </Button>
                                ) : null
                              ) : (
                                <Button
                                  size="small"
                                  onClick={() => setActionConfirm({ type: 'enable', user })}
                                  color="success"
                                >
                                  启用
                                </Button>
                              )}
                              {user.Role !== 'admin' && (
                                <Button
                                  size="small"
                                  onClick={() => setActionConfirm({ type: 'delete', user })}
                                  color="error"
                                >
                                  删除
                                </Button>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              <Box sx={{ mt: 2 }}>
                <Pagination
                  currentPage={page}
                  totalPages={Math.ceil(total / pageSize)}
                  total={total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                />
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {/* 配额编辑弹窗 */}
      <Modal
        isOpen={!!quotaUser}
        onClose={() => setQuotaUser(null)}
        title="设置配额"
        size="md"
        footer={
          <Stack direction="row" gap={2} justifyContent="flex-end">
            <Button onClick={() => setQuotaUser(null)} variant="outlined">
              取消
            </Button>
            <Button onClick={handleQuotaSave} variant="contained">
              保存
            </Button>
          </Stack>
        }
      >
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            为用户 <strong>{quotaUser?.Username}</strong> 设置配额限制
          </Typography>
          <TextField
            type="number"
            label="配额数量"
            value={quotaValue}
            onChange={(e) => setQuotaValue(Number(e.target.value))}
            fullWidth
            inputProps={{ min: -1 }}
          />
          <Typography variant="caption" color="text.secondary">
            设为 -1 表示无限配额
          </Typography>
        </Stack>
      </Modal>

      {/* 用户组设置弹窗 */}
      <Modal
        isOpen={!!groupUser}
        onClose={() => setGroupUser(null)}
        title="设置用户组"
        size="md"
        footer={
          <Stack direction="row" gap={2} justifyContent="flex-end">
            <Button onClick={() => setGroupUser(null)} variant="outlined">
              取消
            </Button>
            <Button onClick={handleGroupSave} variant="contained">
              保存
            </Button>
          </Stack>
        }
      >
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            为用户 <strong>{groupUser?.Username}</strong> 设置用户组
          </Typography>
          <FormControl fullWidth>
            <InputLabel>用户组</InputLabel>
            <Select
              value={selectedGroupId ?? ''}
              onChange={(e) =>
                setSelectedGroupId(e.target.value ? Number(e.target.value) : null)
              }
              label="用户组"
            >
              <MenuItem value="">无用户组</MenuItem>
              {groups.map((g) => (
                <MenuItem key={g.ID} value={g.ID}>
                  {g.Name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={inheritQuota}
                  onChange={(e) => setInheritQuota(e.target.checked)}
                />
              }
              label="继承用户组配额"
            />
          </FormGroup>
        </Stack>
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
    </Box>
  )
}
