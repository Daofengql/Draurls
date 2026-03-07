import { useEffect, useState } from 'react'
import { groupsService, domainsService } from '@/services/admin'
import type { UserGroup, Domain } from '@/types'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
} from '@mui/icons-material'

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)

  // 创建/编辑
  const [showModal, setShowModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    default_quota: 100,
    is_default: false,
    selectedDomains: [] as number[], // 选中的域名ID列表
  })
  const [saving, setSaving] = useState(false)

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

  useEffect(() => {
    loadGroups()
  }, [])

  const handleCreate = () => {
    setEditingGroup(null)
    setFormData({
      name: '',
      description: '',
      default_quota: 100,
      is_default: false,
      selectedDomains: [],
    })
    setShowModal(true)
  }

  const handleEdit = async (group: UserGroup) => {
    setEditingGroup(group)
    // 获取用户组详情以加载域名列表
    try {
      const detail = await groupsService.get(group.ID)
      const domainIds = detail.domains?.map((d: Domain) => d.ID) || []
      setFormData({
        name: group.Name,
        description: group.Description,
        default_quota: group.DefaultQuota,
        is_default: group.IsDefault,
        selectedDomains: domainIds,
      })
    } catch (err) {
      console.error(err)
      setFormData({
        name: group.Name,
        description: group.Description,
        default_quota: group.DefaultQuota,
        is_default: group.IsDefault,
        selectedDomains: [],
      })
    }
    setShowModal(true)
  }

  const toggleDomain = (domainId: number) => {
    setFormData((prev) => {
      const isSelected = prev.selectedDomains.includes(domainId)
      return {
        ...prev,
        selectedDomains: isSelected
          ? prev.selectedDomains.filter((id) => id !== domainId)
          : [...prev.selectedDomains, domainId],
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingGroup) {
        // 更新用户组
        await groupsService.update(editingGroup.ID, {
          name: formData.name,
          description: formData.description,
          default_quota: formData.default_quota,
          is_default: formData.is_default,
        })
        // 获取当前用户组的域名
        const detail = await groupsService.get(editingGroup.ID)
        const currentDomainIds = detail.domains?.map((d: Domain) => d.ID) || []

        // 计算需要添加和删除的域名
        const toAdd = formData.selectedDomains.filter(
          (id: number) => !currentDomainIds.includes(id)
        )
        const toRemove = currentDomainIds.filter(
          (id: number) => !formData.selectedDomains.includes(id)
        )

        // 添加新域名
        for (const domainId of toAdd) {
          await groupsService.addDomain(editingGroup.ID, domainId)
        }
        // 删除移除的域名
        for (const domainId of toRemove) {
          await groupsService.removeDomain(editingGroup.ID, domainId)
        }

        toast.success('用户组更新成功')
      } else {
        // 创建用户组
        const newGroup = await groupsService.create({
          name: formData.name,
          description: formData.description,
          default_quota: formData.default_quota,
          is_default: formData.is_default,
        })
        // 添加域名关联
        for (const domainId of formData.selectedDomains) {
          await groupsService.addDomain(newGroup.ID, domainId)
        }
        toast.success('用户组创建成功')
      }
      setShowModal(false)
      loadGroups()
    } catch (err: any) {
      toast.error(err.message || '保存失败')
    } finally {
      setSaving(false)
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

  const renderMobileCard = (group: UserGroup) => {
    return (
      <Card key={group.ID} sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {group.Name}
                </Typography>
                {group.IsDefault && (
                  <Chip label="默认" size="small" color="success" />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                ID: {group.ID}
              </Typography>
            </Stack>

            {group.Description && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  描述
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {group.Description}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  默认配额
                </Typography>
                <Chip
                  label={group.DefaultQuota === -1 ? '无限' : group.DefaultQuota}
                  size="small"
                  color="primary"
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  创建时间
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {formatDateTime(group.CreatedAt)}
                </Typography>
              </Box>
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Button
                size="small"
                onClick={() => handleEdit(group)}
                startIcon={<EditIcon fontSize="small" />}
              >
                编辑
              </Button>
              {!group.IsDefault && (
                <Button
                  size="small"
                  onClick={() => handleSetDefault(group)}
                  color="success"
                  startIcon={<StarIcon fontSize="small" />}
                >
                  设为默认
                </Button>
              )}
              <Button
                size="small"
                color="error"
                onClick={() => setDeleteConfirm(group)}
                startIcon={<DeleteIcon fontSize="small" />}
              >
                删除
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  const renderTableRow = (group: UserGroup) => {
    return (
      <TableRow key={group.ID} hover>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {group.ID}
          </Typography>
        </TableCell>
        <TableCell>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="body2" fontWeight={500}>
              {group.Name}
            </Typography>
            {group.IsDefault && (
              <Chip label="默认" size="small" color="success" />
            )}
          </Stack>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {group.Description || '-'}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            label={group.DefaultQuota === -1 ? '无限' : group.DefaultQuota}
            size="small"
            color="primary"
          />
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(group.CreatedAt)}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <IconButton size="small" color="primary" onClick={() => handleEdit(group)}>
              <EditIcon fontSize="small" />
            </IconButton>
            {!group.IsDefault && (
              <IconButton size="small" color="success" onClick={() => handleSetDefault(group)}>
                <StarIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton size="small" color="error" onClick={() => setDeleteConfirm(group)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <Stack spacing={3}>
      {/* 页面标题 */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          用户组管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          创建用户组
        </Button>
      </Box>

      {/* 用户组列表 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : groups.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body1" color="text.secondary">
              暂无用户组
            </Typography>
          </Box>
        ) : (
          <>
            {/* 移动端卡片布局 */}
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
              {groups.map(renderMobileCard)}
            </Box>

            {/* 桌面端表格布局 */}
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>名称</TableCell>
                      <TableCell>描述</TableCell>
                      <TableCell>默认配额</TableCell>
                      <TableCell>创建时间</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {groups.map(renderTableRow)}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </>
        )}
      </Paper>

      {/* 创建/编辑弹窗 */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingGroup ? '编辑用户组' : '创建用户组'}
        size="md"
        footer={
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={() => setShowModal(false)} disabled={saving}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name.trim() || saving}
              variant="contained"
            >
              {saving ? '保存中...' : editingGroup ? '保存' : '创建'}
            </Button>
          </Stack>
        }
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              名称 <span style={{ color: 'red' }}>*</span>
            </Typography>
            <TextField
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              size="small"
              placeholder="例如：VIP用户、免费用户"
            />
          </Box>

          <Box>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              描述
            </Typography>
            <TextField
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              size="small"
              placeholder="用户组描述..."
            />
          </Box>

          <Box>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              默认配额
            </Typography>
            <TextField
              type="number"
              value={formData.default_quota}
              onChange={(e) => setFormData({ ...formData, default_quota: Number(e.target.value) })}
              fullWidth
              size="small"
              inputProps={{ min: -1 }}
              helperText="设为 -1 表示无限配额"
            />
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              />
            }
            label="设为默认用户组（新注册用户自动加入）"
          />

          {/* 域名选择 */}
          <Box>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              可用域名
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              选择此用户组可以使用的域名。如果不选择，则只能使用系统默认域名。
            </Typography>
            {domains.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                <Typography variant="body2" color="text.secondary">
                  暂无可用域名，请先在域名管理中添加域名
                </Typography>
              </Paper>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  maxHeight: 200,
                  overflow: 'auto',
                  divideColor: 'divider',
                }}
              >
                {domains.map((domain) => {
                  const isSelected = formData.selectedDomains.includes(domain.ID)
                  return (
                    <Box
                      key={domain.ID}
                      onClick={() => toggleDomain(domain.ID)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Stack direction="row" alignItems="center" gap={2}>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleDomain(domain.ID)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {domain.Name}
                          </Typography>
                          {domain.Description && (
                            <Typography variant="caption" color="text.secondary">
                              {domain.Description}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        {domain.IsDefault && (
                          <Chip label="默认" size="small" color="primary" />
                        )}
                        {!domain.IsActive && (
                          <Chip label="已禁用" size="small" color="default" />
                        )}
                      </Stack>
                    </Box>
                  )
                })}
              </Paper>
            )}
          </Box>
        </Stack>
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
    </Stack>
  )
}
