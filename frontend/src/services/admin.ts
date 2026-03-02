import api from './api'
import type {
  User,
  UserGroup,
  Domain,
  RedirectTemplate,
  AdminSummary,
  TrendDataResponse,
  PaginatedResponse,
  AuditLogsResponse,
} from '@/types'

// 后端用户列表分页响应格式
interface BackendUsersResponse {
  users: User[]
  total: number
  page: number
  page_size: number
  total_page: number
}

// 用户管理
export const usersService = {
  list: async (params: { page?: number; page_size?: number }): Promise<PaginatedResponse<User>> => {
    const res = await api.get<BackendUsersResponse>('/admin/users', { params })
    // 转换后端格式到前端期望的格式
    return {
      data: res.users,
      total: res.total,
      page: res.page,
      page_size: res.page_size,
    }
  },

  updateQuota: (userId: number, quota: number) =>
    api.put<void>('/admin/users/quota', { user_id: userId, quota }),

  setGroup: (userId: number, groupId: number | null, inheritQuota: boolean) =>
    api.put<void>('/admin/users/group', {
      user_id: userId,
      group_id: groupId,
      inherit_quota: inheritQuota,
    }),

  disable: (userId: number) =>
    api.post<void>(`/admin/users/${userId}/disable`),

  enable: (userId: number) =>
    api.post<void>(`/admin/users/${userId}/enable`),
}

// 用户组管理
export const groupsService = {
  list: () =>
    api.get<UserGroup[]>('/admin/groups'),

  get: (id: number) =>
    api.get<any>(`/admin/groups/${id}`),

  create: (data: { name: string; description: string; default_quota: number; is_default?: boolean }) =>
    api.post<UserGroup>('/admin/groups', data),

  update: (id: number, data: { name?: string; description?: string; default_quota?: number; is_default?: boolean }) =>
    api.put<UserGroup>(`/admin/groups/${id}`, data),

  delete: (id: number) =>
    api.delete<void>(`/admin/groups/${id}`),

  setDefault: (id: number) =>
    api.post<void>(`/admin/groups/${id}/default`),

  addDomain: (groupId: number, domainId: number) =>
    api.post<void>(`/admin/groups/${groupId}/domains`, { domain_id: domainId }),

  removeDomain: (groupId: number, domainId: number) =>
    api.delete<void>(`/admin/groups/${groupId}/domains/${domainId}`),
}

// 域名管理
export const domainsService = {
  list: () =>
    api.get<Domain[]>('/admin/domains'),

  create: (data: { name: string; description?: string; ssl: boolean }) =>
    api.post<Domain>('/admin/domains', data),

  update: (id: number, data: { description?: string; ssl?: boolean; is_active?: boolean }) =>
    api.put<Domain>(`/admin/domains/${id}`, data),

  delete: (id: number) =>
    api.delete<void>(`/admin/domains/${id}`),

  setDefault: (id: number) =>
    api.post<void>(`/admin/domains/${id}/default`),
}

// 配置管理
export const configService = {
  get: () =>
    api.get<Record<string, string>>('/admin/config'),

  update: (key: string, value: string) =>
    api.put<void>('/admin/config', { key, value }),

  batchUpdate: (config: Record<string, string>) =>
    api.put<void>('/admin/config/batch', config),
}

// 模板管理
export const templatesService = {
  list: () =>
    api.get<RedirectTemplate[]>('/admin/templates'),

  get: (id: number) =>
    api.get<RedirectTemplate>(`/admin/templates/${id}`),

  create: (data: { name: string; description?: string; content: string }) =>
    api.post<RedirectTemplate>('/admin/templates', data),

  update: (id: number, data: { name?: string; description?: string; content?: string }) =>
    api.put<RedirectTemplate>(`/admin/templates/${id}`, data),

  delete: (id: number) =>
    api.delete<void>(`/admin/templates/${id}`),

  setDefault: (id: number) =>
    api.post<void>(`/admin/templates/${id}/default`),
}

// 仪表盘统计
export const dashboardService = {
  getSummary: () =>
    api.get<AdminSummary>('/admin/dashboard/summary'),

  getTrends: (days: number = 30) =>
    api.get<TrendDataResponse>(`/admin/dashboard/trends?days=${days}`),
}

// 审计日志
export const auditLogsService = {
  list: async (params: { page?: number; page_size?: number; actor_id?: number; action?: string }) =>
    api.get<AuditLogsResponse>('/admin/audit-logs', { params }),
}
