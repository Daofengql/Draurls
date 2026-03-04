import api from './api'
import type { RedirectTemplate } from '@/types'

export interface SiteConfig {
  site_name?: string
  logo_url?: string
  redirect_page_enabled?: string
  allow_user_template?: string
  enable_signup?: string
  icp_number?: string
}

export const configService = {
  get: () =>
    api.get<SiteConfig>('/config'),

  // 获取可用的跳转模板列表
  getTemplates: () =>
    api.get<RedirectTemplate[]>('/templates'),
}
