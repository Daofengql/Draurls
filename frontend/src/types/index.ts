// 用户类型
// 【前置逻辑说明】后端 Go 模型使用驼峰命名，没有 json 标签
// 所以 JSON 返回的字段名也是驼峰格式，需要与后端保持一致
export interface User {
  ID: number
  KeycloakID: string
  Username: string
  Email: string
  Nickname?: string
  Picture?: string
  Role: 'admin' | 'user'
  GroupID?: number
  Quota: number
  QuotaUsed: number
  Status: 'active' | 'disabled' | 'deleted'
  LastLoginAt?: string
  LastLoginIP?: string
  CreatedAt: string
  UpdatedAt: string
}

// 用户组类型
export interface UserGroup {
  ID: number
  Name: string
  Description: string
  DefaultQuota: number
  IsDefault: boolean
  CreatedAt: string
  UpdatedAt: string
}

// 域名类型
export interface Domain {
  ID: number
  Name: string
  IsActive: boolean
  IsDefault: boolean
  SSL: boolean
  Description?: string
  CreatedAt: string
  UpdatedAt: string
}

// 短链接类型
export interface ShortLink {
  ID: number
  Code: string
  URL: string
  DomainID: number
  Domain?: Domain
  TemplateID?: number
  Template?: RedirectTemplate
  UserID: number
  Title?: string
  ExpiresAt?: string
  ClickCount: number
  LastClickAt?: string
  Status: 'active' | 'disabled' | 'expired'
  CreatedAt: string
  UpdatedAt: string
}

// API密钥类型
export interface APIKey {
  ID: number
  Key: string
  Name: string
  UserID: number
  ExpiresAt?: string
  LastUsedAt?: string
  Status: 'active' | 'disabled' | 'expired'
  CreatedAt: string
  UpdatedAt: string
}

// 站点配置类型
export interface SiteConfig {
  site_name: string
  logo_url: string
  redirect_page_enabled: boolean
  default_quota: number
  max_link_length: number
  enable_signup: boolean
}

// 分页响应类型（前端期望格式）
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
}

// 后端返回的分页格式（links 字段而非 data 字段）
export interface BackendPaginatedLinksResponse {
  links: any[]
  total: number
  page: number
  page_size: number
  total_page: number
}

// 后端用户列表分页格式
export interface BackendPaginatedUsersResponse {
  users: any[]
  total: number
  page: number
  page_size: number
  total_page: number
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
  template_id?: number
}

// API错误类型
export interface APIError {
  code: string
  message: string
  details?: unknown
}

// 访问日志类型
export interface AccessLog {
  id: number
  link_id: number
  ip: string
  user_agent?: string
  referer?: string
  created_at: string
}

// 跳转模板类型
export interface RedirectTemplate {
  ID: number
  Name: string
  Description?: string
  Content: string
  IsDefault: boolean
  Enabled: boolean
  CreatedAt: string
  UpdatedAt: string
}

// 用户配额状态
export interface QuotaStatus {
  quota: number
  quota_used: number
  quota_left: number
  percentage: number
  quota_source: 'user' | 'group' | 'unlimited'
  group_name?: string
}

// 仪表盘统计
export interface DashboardStats {
  total_links: number
  total_clicks: number
  today_clicks: number
  recent_links?: ShortLink[]
}

// 管理员统计
export interface AdminSummary {
  total_users: number
  active_users: number
  today_users: number
  total_links: number
  active_links?: number
  today_links: number
  total_clicks: number
  today_clicks: number
  uptime_seconds?: number
  db_connections?: number
}

// 趋势数据（注意：后端返回的是嵌套在 daily_data 中的数组）
export interface TrendDataResponse {
  start_date: string
  end_date: string
  days: number
  daily_data: TrendData[]
}

// 趋势数据
export interface TrendData {
  date: string
  links: number
  clicks: number
  users: number
}

// 审计日志类型
export interface AuditLog {
  ID: number
  ActorID: number
  Actor: any // 用户信息，可能为 null
  Action: string
  Resource: string
  ResourceID?: number
  Details?: string
  IPAddress?: string
  UserAgent?: string
  CreatedAt: string
}

// 审计日志列表响应
export interface AuditLogsResponse {
  logs: AuditLog[]
  total: number
  page: number
  page_size: number
  total_page: number
}
