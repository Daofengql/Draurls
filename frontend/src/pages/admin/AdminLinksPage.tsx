import { useEffect, useState } from 'react'
import { adminLinksService, domainsService } from '@/services/admin'
import type { ShortLink, Domain } from '@/types'
import Pagination from '@/components/Pagination'
import CopyButton from '@/components/CopyButton'
import ConfirmDialog from '@/components/ConfirmDialog'
import Modal from '@/components/Modal'
import { toast } from '@/components/Toast'
import { truncate } from '@/utils/format'
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  CircularProgress,
  Link,
} from '@mui/material'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'

export default function AdminLinksPage() {
  const [links, setLinks] = useState<ShortLink[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)

  // 过滤器
  const [filterDomain, setFilterDomain] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterUserId, setFilterUserId] = useState<string>('')

  // 编辑弹窗
  const [editLink, setEditLink] = useState<ShortLink | null>(null)
  const [editForm, setEditForm] = useState({ title: '', url: '', status: 'active' })

  // 统计弹窗
  const [statsLink, setStatsLink] = useState<ShortLink | null>(null)
  const [stats, setStats] = useState<{ click_count: number; unique_ips: number } | null>(null)

  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<ShortLink | null>(null)

  // 加载域名列表
  useEffect(() => {
    domainsService.list().then((data) => {
      setDomains(data || [])
    }).catch(console.error)
  }, [])

  // 加载链接列表
  const loadLinks = () => {
    setLoading(true)
    const params: {
      page: number
      page_size: number
      domain_id?: number
      status?: string
      user_id?: number
    } = {
      page,
      page_size: pageSize,
    }
    if (filterDomain) params.domain_id = filterDomain
    if (filterStatus) params.status = filterStatus
    if (filterUserId) params.user_id = Number(filterUserId)

    adminLinksService
      .list(params)
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
  }, [page, filterDomain, filterStatus, filterUserId])

  // 打开编辑弹窗
  const openEditModal = async (link: ShortLink) => {
    setEditLink(link)
    setEditForm({
      title: link.Title || '',
      url: link.URL,
      status: link.Status,
    })
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editLink) return

    try {
      await adminLinksService.update(editLink.ID, {
        url: editForm.url,
        title: editForm.title,
        status: editForm.status,
      })
      toast.success('链接更新成功')
      setEditLink(null)
      loadLinks()
    } catch (err: any) {
      toast.error(err.message || '更新失败')
    }
  }

  // 查看统计
  const viewStats = async (link: ShortLink) => {
    setStatsLink(link)
    // TODO: 后端需要添加管理员获取统计的接口
    // 暂时跳过
    setStats({ click_count: link.ClickCount, unique_ips: 0 })
  }

  // 删除链接
  const handleDelete = async () => {
    if (!deleteConfirm) return

    try {
      await adminLinksService.delete(deleteConfirm.ID)
      toast.success('链接已删除')
      setDeleteConfirm(null)
      loadLinks()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    }
  }

  // 重置过滤器
  const resetFilters = () => {
    setFilterDomain(null)
    setFilterStatus('')
    setFilterUserId('')
  }

  // 获取链接的完整URL
  const getFullUrl = (link: ShortLink) => {
    const domain = domains.find((d) => d.ID === link.DomainID) || domains[0]
    if (domain) {
      const protocol = domain.SSL ? 'https' : 'http'
      return `${protocol}://${domain.Name}/r/${link.Code}`
    }
    return `/r/${link.Code}`
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, 'success' | 'error' | 'default'> = {
      active: 'success',
      disabled: 'error',
      expired: 'default',
    }
    const labels: Record<string, string> = {
      active: '正常',
      disabled: '禁用',
      expired: '过期',
    }
    return (
      <Chip label={labels[status] || '未知'} color={colors[status] || 'default'} size="small" />
    )
  }

  const renderMobileCard = (link: ShortLink) => {
    const fullUrl = getFullUrl(link)
    return (
      <Card key={link.ID} sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Link
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                color="primary"
                fontWeight={500}
                sx={{ flex: 1, minWidth: 0, fontSize: '0.875rem' }}
              >
                {fullUrl}
              </Link>
              {getStatusBadge(link.Status)}
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

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  创建者
                </Typography>
                <Typography variant="body2" color="text.primary">
                  ID: {link.UserID}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  点击数
                </Typography>
                <Button
                  size="small"
                  onClick={() => viewStats(link)}
                  sx={{ p: 0, minWidth: 'auto', fontWeight: 600 }}
                  color="primary"
                >
                  {link.ClickCount}
                </Button>
              </Box>
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <CopyButton text={fullUrl}>
                <Button size="small">复制</Button>
              </CopyButton>
              <Button size="small" color="success" onClick={() => openEditModal(link)}>
                编辑
              </Button>
              <Button size="small" color="error" onClick={() => setDeleteConfirm(link)}>
                删除
              </Button>
            </Stack>
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
            color="primary"
            fontWeight={500}
            underline="hover"
          >
            {fullUrl}
          </Link>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary" noWrap title={link.URL} sx={{ maxWidth: 200 }}>
            {truncate(link.URL, 50)}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.primary">
            {link.Title || '-'}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            ID: {link.UserID}
          </Typography>
        </TableCell>
        <TableCell>
          {getStatusBadge(link.Status)}
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
        <TableCell align="right">
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <CopyButton text={fullUrl}>
              <Button size="small">复制</Button>
            </CopyButton>
            <IconButton size="small" color="success" onClick={() => openEditModal(link)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => setDeleteConfirm(link)}>
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
      <Typography variant="h5" fontWeight={600}>
        短链接管理
      </Typography>

      {/* 过滤器 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap>
          <FormControl size="small" sx={{ minWidth: 120, flex: 1 }}>
            <InputLabel>域名</InputLabel>
            <Select
              value={filterDomain || ''}
              label="域名"
              onChange={(e) => setFilterDomain(e.target.value ? Number(e.target.value) : null)}
            >
              <MenuItem value="">全部域名</MenuItem>
              {domains.map((d) => (
                <MenuItem key={d.ID} value={d.ID}>
                  {d.Name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120, flex: 1 }}>
            <InputLabel>状态</InputLabel>
            <Select
              value={filterStatus}
              label="状态"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="">全部状态</MenuItem>
              <MenuItem value="active">正常</MenuItem>
              <MenuItem value="disabled">禁用</MenuItem>
              <MenuItem value="expired">过期</MenuItem>
            </Select>
          </FormControl>

          <TextField
            type="number"
            label="用户ID"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            placeholder="输入用户ID"
            size="small"
            sx={{ flex: 1 }}
          />

          <Button
            variant="outlined"
            onClick={resetFilters}
            startIcon={<RefreshIcon />}
            sx={{ height: 40 }}
          >
            重置
          </Button>
        </Stack>
      </Paper>

      {/* 链接列表 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : links.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body1" color="text.secondary">
              暂无链接
            </Typography>
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
                      <TableCell>创建者</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell>点击</TableCell>
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

      {/* 编辑弹窗 */}
      <Modal
        isOpen={!!editLink}
        onClose={() => setEditLink(null)}
        title="编辑短链接"
        size="md"
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
        <Stack spacing={3}>
          <Box>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              目标URL
            </Typography>
            <TextField
              type="url"
              value={editForm.url}
              onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
              fullWidth
              size="small"
            />
          </Box>
          <Box>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              标题
            </Typography>
            <TextField
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              fullWidth
              size="small"
            />
          </Box>
          <FormControl fullWidth size="small">
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
        </Stack>
      </Modal>

      {/* 统计弹窗 */}
      <Modal
        isOpen={!!statsLink}
        onClose={() => setStatsLink(null)}
        title="链接统计"
        footer={
          <Stack direction="row" justifyContent="flex-end">
            <Button onClick={() => setStatsLink(null)} variant="contained">
              关闭
            </Button>
          </Stack>
        }
      >
        {statsLink && (
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              短链接: <strong>{getFullUrl(statsLink)}</strong>
            </Typography>
            <Stack direction="row" spacing={2}>
              <Paper variant="outlined" sx={{ flex: 1, p: 3, bgcolor: 'primary.50', textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  总点击数
                </Typography>
                <Typography variant="h4" color="primary.main" fontWeight={700}>
                  {stats?.click_count || 0}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ flex: 1, p: 3, bgcolor: 'success.50', textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  独立IP
                </Typography>
                <Typography variant="h4" color="success.main" fontWeight={700}>
                  {stats?.unique_ips || 0}
                </Typography>
              </Paper>
            </Stack>
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
    </Stack>
  )
}
