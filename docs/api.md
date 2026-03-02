# API 文档

## 基本信息

- **Base URL**: `http://localhost:8080` (默认)
- **认证方式**: Keycloak OIDC (Bearer Token) 或 API 签名认证
- **响应格式**: JSON

## 认证说明

### Bearer Token 认证

用于前端用户认证，通过 Keycloak OAuth2 获取。

```
Authorization: Bearer <access_token>
```

### API 签名认证

用于第三方系统集成，需要 API Key 和签名。

**请求头**:
```
X-API-Key: <api_key>
X-Signature: <signature>
X-Timestamp: <unix_timestamp>
X-Nonce: <random_string>
```

**签名计算方式**:
```
signature = HMAC-SHA256(api_secret, timestamp + nonce + request_body + path + method)
```

---

## API 接口列表

### 一、健康检查

#### 1.1 基础健康检查

```http
GET /health
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "status": "ok",
    "timestamp": 1234567890,
    "services": {
      "server": "ok"
    }
  }
}
```

#### 1.2 就绪检查

```http
GET /readiness
```

检查服务器及依赖服务（数据库、Redis）状态。

**响应**:
```json
{
  "code": 0,
  "data": {
    "status": "ok",
    "services": {
      "database": {
        "status": "ok",
        "latency_ms": 5
      },
      "redis": {
        "status": "ok",
        "latency_ms": 1
      }
    },
    "version": "1.0.0"
  }
}
```

#### 1.3 存活检查

```http
GET /liveness
```

Kubernetes 存活探针使用。

**响应**:
```json
{
  "status": "alive"
}
```

---

### 二、认证相关

#### 2.1 获取登录 URL

```http
POST /api/auth/login-url
Content-Type: application/json
```

**请求体**:
```json
{
  "redirect_to": "http://localhost:3000/dashboard"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "login_url": "https://sso.example.com/realms/surls/...",
    "state": "base64_encoded_state"
  }
}
```

#### 2.2 Keycloak 回调

```http
GET /api/auth/callback?code=<authorization_code>&state=<state>
```

由 Keycloak 回调，返回 HTML 页面。

#### 2.3 刷新 Token

```http
POST /api/auth/refresh
Content-Type: application/json
```

**请求体**:
```json
{
  "refresh_token": "your_refresh_token_here"
}
```

#### 2.4 登出

```http
POST /api/auth/logout
Content-Type: application/json
```

**请求体**:
```json
{
  "refresh_token": "your_refresh_token_here",
  "redirect_to": "http://localhost:3000/login"
}
```

---

### 三、公开 API

#### 3.1 获取站点配置

```http
GET /api/config
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "site_name": "Surls",
    "logo_url": "https://example.com/logo.png",
    "redirect_page_enabled": "false",
    "allow_user_template": "false",
    "enable_signup": "true"
  }
}
```

#### 3.2 获取活跃域名列表

```http
GET /api/domains
```

**响应**:
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "name": "surls.example.com",
      "is_active": true,
      "is_default": true,
      "ssl": true
    }
  ]
}
```

#### 3.3 获取启用的模板列表

```http
GET /api/templates
```

**响应**:
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "name": "默认模板",
      "is_default": true
    }
  ]
}
```

---

### 四、用户相关 (需认证)

#### 4.1 获取当前用户资料

```http
GET /api/user/profile
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "keycloak_id": "unique-id",
    "username": "john_doe",
    "email": "john@example.com",
    "nickname": "张三",
    "picture": "https://example.com/avatar.jpg",
    "role": "user",
    "quota": 1000,
    "quota_used": 42,
    "status": "active"
  }
}
```

#### 4.2 获取配额状态

```http
GET /api/user/quota
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "quota": 1000,
    "quota_used": 42,
    "quota_remaining": 958,
    "is_unlimited": false
  }
}
```

**配额说明**:
- `quota = -1`: 无限配额
- `quota = -2`: 继承用户组配额

#### 4.3 获取用户仪表盘

```http
GET /api/user/dashboard
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "total_links": 42,
    "total_clicks": 1523,
    "recent_links": [...]
  }
}
```

---

### 五、短链接管理 (需认证)

#### 5.1 创建短链接

```http
POST /api/links
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**:
```json
{
  "url": "https://www.example.com/very/long/url",
  "code": "custom123",
  "title": "示例网站",
  "domain_id": 1,
  "template_id": 1,
  "expires_at": "2025-12-31T23:59:59Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 目标 URL |
| code | string | 否 | 自定义短码（留空自动生成） |
| title | string | 否 | 标题 |
| domain_id | int | 否 | 域名ID，默认为1 |
| template_id | int | 否 | 跳转模板ID |
| expires_at | datetime | 否 | 过期时间 |

**响应**:
```json
{
  "code": 0,
  "data": {
    "code": "custom123",
    "short_url": "http://surls.example.com/custom123",
    "original_url": "https://www.example.com/very/long/url",
    "title": "示例网站"
  }
}
```

#### 5.2 获取短链接列表

```http
GET /api/links?page=1&page_size=20
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "links": [...],
    "total": 42,
    "page": 1,
    "page_size": 20,
    "total_page": 3
  }
}
```

#### 5.3 获取短链接详情

```http
GET /api/links/:code
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "code": "custom123",
    "url": "https://www.example.com",
    "title": "示例网站",
    "user_id": 1,
    "domain_id": 1,
    "click_count": 42,
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### 5.4 更新短链接

```http
PUT /api/links/:code
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**:
```json
{
  "url": "https://www.newurl.com",
  "title": "更新后的标题",
  "status": "active"
}
```

#### 5.5 删除短链接

```http
DELETE /api/links/:code
Authorization: Bearer <token>
```

#### 5.6 获取短链接统计

```http
GET /api/links/:code/stats
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "click_count": 1234,
    "unique_ips": 567,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### 5.7 获取访问日志

```http
GET /api/links/:code/logs?page=1&page_size=20
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "logs": [
      {
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0...",
        "referer": "https://google.com",
        "created_at": "2024-01-01T12:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "page_size": 20
  }
}
```

---

### 六、API 密钥管理 (需认证)

#### 6.1 创建 API 密钥

```http
POST /api/apikeys
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**:
```json
{
  "name": "我的应用",
  "expires_in": 2592000
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 密钥名称 |
| expires_in | int | 否 | 过期时长（秒），0 表示永久 |

**响应**:
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "key": "sak_xxxxxxxxxxxxxxxx",
    "secret": "sk_live_xxxxxxxx",
    "name": "我的应用",
    "status": "active"
  }
}
```

#### 6.2 获取 API 密钥列表

```http
GET /api/apikeys
Authorization: Bearer <token>
```

#### 6.3 删除 API 密钥

```http
DELETE /api/apikeys/:id
Authorization: Bearer <token>
```

---

### 七、管理员 API (需 Admin 角色)

#### 7.1 用户管理

##### 获取用户列表

```http
GET /api/admin/users?page=1&page_size=20
Authorization: Bearer <admin_token>
```

##### 更新用户配额

```http
PUT /api/admin/users/quota
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**请求体**:
```json
{
  "user_id": 2,
  "quota": 1000
}
```

##### 设置用户组

```http
PUT /api/admin/users/group
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**请求体**:
```json
{
  "user_id": 2,
  "group_id": 1,
  "inherit_quota": true
}
```

##### 禁用/启用用户

```http
POST /api/admin/users/:id/disable
POST /api/admin/users/:id/enable
Authorization: Bearer <admin_token>
```

#### 7.2 用户组管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/groups` | GET | 获取用户组列表 |
| `/api/admin/groups` | POST | 创建用户组 |
| `/api/admin/groups/:id` | GET | 获取用户组详情 |
| `/api/admin/groups/:id` | PUT | 更新用户��� |
| `/api/admin/groups/:id` | DELETE | 删除用户组 |
| `/api/admin/groups/:id/default` | POST | 设置默认用户组 |
| `/api/admin/groups/:id/domains` | POST | 添加域名到用户组 |
| `/api/admin/groups/:id/domains/:domainId` | DELETE | 从用户组移除域名 |

**创建用户组请求体**:
```json
{
  "name": "普通用户组",
  "description": "普通用户默认组",
  "default_quota": 100
}
```

#### 7.3 域名管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/domains` | GET | 获取所有域名 |
| `/api/admin/domains` | POST | 创建域名 |
| `/api/admin/domains/:id` | PUT | 更新域名 |
| `/api/admin/domains/:id` | DELETE | 删除域名 |
| `/api/admin/domains/:id/default` | POST | 设置默认域名 |

**创建域名请求体**:
```json
{
  "name": "short.example.com",
  "description": "短链接域名",
  "ssl": true
}
```

#### 7.4 模板管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/templates` | GET | 获取模板列表 |
| `/api/admin/templates` | POST | 创建模板 |
| `/api/admin/templates/:id` | GET | 获取模板详情 |
| `/api/admin/templates/:id` | PUT | 更新模板 |
| `/api/admin/templates/:id` | DELETE | 删除模板 |
| `/api/admin/templates/:id/default` | POST | 设置默认模板 |

**创建模板请求体**:
```json
{
  "name": "简约风格",
  "content": "<!DOCTYPE html>...",
  "enabled": true
}
```

#### 7.5 站点配置管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/config` | GET | 获取所有配置 |
| `/api/admin/config` | PUT | 更新配置 |
| `/api/admin/config/batch` | PUT | 批量更新配置 |
| `/api/admin/config/cors` | GET | 获取 CORS 配置 |
| `/api/admin/config/cors` | PUT | 更新 CORS 配置 |

**更新配置请求体**:
```json
{
  "key": "site_name",
  "value": "麟云短链"
}
```

**批量更新配置请求体**:
```json
{
  "configs": [
    {"key": "site_name", "value": "麟云短链"},
    {"key": "logo_url", "value": "https://example.com/logo.png"}
  ]
}
```

**更新 CORS 配置请求体**:
```json
{
  "origins": ["http://localhost:3000", "https://example.com"]
}
```

#### 7.6 仪表盘统计

##### 获取管理员统计摘要

```http
GET /api/admin/dashboard/summary
Authorization: Bearer <admin_token>
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "total_users": 1523,
    "total_links": 15234,
    "total_clicks": 1523456,
    "active_users": 1200,
    "active_links": 14000
  }
}
```

##### 获取流量趋势

```http
GET /api/admin/dashboard/trends?days=30
Authorization: Bearer <admin_token>
```

#### 7.7 审计日志查询

```http
GET /api/admin/audit-logs?page=1&page_size=20&actor_id=1&action=link.create
Authorization: Bearer <admin_token>
```

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码，默认 1 |
| page_size | int | 否 | 每页数量，默认 20 |
| actor_id | int | 否 | 筛选指定操作者的日志 |
| action | string | 否 | 筛选指定操作类型 |

**可用操作类型**:
- `user.create/update/delete/disable/enable/set_group/update_quota`
- `link.create/update/delete`
- `apikey.create/delete`
- `config.update`
- `domain.create/update/delete`
- `group.create/update/delete`
- `template.create/update/delete`

---

### 八、短链接跳转

#### 8.1 访问短链接

```http
GET /:code
```

- 返回 `302` 重定向到目标 URL
- 自动记录访问日志和点击统计

**错误响应**:
| 状态码 | 说明 |
|--------|------|
| 400 | 短码格式无效 |
| 404 | 短链接不存在 |
| 410 | 短链接已过期 |
| 403 | 短链接已禁用 |

---

## 统一响应格式

### 成功响应

```json
{
  "code": 0,
  "data": { ... },
  "message": "success"
}
```

### 错误响应

```json
{
  "code": 400,
  "error": "error message"
}
```

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 / Token 无效 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 410 | 资源已过期 |
| 429 | 请求过于频繁（限流） |
| 500 | 服务器内部错误 |

---

## 限流规则

| 类型 | 限制 |
|------|------|
| IP 限流 | 100 次/分钟 |
| 用户限流 | 200 次/分钟 |
| API 密钥限流 | 500 次/分钟 |
| 全局限流 | 10000 次/秒 |
