# Draurls 短链接服务 API 文档

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

请求头:
```
X-API-Key: <api_key>
X-Signature: <signature>
X-Timestamp: <unix_timestamp>
X-Nonce: <random_string>
```

签名计算方式:
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

**响应示例**:
```json
{
  "status": "ok"
}
```

#### 1.2 就绪检查

```http
GET /readiness
```

检查服务器及依赖服务（数据库、Redis）状态。

**响应示例**:
```json
{
  "status": "ready",
  "database": "ok",
  "redis": "ok"
}
```

#### 1.3 存活检查

```http
GET /liveness
```

Kubernetes 存活探针使用。

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
    "login_url": "http://localhost:8081/realms/draurls/protocol/openid-connect/auth?client_id=draurls&redirect_uri=...&state=...",
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

**响应**:
```json
{
  "code": 0,
  "data": {
    "access_token": "...",
    "token_type": "Bearer",
    "expires_in": 300,
    "refresh_token": "...",
    "id_token": "..."
  }
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
    "site_name": "Draurls",
    "logo_url": "https://example.com/logo.png",
    "redirect_page_enabled": "false",
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
      "name": "draurls.local",
      "is_active": true,
      "is_default": true,
      "ssl": true
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
    "keycloak_id": "unique-id-from-keycloak",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user",
    "quota": 1000,
    "quota_used": 42,
    "status": "active"
  }
}
```

#### 4.2 获取用户配额状态

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
  "expires_at": "2025-12-31T23:59:59Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 目标 URL |
| code | string | 否 | 自定义短码（留空自动生成） |
| title | string | 否 | 标题 |
| expires_at | datetime | 否 | 过期时间 |

**响应**:
```json
{
  "code": 0,
  "data": {
    "code": "custom123",
    "short_url": "http://localhost:8080/custom123",
    "original_url": "https://www.example.com/very/long/url",
    "title": "示例网站",
    "expires_at": "2025-12-31T23:59:59Z"
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
    "click_count": 42,
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z",
    "expires_at": null
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
        "id": 1,
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
| expires_in | int | 否 | 过期时间（秒），0 表示永久 |

**响应**:
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "key": "sak_xxxxxxxxxxxxxxxx",
    "secret": "sk_live_xxxxxxxx",  // 仅创建时返回一次
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

### 七、API 签名认证接口

#### 7.1 创建短链接（签名认证）

```http
POST /api/v1/shorten
X-API-Key: <api_key>
X-Signature: <signature>
X-Timestamp: <timestamp>
X-Nonce: <nonce>
Content-Type: application/json
```

**请求体**:
```json
{
  "url": "https://www.example.com",
  "title": "通过API创建"
}
```

---

### 八、管理员 API (需 Admin 角色)

#### 8.1 用户管理

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

#### 8.2 用户组管理

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/admin/groups | GET | 获取用户组列表 |
| /api/admin/groups | POST | 创建用户组 |
| /api/admin/groups/:id | GET | 获取用户组详情 |
| /api/admin/groups/:id | PUT | 更新用户组 |
| /api/admin/groups/:id | DELETE | 删除用户组 |

**创建用户组请求体**:
```json
{
  "name": "普通用户组",
  "description": "普通用户默认组",
  "default_quota": 100
}
```

#### 8.3 站点配置管理

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/admin/config | GET | 获取所有配置 |
| /api/admin/config | PUT | 更新配置 |
| /api/admin/config/batch | PUT | 批量更新配置 |

**更新配置请求体**:
```json
{
  "site_name": "麟云短链",
  "logo_url": "https://example.com/logo.png"
}
```

#### 8.4 域名管理

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/admin/domains | GET | 获取所有域名 |
| /api/admin/domains | POST | 创建域名 |
| /api/admin/domains/:id | PUT | 更新域名 |
| /api/admin/domains/:id | DELETE | 删除域名 |
| /api/admin/domains/:id/default | POST | 设置默认域名 |

**创建域名请求体**:
```json
{
  "name": "short.example.com",
  "description": "短链接域名",
  "ssl": true
}
```

#### 8.5 仪表盘统计

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

#### 8.6 跳转模板管理

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/admin/templates | GET | 获取模板列表 |
| /api/admin/templates | POST | 创建模板 |
| /api/admin/templates/:id | GET | 获取模板详情 |
| /api/admin/templates/:id | PUT | 更新模板 |
| /api/admin/templates/:id | DELETE | 删除模板 |
| /api/admin/templates/:id/default | POST | 设置默认模板 |

**创建模板请求体**:
```json
{
  "name": "简约风格",
  "content": "<!DOCTYPE html>...",
  "enabled": true
}
```

#### 8.7 审计日志查询

##### 查询审计日志

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

**响应**:
```json
{
  "code": 0,
  "data": {
    "logs": [
      {
        "id": 1,
        "actor_id": 1,
        "action": "link.create",
        "resource": "link",
        "resource_id": 123,
        "details": "code:abc123,url:https://example.com",
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0...",
        "created_at": "2024-01-01T12:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "page_size": 20,
    "total_page": 5
  }
}
```

---

### 九、短链接跳转

#### 9.1 访问短链接

```http
GET /:code
```

- 返回 `302` 重定向到目标 URL
- 自动记录访问日志和点击统计

**错误响应**:
| 状态码 | 说明 |
|--------|------|
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

| 状态码 | 说明 |
|--------|------|
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

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| 1001 | 参数错误 |
| 1002 | 无效的 URL |
| 2001 | 用户不存在 |
| 2002 | 用户已被禁用 |
| 2003 | 配额不足 |
| 3001 | 短链接不存在 |
| 3002 | 短链接已过期 |
| 3003 | 短链接已被禁用 |
| 3004 | 短码已存在 |
| 4001 | API 密钥无效 |
| 4002 | 签名验证失败 |
| 4003 | 时间戳过期 |
| 4004 | Nonce 重复 |
| 5001 | 无权限操作 |
