import { useEffect, useState } from 'react'
import { apiKeysService } from '@/services/apikeys'
import type { APIKey } from '@/types'
import { CopyInput } from '@/components/CopyButton'
import ConfirmDialog from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import Modal from '@/components/Modal'
import {
  Box,
  Typography,
  Button,
  TextField,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
} from '@mui/material'
import { Add, Description, Delete, Key, Warning } from '@mui/icons-material'

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDocModal, setShowDocModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null)

  const loadApiKeys = () => {
    setLoading(true)
    apiKeysService
      .list()
      .then((data) => {
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
      setNewKey(res.key)
      setNewKeyName('')
      setShowCreateModal(false)
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

  const getStatusProps = (status: string): { color: 'success' | 'default' | 'error'; label: string } => {
    const config: Record<string, { color: 'success' | 'default' | 'error'; label: string }> = {
      active: { color: 'success', label: '启用' },
      disabled: { color: 'default', label: '禁用' },
      expired: { color: 'error', label: '过期' },
    }
    return config[status] || { color: 'default', label: '未知' }
  }

  const renderMobileCard = (keyItem: APIKey) => {
    const status = getStatusProps(keyItem.Status)
    return (
      <Card key={keyItem.ID} sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight={600}>
                {keyItem.Name}
              </Typography>
              <Chip label={status.label} color={status.color} size="small" />
            </Stack>

            <Box>
              <Typography variant="caption" color="text.secondary">
                密钥
              </Typography>
              <Box sx={{ bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1, fontSize: '0.875rem', fontFamily: 'monospace' }}>
                {keyItem.Key ? `${keyItem.Key.slice(0, 8)}...` : 'N/A'}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  最后使用
                </Typography>
                <Typography variant="body2">
                  {keyItem.LastUsedAt
                    ? new Date(keyItem.LastUsedAt).toLocaleString('zh-CN')
                    : '-'}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  创建时间
                </Typography>
                <Typography variant="body2">
                  {new Date(keyItem.CreatedAt).toLocaleString('zh-CN')}
                </Typography>
              </Box>
            </Box>

            <Divider />

            <Button
              color="error"
              startIcon={<Delete />}
              onClick={() => setDeleteConfirm({ id: keyItem.ID, name: keyItem.Name })}
            >
              删除
            </Button>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  const renderTableRow = (keyItem: APIKey) => {
    const status = getStatusProps(keyItem.Status)
    return (
      <TableRow key={keyItem.ID} hover>
        <TableCell sx={{ fontWeight: 500 }}>{keyItem.Name}</TableCell>
        <TableCell>
          <Box sx={{ bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.875rem' }}>
            {keyItem.Key ? `${keyItem.Key.slice(0, 8)}...` : 'N/A'}
          </Box>
        </TableCell>
        <TableCell>
          <Chip label={status.label} color={status.color} size="small" />
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {keyItem.LastUsedAt
              ? new Date(keyItem.LastUsedAt).toLocaleString('zh-CN')
              : '-'}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {new Date(keyItem.CreatedAt).toLocaleString('zh-CN')}
          </Typography>
        </TableCell>
        <TableCell>
          <Button
            color="error"
            size="small"
            onClick={() => setDeleteConfirm({ id: keyItem.ID, name: keyItem.Name })}
          >
            删除
          </Button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <Stack spacing={3}>
      {/* 页面标题 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" fontWeight={700}>
          API密钥
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<Description />}
            onClick={() => setShowDocModal(true)}
          >
            接入文档
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowCreateModal(true)}
          >
            创建密钥
          </Button>
        </Stack>
      </Stack>

      {/* 密钥列表 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : apiKeys.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Key sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary" gutterBottom>
              暂无API密钥
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowCreateModal(true)}
              sx={{ mt: 2 }}
            >
              创建第一个API密钥
            </Button>
          </Box>
        ) : (
          <>
            {/* 移动端卡片布局 */}
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
              {apiKeys.map(renderMobileCard)}
            </Box>

            {/* 桌面端表格布局 */}
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>名称</TableCell>
                      <TableCell>密钥</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell>最后使用</TableCell>
                      <TableCell>创建时间</TableCell>
                      <TableCell>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {apiKeys.map(renderTableRow)}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </>
        )}
      </Paper>

      {/* 创建密钥弹窗 */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="创建API密钥"
        footer={
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={() => setShowCreateModal(false)}>
              取消
            </Button>
            <Button
              form="create-key-form"
              type="submit"
              variant="contained"
              disabled={creating || !newKeyName.trim()}
            >
              {creating ? '创建中...' : '创建'}
            </Button>
          </Stack>
        }
      >
        <form id="create-key-form" onSubmit={handleCreate}>
          <Stack spacing={2}>
            <TextField
              label="密钥名称"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="例如：生产环境、测试环境"
              required
              fullWidth
              autoFocus
            />
            <Alert severity="info" icon={<Warning />}>
              <Typography variant="body2">
                创建后将显示完整的密钥，请妥善保存。密钥只会显示一次。
              </Typography>
            </Alert>
          </Stack>
        </form>
      </Modal>

      {/* 新密钥展示 */}
      {newKey && (
        <Modal
          isOpen={!!newKey}
          onClose={() => {
            setNewKey(null)
            loadApiKeys()
          }}
          title="API密钥创建成功"
          footer={
            <Button
              onClick={() => {
                setNewKey(null)
                loadApiKeys()
              }}
              variant="contained"
            >
              我已保存
            </Button>
          }
        >
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              请立即复制并保存您的API密钥。出于安全考虑，它只会显示这一次。
            </Typography>
            <CopyInput value={newKey} />
            <Alert severity="warning">
              警告：请勿将API密钥泄露给他人，或提交到公开的代码仓库中。
            </Alert>
          </Stack>
        </Modal>
      )}

      {/* API接入文档 */}
      <ApiDocModal isOpen={showDocModal} onClose={() => setShowDocModal(false)} />

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="删除API密钥"
        message={`确定要删除API密钥 "${deleteConfirm?.name}" 吗？此操作不可撤销。`}
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </Stack>
  )
}

// API文档组件
function ApiDocModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="API接入文档"
      footer={
        <Button onClick={onClose} variant="contained">
          关闭
        </Button>
      }
    >
      <Box sx={{ maxHeight: '70vh', overflowY: 'auto', fontSize: '0.875rem' }}>
        <Stack spacing={3}>
          {/* 基本信息 */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.main', mr: 1 }}>
                1
              </Box>
              基本信息
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>API端点：</strong><Box component="code" sx={{ bgcolor: 'grey.200', px: 1, py: 0.5, borderRadius: 0.5, fontFamily: 'monospace' }}>POST /api/v1/shorten</Box></Typography>
                <Typography variant="body2"><strong>Content-Type：</strong><Box component="code" sx={{ bgcolor: 'grey.200', px: 1, py: 0.5, borderRadius: 0.5, fontFamily: 'monospace' }}>application/json</Box></Typography>
                <Typography variant="body2"><strong>签名算法：</strong>HMAC-SHA256</Typography>
              </Stack>
            </Paper>
          </Box>

          {/* 请求头 */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.main', mr: 1 }}>
                2
              </Box>
              请求头
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>参数名</TableCell>
                    <TableCell>类型</TableCell>
                    <TableCell>必填</TableCell>
                    <TableCell>说明</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell><Box component="code" sx={{ color: 'error.main', bgcolor: 'grey.200', px: 1, py: 0.5, borderRadius: 0.5, fontFamily: 'monospace' }}>X-API-Key</Box></TableCell>
                    <TableCell>string</TableCell>
                    <TableCell>是</TableCell>
                    <TableCell>你的API密钥（Key）</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Box component="code" sx={{ color: 'error.main', bgcolor: 'grey.200', px: 1, py: 0.5, borderRadius: 0.5, fontFamily: 'monospace' }}>X-Signature</Box></TableCell>
                    <TableCell>string</TableCell>
                    <TableCell>是</TableCell>
                    <TableCell>请求签名（HMAC-SHA256）</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Box component="code" sx={{ color: 'error.main', bgcolor: 'grey.200', px: 1, py: 0.5, borderRadius: 0.5, fontFamily: 'monospace' }}>X-Timestamp</Box></TableCell>
                    <TableCell>int64</TableCell>
                    <TableCell>是</TableCell>
                    <TableCell>当前Unix时间戳（秒），5分钟内有效</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Box component="code" sx={{ color: 'error.main', bgcolor: 'grey.200', px: 1, py: 0.5, borderRadius: 0.5, fontFamily: 'monospace' }}>X-Nonce</Box></TableCell>
                    <TableCell>string</TableCell>
                    <TableCell>是</TableCell>
                    <TableCell>随机字符串（防重放攻击）</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* 请求体 */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.main', mr: 1 }}>
                3
              </Box>
              请求体示例
            </Typography>
            <Box component="pre" sx={{ bgcolor: 'grey.900', color: 'success.light', p: 2, borderRadius: 1, overflowX: 'auto', fontSize: '0.75rem' }}>
              {'{\n  "url": "https://www.example.com",\n  "code": "custom123",\n  "title": "示例标题",\n  "expires_at": "2025-12-31T23:59:59Z"\n}'}
            </Box>
          </Box>

          {/* 代码示例和返回结果等更多内容... */}
          <Box>
            <Alert severity="info">
              完整的API文档请参考项目文档或联系管理员。
            </Alert>
          </Box>
        </Stack>
      </Box>
    </Modal>
  )
}
