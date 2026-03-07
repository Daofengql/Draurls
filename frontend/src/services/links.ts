import api from './api'
import type { ShortLink, CreateLinkRequest, PaginatedResponse, AccessLog } from '@/types'

// 后端返回的分页响应格式
interface BackendLinksResponse {
  links: ShortLink[]
  total: number
  page: number
  page_size: number
  total_page: number
}

export const linksService = {
  // 获取链接列表
  list: async (params: { page?: number; page_size?: number }): Promise<PaginatedResponse<ShortLink>> => {
    const res = await api.get<BackendLinksResponse>('/links', { params })
    // 转换后端格式到前端期望的格式
    return {
      data: res.links,
      total: res.total,
      page: res.page,
      page_size: res.page_size,
    }
  },

  // 创建短链接
  create: (data: CreateLinkRequest) =>
    api.post<ShortLink>('/links', data),

  // 获取单个链接
  get: (code: string) =>
    api.get<ShortLink>(`/links/${code}`),

  // 更新链接
  update: (code: string, data: Partial<ShortLink>) =>
    api.put<ShortLink>(`/links/${code}`, {
      url: data.URL,
      title: data.Title,
      status: data.Status,
      template_id: data.TemplateID,
      expires_at: data.ExpiresAt,
    }),

  // 删除链接
  delete: (code: string) =>
    api.delete<void>(`/links/${code}`),

  // 获取链接统计
  stats: (code: string) =>
    api.get<{ click_count: number; unique_ips: number; created_at: string }>(`/links/${code}/stats`),

  // 获取访问日志
  logs: (code: string, params: { page?: number; page_size?: number }) =>
    api.get<{ logs: AccessLog[]; total: number }>(`/links/${code}/logs`, { params }),
}
