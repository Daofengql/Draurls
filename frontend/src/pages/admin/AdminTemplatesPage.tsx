import { useEffect, useState } from 'react'
import { templatesService } from '@/services/admin'
import type { RedirectTemplate } from '@/types'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'
import {
  Box,
  Typography,
  Button,
  TextField,
  Stack,
  Paper,
  Chip,
  CircularProgress,
  FormControlLabel,
  Checkbox,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
  Star as StarIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material'

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<RedirectTemplate[]>([])
  const [loading, setLoading] = useState(true)

  // 创建/编辑
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<RedirectTemplate | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    is_default: false,
  })

  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<RedirectTemplate | null>(null)

  // 预览
  const [previewTemplate, setPreviewTemplate] = useState<RedirectTemplate | null>(null)

  const loadTemplates = () => {
    setLoading(true)
    templatesService
      .list()
      .then((data) => setTemplates(data || []))
      .catch((err) => {
        console.error(err)
        toast.error('加载跳转模板失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const handleCreate = () => {
    setEditingTemplate(null)
    setFormData({ name: '', description: '', content: '', is_default: false })
    setShowModal(true)
  }

  const handleEdit = (template: RedirectTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.Name,
      description: template.Description || '',
      content: template.Content,
      is_default: template.IsDefault,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      if (editingTemplate) {
        await templatesService.update(editingTemplate.ID, formData)
        toast.success('模板更新成功')
      } else {
        await templatesService.create(formData)
        toast.success('模板创建成功')
      }
      setShowModal(false)
      loadTemplates()
    } catch (err: any) {
      toast.error(err.message || '保存失败')
    }
  }

  const handleSetDefault = async (id: number) => {
    try {
      await templatesService.setDefault(id)
      toast.success('默认模板已设置')
      loadTemplates()
    } catch (err: any) {
      toast.error(err.message || '操作失败')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return

    try {
      await templatesService.delete(deleteConfirm.ID)
      toast.success('模板已删除')
      setDeleteConfirm(null)
      loadTemplates()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    }
  }

  return (
    <Stack spacing={3}>
      {/* 页面标题 */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          跳转模板
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          创建模板
        </Button>
      </Box>

      {/* 模板列表 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : templates.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <DescriptionIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary" gutterBottom>
              暂无跳转模板
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
            >
              创建第一个模板
            </Button>
          </Box>
        ) : (
          <Stack spacing={2}>
            {templates.map((template) => (
              <Paper
                key={template.ID}
                variant="outlined"
                sx={{
                  p: { xs: 2, sm: 3 },
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 2 },
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ sm: 'flex-start' }}
                  justifyContent="space-between"
                  gap={2}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1} mb={1}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {template.Name}
                      </Typography>
                      {template.IsDefault && (
                        <Chip label="默认" size="small" color="primary" />
                      )}
                    </Stack>
                    {template.Description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {template.Description}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.disabled">
                      创建于 {formatDateTime(template.CreatedAt)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    <Button
                      size="small"
                      startIcon={<PreviewIcon fontSize="small" />}
                      onClick={() => setPreviewTemplate(template)}
                    >
                      预览
                    </Button>
                    {!template.IsDefault && (
                      <Button
                        size="small"
                        color="primary"
                        startIcon={<StarIcon fontSize="small" />}
                        onClick={() => handleSetDefault(template.ID)}
                      >
                        设为默认
                      </Button>
                    )}
                    <Button
                      size="small"
                      color="success"
                      startIcon={<EditIcon fontSize="small" />}
                      onClick={() => handleEdit(template)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon fontSize="small" />}
                      onClick={() => setDeleteConfirm(template)}
                    >
                      删除
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      {/* 创建/编辑弹窗 */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTemplate ? '编辑模板' : '创建模板'}
        size="lg"
        footer={
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
            {!editingTemplate && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  />
                }
                label="设为默认模板"
              />
            )}
            <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
              <Button onClick={() => setShowModal(false)}>
                取消
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formData.name.trim() || !formData.content.trim()}
                variant="contained"
              >
                {editingTemplate ? '保存' : '创建'}
              </Button>
            </Stack>
          </Stack>
        }
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              模板名称 <span style={{ color: 'red' }}>*</span>
            </Typography>
            <TextField
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              size="small"
              placeholder="例如：简单跳转、品牌页面"
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
              placeholder="模板用途说明"
            />
          </Box>
          <Box>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              模板内容 <span style={{ color: 'red' }}>*</span>
            </Typography>
            <TextField
              multiline
              rows={12}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              fullWidth
              size="small"
              placeholder="输入HTML模板内容，可使用 {{.URL}} 变量表示目标链接"
              slotProps={{
                input: {
                  sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                }
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              可用变量: <Box component="code" sx={{ bgcolor: 'grey.200', px: 0.5, borderRadius: 0.5 }}>{'{{.URL}}'}</Box> - 目标链接
            </Typography>
          </Box>
        </Stack>
      </Modal>

      {/* 预览弹窗 */}
      <Modal
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        title="模板预览"
        size="lg"
        footer={
          <Stack direction="row" justifyContent="flex-end">
            <Button onClick={() => setPreviewTemplate(null)} variant="contained">
              关闭
            </Button>
          </Stack>
        }
      >
        {previewTemplate && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              预览模板: <strong>{previewTemplate.Name}</strong>
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 0,
                bgcolor: 'grey.50',
                overflow: 'hidden',
                borderRadius: 1,
              }}
            >
              <iframe
                srcDoc={previewTemplate.Content.replace(/\{\{\.URL\}\}/g, 'https://example.com/target')}
                style={{
                  width: '100%',
                  height: '320px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                }}
                title="模板预览"
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
              />
            </Paper>
            <Typography variant="caption" color="text.secondary">
              预览中 {"{{.URL}}"} 变量被替换为示例链接
            </Typography>
          </Stack>
        )}
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="删除模板"
        message={`确定要删除模板 "${deleteConfirm?.Name}" 吗？删除后使用该模板的跳转将使用默认模板。`}
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </Stack>
  )
}
