import api from './api'
import type { User, QuotaStatus, DashboardStats } from '@/types'

export const usersService = {
  // 获取当前用户资料
  getProfile: () =>
    api.get<User>('/user/profile'),

  // 获取用户配额状态
  getQuotaStatus: () =>
    api.get<QuotaStatus>('/user/quota'),

  // 获取用户仪表盘数据
  getDashboard: () =>
    api.get<DashboardStats>('/user/dashboard'),
}
