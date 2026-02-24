import api from './api'
import type { ShortLink, CreateLinkRequest, PaginatedResponse } from '@/types'

export const linksService = {
  // 获取链接列表
  list: (params: { page?: number; page_size?: number }) =>
    api.get<any, PaginatedResponse<ShortLink>>('/links', { params }),

  // 创建短链接
  create: (data: CreateLinkRequest) =>
    api.post<any, ApiResponse<ShortLink>>('/links', data),

  // 更新链接
  update: (code: string, data: Partial<ShortLink>) =>
    api.put<any, ApiResponse<ShortLink>>(`/links/${code}`, data),

  // 删除链接
  delete: (code: string) =>
    api.delete<any, ApiResponse>(`/links/${code}`),

  // 获取链接统计
  stats: (code: string) =>
    api.get<any, ApiResponse>(`/links/${code}/stats`),
}
