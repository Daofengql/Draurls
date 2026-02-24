// 用户类型
export interface User {
  id: number
  keycloak_id: string
  username: string
  email: string
  nickname?: string
  picture?: string
  role: 'admin' | 'user'
  group_id?: number
  quota: number
  quota_used: number
  status: 'active' | 'disabled' | 'deleted'
  created_at: string
  updated_at: string
}

// 用户组类型
export interface UserGroup {
  id: number
  name: string
  description: string
  default_quota: number
  created_at: string
  updated_at: string
}

// 域名类型
export interface Domain {
  id: number
  name: string
  is_active: boolean
  is_default: boolean
  ssl: boolean
  description?: string
  created_at: string
  updated_at: string
}

// 短链接类型
export interface ShortLink {
  id: number
  code: string
  url: string
  domain_id: number
  domain?: Domain
  user_id: number
  title?: string
  expires_at?: string
  click_count: number
  last_click_at?: string
  status: 'active' | 'disabled' | 'expired'
  created_at: string
  updated_at: string
}

// API密钥类型
export interface APIKey {
  id: number
  key: string
  name: string
  user_id: number
  expires_at?: string
  last_used_at?: string
  status: 'active' | 'disabled' | 'expired'
  created_at: string
  updated_at: string
}

// 站点配置类型
export interface SiteConfig {
  site_name: string
  logo_url: string
  redirect_page_enabled: boolean
  custom_domains: string[]
  default_quota: number
  max_link_length: number
  enable_signup: boolean
}

// 分页响应类型
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
}

// API响应类型
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data?: T
}

// 创建短链接请求类型
export interface CreateLinkRequest {
  url: string
  code?: string
  title?: string
  expires_at?: string
  domain_id?: number
}

// API错误类型
export interface APIError {
  code: string
  message: string
  details?: unknown
}
