import { useEffect, useState } from 'react'
import { domainsService } from '@/services/admin'
import type { Domain } from '@/types'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'
import { getDomainValidationError } from '@/utils/validator'
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
} from '@mui/icons-material'

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

  // 删除���认
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

  const renderMobileCard = (domain: Domain) => {
    return (
      <Card key={domain.ID} sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {domain.Name}
                </Typography>
                {domain.IsDefault && (
                  <Chip label="默认" size="small" color="primary" />
                )}
              </Stack>
            </Stack>

            {domain.Description && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  描述
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {domain.Description}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  协议
                </Typography>
                <Chip
                  label={domain.SSL ? 'HTTPS' : 'HTTP'}
                  size="small"
                  color={domain.SSL ? 'success' : 'default'}
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  状态
                </Typography>
                <Chip
                  label={domain.IsActive ? '启用' : '禁用'}
                  size="small"
                  color={domain.IsActive ? 'success' : 'error'}
                />
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                创建时间
              </Typography>
              <Typography variant="body2" color="text.primary">
                {formatDateTime(domain.CreatedAt)}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
              {!domain.IsDefault && (
                <Button
                  size="small"
                  onClick={() => handleSetDefault(domain.ID)}
                  color="secondary"
                >
                  设为默认
                </Button>
              )}
              <Button size="small" onClick={() => handleEdit(domain)} startIcon={<EditIcon fontSize="small" />}>
                编辑
              </Button>
              <Button
                size="small"
                color="error"
                onClick={() => setDeleteConfirm(domain)}
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

  const renderTableRow = (domain: Domain) => {
    return (
      <TableRow key={domain.ID} hover>
        <TableCell>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="body2" fontWeight={500}>
              {domain.Name}
            </Typography>
            {domain.IsDefault && (
              <Chip label="默认" size="small" color="primary" />
            )}
          </Stack>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {domain.Description || '-'}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            label={domain.SSL ? 'HTTPS' : 'HTTP'}
            size="small"
            color={domain.SSL ? 'success' : 'default'}
          />
        </TableCell>
        <TableCell>
          <Chip
            label={domain.IsActive ? '启用' : '禁用'}
            size="small"
            color={domain.IsActive ? 'success' : 'error'}
          />
        </TableCell>
        <TableCell>
          {domain.IsDefault ? (
            <Typography variant="body2" color="success.main">
              是
            </Typography>
          ) : (
            <Button
              size="small"
              onClick={() => handleSetDefault(domain.ID)}
              color="secondary"
            >
              设为默认
            </Button>
          )}
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(domain.CreatedAt)}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <IconButton size="small" color="primary" onClick={() => handleEdit(domain)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => setDeleteConfirm(domain)}>
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
          域名管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          添加域名
        </Button>
      </Box>

      {/* 域名列表 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : domains.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body1" color="text.secondary">
              暂无域名
            </Typography>
          </Box>
        ) : (
          <>
            {/* 移动端卡片布局 */}
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
              {domains.map(renderMobileCard)}
            </Box>

            {/* 桌面端表格布局 */}
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>域名</TableCell>
                      <TableCell>描述</TableCell>
                      <TableCell>协议</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell>默认</TableCell>
                      <TableCell>创建时间</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {domains.map(renderTableRow)}
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
        title={editingDomain ? '编辑域名' : '添加域名'}
        size="md"
        footer={
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={() => setShowModal(false)}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name.trim() || !!nameError}
              variant="contained"
            >
              {editingDomain ? '保存' : '添加'}
            </Button>
          </Stack>
        }
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              域名 <span style={{ color: 'red' }}>*</span>
            </Typography>
            <TextField
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              error={!!nameError}
              helperText={nameError || '支持域名、域名:端口、IP、IP:端口、localhost'}
              fullWidth
              size="small"
              placeholder="例如：example.com 或 example.com:8080"
            />
          </Box>

          <Box>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              描述
            </Typography>
            <TextField
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              size="small"
              placeholder="域名用途说明"
            />
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.ssl}
                  onChange={(e) => setFormData({ ...formData, ssl: e.target.checked })}
                />
              }
              label="启用 HTTPS"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="启用状态"
            />
          </Stack>
        </Stack>
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
    </Stack>
  )
}
