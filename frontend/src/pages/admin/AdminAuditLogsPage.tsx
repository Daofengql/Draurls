import { useEffect, useState } from 'react'
import { auditLogsService } from '@/services/admin'
import type { AuditLog } from '@/types'
import Pagination from '@/components/Pagination'
import { formatDateTime } from '@/utils/format'
import {
  Box,
  Typography,
  TextField,
  MenuItem,
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
  ChipProps,
  CircularProgress,
} from '@mui/material'

// 操作类型选项
const actionOptions = [
  { value: '', label: '全部操作' },
  { value: 'user.create', label: '创建用户' },
  { value: 'user.update', label: '更新用户' },
  { value: 'user.delete', label: '删除用户' },
  { value: 'user.disable', label: '禁用用户' },
  { value: 'user.enable', label: '启用用户' },
  { value: 'user.set_group', label: '设置用户组' },
  { value: 'user.update_quota', label: '更新用户配额' },
  { value: 'link.create', label: '创建短链' },
  { value: 'link.update', label: '更新短链' },
  { value: 'link.delete', label: '删除短链' },
  { value: 'apikey.create', label: '创建API密钥' },
  { value: 'apikey.delete', label: '删除API密钥' },
  { value: 'config.update', label: '更新配置' },
  { value: 'domain.create', label: '创建域名' },
  { value: 'domain.update', label: '更新域名' },
  { value: 'domain.delete', label: '删除域名' },
  { value: 'group.create', label: '创建用户组' },
  { value: 'group.update', label: '更新用户组' },
  { value: 'group.delete', label: '删除用户组' },
  { value: 'template.create', label: '创建模板' },
  { value: 'template.update', label: '更新模板' },
  { value: 'template.delete', label: '删除模板' },
]

// 操作类型显示标签映射
const actionLabels: Record<string, string> = {
  'user.create': '创建用户',
  'user.update': '更新用户',
  'user.delete': '删除用户',
  'user.disable': '禁用用户',
  'user.enable': '启用用户',
  'user.set_group': '设置用户组',
  'user.update_quota': '更新配额',
  'link.create': '创建短链',
  'link.update': '更新短链',
  'link.delete': '删除短链',
  'apikey.create': '创建密钥',
  'apikey.delete': '删除密钥',
  'config.update': '更新配置',
  'domain.create': '创建域名',
  'domain.update': '更新域名',
  'domain.delete': '删除域名',
  'group.create': '创建用户组',
  'group.update': '更新用户组',
  'group.delete': '删除用户组',
  'template.create': '创建模板',
  'template.update': '更新模板',
  'template.delete': '删除模板',
}

// 资源类型显示标签映射
const resourceLabels: Record<string, string> = {
  'user': '用户',
  'link': '短链',
  'apikey': 'API密钥',
  'config': '配置',
  'domain': '域名',
  'group': '用户组',
  'template': '跳转模板',
}

// 获取操作类型标签
const getActionLabel = (action: string) => {
  return actionLabels[action] || action
}

// 获取资源类型标签
const getResourceLabel = (resource: string) => {
  return resourceLabels[resource] || resource
}

// 获取操作类型样式
const getActionBadgeColor = (action: string): ChipProps['color'] => {
  // 创建操作 - 绿色
  if (action.endsWith('.create')) {
    return 'success'
  }
  // 更新操作 - 蓝色/默认
  if (action.endsWith('.update')) {
    return 'info'
  }
  // 删除操作 - 红色
  if (action.endsWith('.delete') || action.endsWith('.disable')) {
    return 'error'
  }
  // 启用操作 - 绿色
  if (action.endsWith('.enable')) {
    return 'success'
  }
  // 默认 - 默认灰色
  return 'default'
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)

  // 筛选条件
  const [filterAction, setFilterAction] = useState('')
  const [filterActorId, setFilterActorId] = useState('')

  const loadLogs = () => {
    setLoading(true)
    const params: { page: number; page_size: number; actor_id?: number; action?: string } = {
      page,
      page_size: pageSize,
    }

    if (filterAction) {
      params.action = filterAction
    }
    if (filterActorId) {
      params.actor_id = Number(filterActorId)
    }

    auditLogsService
      .list(params)
      .then((res) => {
        setLogs(res.logs || [])
        setTotal(res.total || 0)
      })
      .catch((err) => {
        console.error(err)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadLogs()
  }, [page, filterAction, filterActorId])

  const handleActionChange = (value: string) => {
    setFilterAction(value)
    setPage(1)
  }

  const handleActorIdChange = (value: string) => {
    setFilterActorId(value)
    setPage(1)
  }

  const renderMobileCard = (log: AuditLog) => {
    return (
      <Card key={log.ID} sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Chip label={getActionLabel(log.Action)} color={getActionBadgeColor(log.Action)} size="small" />
              <Typography variant="caption" color="text.secondary">
                #{log.ID}
              </Typography>
            </Stack>

            <Box>
              <Typography variant="caption" color="text.secondary">
                资源
              </Typography>
              <Typography variant="body2" color="text.primary">
                {getResourceLabel(log.Resource)}
                {log.ResourceID && ` #${log.ResourceID}`}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                操作者
              </Typography>
              <Typography variant="body2" color="text.primary">
                用户 ID: {log.ActorID}
              </Typography>
            </Box>

            {log.Details && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  详情
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    mt: 0.5,
                    bgcolor: 'background.paper',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                  }}
                >
                  {log.Details}
                </Paper>
              </Box>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  IP地址
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {log.IPAddress || '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  时间
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {formatDateTime(log.CreatedAt)}
                </Typography>
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  const renderTableRow = (log: AuditLog) => {
    return (
      <TableRow key={log.ID} hover>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            #{log.ID}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip label={getActionLabel(log.Action)} color={getActionBadgeColor(log.Action)} size="small" />
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.primary">
            {getResourceLabel(log.Resource)}
            {log.ResourceID && (
              <Typography component="span" color="text.secondary">
                {' '}#{log.ResourceID}
              </Typography>
            )}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            用户 {log.ActorID}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
            }}
          >
            {log.Details || '-'}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {log.IPAddress || '-'}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(log.CreatedAt)}
          </Typography>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <Stack spacing={3}>
      {/* 页面标题 */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          审计日志
        </Typography>
      </Box>

      {/* 筛选器 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField
            select
            label="操作类型"
            value={filterAction}
            onChange={(e) => handleActionChange(e.target.value)}
            fullWidth
            size="small"
          >
            {actionOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="number"
            label="操作者 ID"
            value={filterActorId}
            onChange={(e) => handleActorIdChange(e.target.value)}
            placeholder="输入用户ID"
            fullWidth
            size="small"
            inputProps={{ min: 1 }}
          />
        </Stack>
      </Paper>

      {/* 日志列表 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : logs.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body1" color="text.secondary">
              暂无审计日志
            </Typography>
          </Box>
        ) : (
          <>
            {/* 移动端卡片布局 */}
            <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
              {logs.map(renderMobileCard)}
            </Box>

            {/* 桌面端表格布局 */}
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>操作</TableCell>
                      <TableCell>资源</TableCell>
                      <TableCell>操作者</TableCell>
                      <TableCell>详情</TableCell>
                      <TableCell>IP地址</TableCell>
                      <TableCell>时间</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logs.map(renderTableRow)}
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
    </Stack>
  )
}
