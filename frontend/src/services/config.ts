import api from './api'

export interface SiteConfig {
  site_name?: string
  logo_url?: string
  enable_signup?: string
}

export const configService = {
  get: () =>
    api.get<SiteConfig>('/config'),
}
