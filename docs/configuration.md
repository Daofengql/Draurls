# 配置指南

## 环境变量

### 服务器配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `SERVER_PORT` | 服务端口 | 8080 |
| `SERVER_MODE` | 运行模式 | debug |
| `SERVER_BASE_URL` | 服务地址（留空自动检测） | - |

### 数据库配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DB_HOST` | 数据库地址 | 127.0.0.1 |
| `DB_PORT` | 数据库端口 | 3306 |
| `DB_USER` | 数据库用户 | root |
| `DB_PASSWORD` | 数据库密码 | - |
| `DB_NAME` | 数据库名称 | surls |
| `DB_CHARSET` | 字符集 | utf8mb4 |
| `DB_MAX_IDLE_CONNS` | 最大空闲连接数 | 10 |
| `DB_MAX_OPEN_CONNS` | 最大打开连接数 | 100 |

### Redis 配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `REDIS_HOST` | Redis 地址 | 127.0.0.1 |
| `REDIS_PORT` | Redis 端口 | 6379 |
| `REDIS_PASSWORD` | Redis 密码 | - |
| `REDIS_DB` | Redis 数据库编号 | 0 |

### Keycloak OIDC 配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `KEYCLOAK_BASE_URL` | Keycloak 服务器地址 | http://localhost:8081 |
| `KEYCLOAK_REALM` | Realm 名称 | surls |
| `KEYCLOAK_CLIENT_ID` | 客户端 ID | surls |
| `KEYCLOAK_SECRET` | 客户端密钥 | - |
| `KEYCLOAK_CALLBACK_URL` | 回调地址 | http://localhost:8080/api/auth/callback |

### 安全配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `JWT_SECRET` | JWT 签名密钥 | - |
| `ENABLE_HTTPS` | 启用 HTTPS | false |

### 缓存配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `CACHE_HOT_TTL` | 热数据 TTL（秒） | 3600 |
| `CACHE_WARM_TTL` | 温数据 TTL（秒） | 86400 |
| `CACHE_COLD_TTL` | 冷数据 TTL（秒） | 604800 |

### 限流配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `RATE_LIMIT_IP` | IP 限流（次/分钟） | 100 |
| `RATE_LIMIT_USER` | 用户限流（次/分钟） | 200 |
| `RATE_LIMIT_API` | API 限流（次/分钟） | 500 |
| `RATE_LIMIT_GLOBAL` | 全局限流（次/秒） | 10000 |

## 站点配置

系统支持以下配置项，可在管理后台修改：

### 基本设置

| 配置项 | 说明 |
|--------|------|
| `site_name` | 站点名称，显示在页面标题和导航 |
| `logo_url` | 站点 Logo 图片地址 |

### 跳转页面设置

| 配置项 | 说明 |
|--------|------|
| `redirect_page_enabled` | 是否启用跳转中间页 |
| `allow_user_template` | 用户创建链接时是否可选择模板 |

### 短链设置

| 配置项 | 说明 |
|--------|------|
| `shortcode_mode` | 短码生成模式：`random`（随机）/ `sequence`（自增） |
| `max_link_length` | 自定义短码的最大长度（3-20） |
| `allow_custom_code` | 允许普通用户使用自定义短码 |

### 用户设置

| 配置项 | 说明 |
|--------|------|
| `enable_signup` | 是否开放新用户注册 |

### CORS 设置

| 配置项 | 说明 |
|--------|------|
| `cors_origins` | 允许的跨域来源，逗号分隔 |

## 缓存策略

系统采用三级缓存策略，根据访问频率自动调整：

| 温度 | TTL | 说明 |
|------|-----|------|
| 热 | 1 小时 | 高频访问数据 |
| 温 | 1 天 | 中频访问数据 |
| 冷 | 7 天 | 低频访问数据 |

## 限流策略

| 类型 | 限制 |
|------|------|
| IP 限流 | 100 次/分钟 |
| 用户限流 | 200 次/分钟 |
| API 限流 | 500 次/分钟 |
| 全局限流 | 10000 次/秒 |
