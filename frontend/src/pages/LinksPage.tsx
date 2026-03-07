import { useEffect, useState } from 'react'
import { linksService } from '@/services/links'
import { domainsService } from '@/services/domains'
import { configService, type SiteConfig } from '@/services/config'
import type { ShortLink, Domain, RedirectTemplate } from '@/types'
import Pagination from '@/components/Pagination'
import CopyButton from '@/components/CopyButton'
import ConfirmDialog from '@/components/ConfirmDialog'
import Modal from '@/components/Modal'
import { toast } from '@/components/Toast'
import { formatDateTime, truncate } from '@/utils/format'
import { HelpModal } from '@/components/HelpTooltip'
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Card,
  CardContent,
  Link,
  Tooltip,
  CircularProgress,
  Alert,
  ChipProps,
} from '@mui/material'
import {
  Add,
  Help,
  Edit,
  Delete,
  ContentCopy,
} from '@mui/icons-material'

const getStatusProps = (status: string): ChipProps['color'] => {
  const props: Record<string, ChipProps['color']> = {
    active: 'success',
    disabled: 'error',
    expired: 'default',
  }
  return props[status] || 'default'
}

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    active: '正常',
    disabled: '禁用',
    expired: '过期',
  }
  return labels[status] || '未知'
}

export default function LinksPage() {
  const [links, setLinks] = useState<ShortLink[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [templates, setTemplates] = useState<RedirectTemplate[]>([])
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)

  // 创建表单
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [url, setUrl] = useState('')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<number>(1)
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 编辑弹窗
  const [editLink, setEditLink] = useState<ShortLink | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    url: '',
    status: 'active',
    template_id: null as number | null
  })

  // 统计弹窗
  const [statsLink, setStatsLink] = useState<ShortLink | null>(null)
  const [stats, setStats] = useState<{ click_count: number; unique_ips: number } | null>(null)

  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<ShortLink | null>(null)

  // 帮助文档弹窗
  const [showHelpModal, setShowHelpModal] = useState(false)

  useEffect(() => {
    domainsService.listUser().then((data) => {
      setDomains(data || [])
      if (data && data.length > 0) {
        setSelectedDomain(data.find((d) => d.IsDefault)?.ID || data[0].ID)
      }
    }).catch(console.error)

    configService.get().then((config) => {
      setSiteConfig(config as SiteConfig)
    }).catch(console.error)

    configService.getTemplates().then((data) => {
      setTemplates(data || [])
      // 默认选中默认模板
      if (data && data.length > 0) {
        const defaultTemplate = data.find((t) => t.IsDefault)
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate.ID)
        }
      }
    }).catch(console.error)
  }, [])

  const loadLinks = () => {
    setLoading(true)
    linksService
      .list({ page, page_size: pageSize })
      .then((res) => {
        setLinks(res.data || [])
        setTotal(res.total || 0)
      })
      .catch((err) => {
        console.error(err)
        toast.error('加载链接列表失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadLinks()
  }, [page])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await linksService.create({
        url,
        code: code || undefined,
        title: title || undefined,
        domain_id: selectedDomain,
        template_id: selectedTemplate ?? null,
      })
      toast.success('短链接创建成功')
      setUrl('')
      setCode('')
      setTitle('')
      setSelectedTemplate(null)
      setShowCreateModal(false)
      loadLinks()
    } catch (err: any) {
      toast.error(err.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const openEditModal = async (link: ShortLink) => {
    setEditLink(link)
    setEditForm({
      title: link.Title || '',
      url: link.URL,
      status: link.Status,
      template_id: link.TemplateID || null
    })
  }

  const handleSaveEdit = async () => {
    if (!editLink) return

    try {
      await linksService.update(editLink.Code, {
        Title: editForm.title,
        URL: editForm.url,
        Status: editForm.status as any,
        TemplateID: editForm.template_id ?? null,
      })
      toast.success('链接更新成功')
      setEditLink(null)
      loadLinks()
    } catch (err: any) {
      toast.error(err.message || '更新失败')
    }
  }

  const viewStats = async (link: ShortLink) => {
    setStatsLink(link)
    try {
      const data = await linksService.stats(link.Code)
      setStats(data || null)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return

    try {
      await linksService.delete(deleteConfirm.Code)
      toast.success('链接已删除')
      setDeleteConfirm(null)
      loadLinks()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    }
  }

  const getFullUrl = (link: ShortLink) => {
    const domain = domains.find((d) => d.ID === link.DomainID) || domains[0]
    if (domain) {
      const protocol = domain.SSL ? 'https' : 'http'
      return `${protocol}://${domain.Name}/r/${link.Code}`
    }
    return `/r/${link.Code}`
  }

  const renderMobileCard = (link: ShortLink) => {
    const fullUrl = getFullUrl(link)
    return (
      <Card key={link.ID} sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Link
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                color="primary"
                fontWeight={500}
                sx={{ flex: 1, minWidth: 0 }}
              >
                {fullUrl}
              </Link>
              <Stack direction="row" spacing={0.5}>
                <CopyButton text={fullUrl}>
                  <IconButton size="small"><ContentCopy fontSize="small" /></IconButton>
                </CopyButton>
                <IconButton size="small" color="success" onClick={() => openEditModal(link)}>
                  <Edit fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => setDeleteConfirm(link)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>

            <Box>
              <Typography variant="caption" color="text.secondary">
                目标URL
              </Typography>
              <Typography variant="body2" color="text.primary" noWrap title={link.URL}>
                {truncate(link.URL, 60)}
              </Typography>
            </Box>

            {link.Title && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  标题
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {link.Title}
                </Typography>
              </Box>
            )}

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={getStatusLabel(link.Status)} color={getStatusProps(link.Status)} size="small" />
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(link.CreatedAt)}
              </Typography>
            </Stack>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  点击数
                </Typography>
                <Typography
                  variant="body1"
                  color="primary"
                  fontWeight={500}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => viewStats(link)}
                >
                  {link.ClickCount}
                </Typography>
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  const renderTableRow = (link: ShortLink) => {
    const fullUrl = getFullUrl(link)
    return (
      <TableRow key={link.ID} hover>
        <TableCell>
          <Link
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            color="primary"
            fontWeight={500}
          >
            {fullUrl}
          </Link>
        </TableCell>
        <TableCell>
          <Tooltip title={link.URL}>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
              {truncate(link.URL, 50)}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.primary">
            {link.Title || '-'}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip label={getStatusLabel(link.Status)} color={getStatusProps(link.Status)} size="small" />
        </TableCell>
        <TableCell>
          <Button
            size="small"
            onClick={() => viewStats(link)}
            sx={{ minWidth: 40, p: 0.5 }}
          >
            {link.ClickCount}
          </Button>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(link.CreatedAt)}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <CopyButton text={fullUrl}>
              <IconButton size="small"><ContentCopy fontSize="small" /></IconButton>
            </CopyButton>
            <IconButton size="small" color="success" onClick={() => openEditModal(link)}>
              <Edit fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => setDeleteConfirm(link)}>
              <Delete fontSize="small" />
            </IconButton>
          </Stack>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <Stack spacing={3}>
      {/* 页面标题 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h4" fontWeight={700}>
            我的链接
          </Typography>
          <IconButton onClick={() => setShowHelpModal(true)} size="small">
            <Help color="action" />
          </IconButton>
        </Stack>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setShowCreateModal(true)}
        >
          创建短链接
        </Button>
      </Stack>

      {/* 链接列表 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : links.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              暂无链接
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowCreateModal(true)}
            >
              创建第一个短链接
            </Button>
          </Box>
        ) : (
          <>
            {/* 移动端卡片布局 */}
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
              {links.map(renderMobileCard)}
            </Box>

            {/* 桌面端表格布局 */}
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>短链接</TableCell>
                      <TableCell>目标URL</TableCell>
                      <TableCell>标题</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell>点击</TableCell>
                      <TableCell>创建时间</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {links.map(renderTableRow)}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / pageSize)}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </Paper>

      {/* 创建弹窗 */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography>创建短链接</Typography>
            <Tooltip title="查看使用说明">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowHelpModal(true)
                }}
              >
                <Help fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
        footer={
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={() => setShowCreateModal(false)}>
              取消
            </Button>
            <Button
              form="create-form"
              type="submit"
              variant="contained"
              disabled={submitting || !url}
            >
              {submitting ? '创建中...' : '创建'}
            </Button>
          </Stack>
        }
      >
        <form id="create-form" onSubmit={handleCreate}>
          <Stack spacing={2.5}>
            <TextField
              label="目标URL"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/very/long/url"
              required
              fullWidth
              autoFocus
            />

            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                label="自定义短码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="留空自动生成"
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>选择域名</InputLabel>
                <Select
                  value={selectedDomain}
                  label="选择域名"
                  onChange={(e) => setSelectedDomain(Number(e.target.value))}
                >
                  {domains.map((domain) => (
                    <MenuItem key={domain.ID} value={domain.ID}>
                      {domain.Name} {domain.IsDefault ? '(默认)' : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TextField
              label="标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="链接标题"
              fullWidth
            />

            {siteConfig?.redirect_page_enabled === 'true' && siteConfig?.allow_user_template === 'true' && templates.length > 0 && (
              <FormControl fullWidth>
                <InputLabel>跳转模板</InputLabel>
                <Select
                  value={selectedTemplate || ''}
                  label="跳转模板"
                  onChange={(e) => setSelectedTemplate(Number(e.target.value))}
                >
                  {templates.map((template) => (
                    <MenuItem key={template.ID} value={template.ID}>
                      {template.Name} {template.IsDefault ? '(默认)' : ''}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  选择用户访问此链接时显示的跳转页面模板
                </Typography>
              </FormControl>
            )}
          </Stack>
        </form>
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        isOpen={!!editLink}
        onClose={() => setEditLink(null)}
        title="编辑短链接"
        footer={
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={() => setEditLink(null)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit} variant="contained">
              保存
            </Button>
          </Stack>
        }
      >
        <Stack spacing={2.5}>
          <TextField
            label="目标URL"
            type="url"
            value={editForm.url}
            onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
            fullWidth
          />
          <TextField
            label="标题"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>状态</InputLabel>
            <Select
              value={editForm.status}
              label="状态"
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            >
              <MenuItem value="active">正常</MenuItem>
              <MenuItem value="disabled">禁用</MenuItem>
            </Select>
          </FormControl>
          {siteConfig?.redirect_page_enabled === 'true' && siteConfig?.allow_user_template === 'true' && templates.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>跳转模板</InputLabel>
              <Select
                value={editForm.template_id || ''}
                label="跳转模板"
                onChange={(e) => setEditForm({ ...editForm, template_id: e.target.value ? Number(e.target.value) : null })}
              >
                {templates.map((template) => (
                  <MenuItem key={template.ID} value={template.ID}>
                    {template.Name} {template.IsDefault ? '(默认)' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      </Modal>

      {/* 统计弹窗 */}
      <Modal
        isOpen={!!statsLink}
        onClose={() => setStatsLink(null)}
        title="链接统计"
        footer={
          <Button onClick={() => setStatsLink(null)} variant="contained">
            关闭
          </Button>
        }
      >
        {statsLink && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              短链接: <strong>{getFullUrl(statsLink)}</strong>
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Paper variant="outlined" sx={{ p: 3, bgcolor: 'primary.50', flex: 1, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  总点击数
                </Typography>
                <Typography variant="h4" color="primary.main" fontWeight={700}>
                  {stats?.click_count || 0}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 3, bgcolor: 'success.50', flex: 1, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  独立IP
                </Typography>
                <Typography variant="h4" color="success.main" fontWeight={700}>
                  {stats?.unique_ips || 0}
                </Typography>
              </Paper>
            </Box>
          </Stack>
        )}
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="删除短链接"
        message={`确定要删除短链接 "${deleteConfirm?.Code}" 吗？此操作不可撤销。`}
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* 创建链接帮助文档 */}
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="创建短链接说明"
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              字段说明
            </Typography>
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  目标URL *
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  需要缩短的长链接，必须以 http:// 或 https:// 开头
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  自定义短码
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  可选。留空则系统自动生成随机短码。
                  自定义短码建议使用字母、数字组合，便于记忆。
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  选择域名
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  选择短链接使用的域名。不同域名可以用于不同业务场景。
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  标题
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  可选。为链接添加描述性标题，便于后续管理和识别。
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.50' }}>
                <Typography variant="body2" fontWeight={500} color="primary.main" gutterBottom>
                  跳转模板
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  选择用户访问短链接时显示的跳转页面模板。
                  仅在管理员启用了跳转页面并允许用户选择模板时可用。
                  不同模板可以有不同的视觉风格和提示信息。
                </Typography>
              </Paper>
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              使用提示
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              <Typography component="li" variant="caption" color="text.secondary">
                相同的目标URL会自动复用已有的短链接
              </Typography>
              <Typography component="li" variant="caption" color="text.secondary">
                自定义短码不能与已有短码重复
              </Typography>
              <Typography component="li" variant="caption" color="text.secondary">
                短链接创建后可以随时编辑目标URL和标题
              </Typography>
              <Typography component="li" variant="caption" color="text.secondary">
                如果未选择模板，将使用系统默认跳转模板
              </Typography>
            </Box>
          </Box>

          {siteConfig?.redirect_page_enabled !== 'true' && (
            <Alert severity="warning">
              <Typography variant="body2" fontWeight={500}>
                模板功能未启用
              </Typography>
              <Typography variant="caption">
                当前跳转页面功能未启用，模板选择不可用。
                如需使用，请联系管理员在"站点配置"中启用"跳转页面设置"。
              </Typography>
            </Alert>
          )}
        </Stack>
      </HelpModal>
    </Stack>
  )
}
