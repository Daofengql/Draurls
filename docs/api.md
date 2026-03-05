# API 文档

## 基本信息

- **Base URL**: `http://localhost:8080` (默认)
- **认证方式**: Keycloak OIDC (Bearer Token) 或 API 签名认证
- **响应格式**: JSON

## 认证说明

### 认证流程

系统使用 Keycloak OIDC 进行用户认证，支持以下登录场景：

1. **首次登录（第一个用户）**
   - 自动注册为管理员
   - 直接完成登录，无需确认

2. **新用户注册**
   - 显示授权确认页面（类似 OAuth 流程）
   - 用户可选择"允许"或"取消"
   - 点击"允许"：创建用户并完成登录
   - 点击"取消"：仅记录日志，不创建用户

3. **已存在用户登录**
   - 直接完成登录

4. **被禁用用户登录**
   - 显示禁用提示页面
   - 无法完成登录，需联系管理员

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

#### 2.5 确认注册

```http
POST /api/auth/confirm-registration
Content-Type: application/json
```

新用户在授权确认页面点击"允许"后调用。

**请求体**:
```json
{
  "session_id": "generated_session_id"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "message": "Registration successful",
    "redirect_to": "http://localhost:3000/dashboard"
  }
}
```

#### 2.6 取消注册

```http
POST /api/auth/cancel-registration
Content-Type: application/json
```

新用户在授权确认页面点击"取消"后调用。

**请求体**:
```json
{
  "session_id": "generated_session_id"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "message": "Registration cancelled"
  }
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

#### 4.4 获取用户可用域名列表

```http
GET /api/user/domains
Authorization: Bearer <token>
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

**说明**:
- 普通用户：返回其用户组被授权的域名列表
- 管理员：返回所有启用的域名
- 如果用户没有用户组或用户组未被授权任何域名，返回空列表

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

### 六、签名认证 API

第三方系统可以使用 HMAC 签名认证的方式调用短链接创建接口，无需 Cookie 认证。

#### 6.1 创建短链接（签名认证）

```http
POST /api/v1/shorten
Content-Type: application/json
X-API-Key: <your_api_key>
X-Signature: <hmac_sha256_signature>
X-Timestamp: <unix_timestamp>
```

**请求头**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| X-API-Key | string | 是 | API 密钥 |
| X-Signature | string | 是 | HMAC-SHA256 签名 |
| X-Timestamp | int64 | 是 | Unix 时间戳 |

**请求体**:
```json
{
  "original_url": "https://example.com/very/long/url",
  "domain": "surls.example.com",
  "title": "我的短链接"
}
```

**签名计算方法**:

```
signature = HMAC-SHA256(api_secret, timestamp + method + path + body)
```

其中：
- `api_secret`: API 密钥对应的密钥
- `timestamp`: X-Timestamp 的值
- `method`: HTTP 方法（大写），如 "POST"
- `path`: 请求路径，如 "/api/v1/shorten"
- `body`: 请求体的 JSON 字符串（不进行格式化）

**示例（Go）**:
```go
import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "strconv"
)

func calculateSignature(apiSecret, timestamp, method, path, body string) string {
    data := timestamp + method + path + body
    h := hmac.New(sha256.New, []byte(apiSecret))
    h.Write([]byte(data))
    return hex.EncodeToString(h.Sum(nil))
}

timestamp := strconv.FormatInt(time.Now().Unix(), 10)
method := "POST"
path := "/api/v1/shorten"
body := `{"original_url":"https://example.com"}`
signature := calculateSignature(apiSecret, timestamp, method, path, body)
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "short_url": "https://surls.example.com/r/abc123",
    "code": "abc123",
    "original_url": "https://example.com/very/long/url"
  }
}
```

**错误响应**:
| 状态码 | 说明 |
|--------|------|
| 401 | 签名验证失败 |
| 403 | API 密钥无效或已禁用 |
| 429 | 请求频率超限 |
| 400 | 请求参数错误 |

---

### 七、API 密钥管理 (需认证)

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
| `/api/admin/groups` | GET | 获取用户组列表 |
| `/api/admin/groups` | POST | 创建用户组 |
| `/api/admin/groups/:id` | GET | 获取用户组详情 |
| `/api/admin/groups/:id` | PUT | 更新用户组 |
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

#### 8.3 域名管理

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

#### 8.4 模板管理

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

#### 8.5 站点配置管理

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

#### 8.6 仪表盘统计

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

#### 8.7 审计日志查询

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

#### 8.8 管理员链接管理

##### 8.8.1 获取所有短链接

```http
GET /api/admin/links?page=1&page_size=20&domain_id=1&status=active&user_id=1
Authorization: Bearer <admin_token>
```

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码，默认 1 |
| page_size | int | 否 | 每页数量，默认 20 |
| domain_id | int | 否 | 筛选指定域名的链接 |
| status | string | 否 | 筛选状态：active/expired/disabled |
| user_id | int | 否 | 筛选指定用户的链接 |

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "code": "abc123",
        "original_url": "https://example.com",
        "domain_id": 1,
        "user_id": 1,
        "title": "示例链接",
        "clicks": 100,
        "status": "active",
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "page_size": 20
  }
}
```

##### 8.8.2 更新短链接（管理员）

```http
PUT /api/admin/links/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "original_url": "https://new-example.com",
  "title": "新标题",
  "status": "disabled",
  "expires_at": "2024-12-31T23:59:59Z"
}
```

**请求体**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| original_url | string | 否 | 目标 URL |
| title | string | 否 | 链接标题 |
| status | string | 否 | 状态：active/disabled |
| expires_at | datetime | 否 | 过期时间 |

##### 8.8.3 删除短链接（管理员）

```http
DELETE /api/admin/links/:id
Authorization: Bearer <admin_token>
```

**响应**:
```json
{
  "code": 0,
  "message": "success"
}
```

---


### 九、短链接跳转

#### 8.1 访问短链接

```http
GET /r/:code
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
