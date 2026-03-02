# API 文档

## 认证方式

支持两种认证方式：

### 1. OIDC 认证

通过 Keycloak 等标准 OIDC 提供商登录，获取 JWT Token 后，在请求头中携带：

```
Authorization: Bearer <token>
```

### 2. API 签名认证

使用 API Key + HMAC-SHA256 签名：

| 请求头 | 说明 |
|--------|------|
| `X-API-Key` | API Key |
| `X-Timestamp` | Unix 时间戳 |
| `X-Nonce` | 随机字符串（UUID） |
| `X-Signature` | HMAC-SHA256 签名 |

**签名计算方式：**

```
SIGNATURE = HMAC-SHA256(SECRET, TIMESTAMP + NONCE + REQUEST_BODY + PATH + METHOD)
```

**签名示例：**

```bash
TIMESTAMP=$(date +%s)
NONCE=$(uuidgen)
SECRET="your_api_secret"

SIGNATURE=$(echo -n "${TIMESTAMP}${NONCE}{\"url\":\"https://example.com\"}/linksPOST" | \
  openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')

curl -X POST http://localhost:8080/api/links \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Nonce: $NONCE" \
  -H "X-Signature: $SIGNATURE" \
  -d '{"url":"https://example.com"}'
```

## 主要 API 端点

### 公开接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/:code` | GET | 短链跳转 |
| `/api/config` | GET | 获取站点配置 |
| `/api/templates` | GET | 获取可用模板 |

### 用户接口（需要认证）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/links` | POST | 创建短链接 |
| `/api/links` | GET | 获取我的链接列表 |
| `/api/links/:code` | GET | 获取链接详情 |
| `/api/links/:code` | PUT | 更新链接 |
| `/api/links/:code` | DELETE | 删��链接 |
| `/api/links/:code/stats` | GET | 获取链接统计 |
| `/api/links/:code/logs` | GET | 获取访问日志 |
| `/api/user/profile` | GET | 获取个人信息 |
| `/api/user/profile` | PUT | 更新个人信息 |
| `/api/user/dashboard` | GET | 用户仪表盘统计 |
| `/api/user/api-keys` | GET | 获取 API 密钥列表 |
| `/api/user/api-keys` | POST | 创建 API 密钥 |
| `/api/user/api-keys/:id` | DELETE | 删除 API 密钥 |

### 管理员接口（需要管理员权限）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/users` | GET | 获取用户列表 |
| `/api/admin/users/:id` | PUT | 更新用户信息 |
| `/api/admin/users/:id` | DELETE | 删除用户 |
| `/api/admin/groups` | GET | 获取用户组列表 |
| `/api/admin/groups` | POST | 创建用户组 |
| `/api/admin/groups/:id` | PUT | 更新用户组 |
| `/api/admin/groups/:id` | DELETE | 删除用户组 |
| `/api/admin/domains` | GET | 获取域名列表 |
| `/api/admin/domains` | POST | 创建域名 |
| `/api/admin/domains/:id` | PUT | 更新域名 |
| `/api/admin/domains/:id` | DELETE | 删除域名 |
| `/api/admin/templates` | GET | 获取模板列表 |
| `/api/admin/templates` | POST | 创建模板 |
| `/api/admin/templates/:id` | PUT | 更新模板 |
| `/api/admin/templates/:id` | DELETE | 删除模板 |
| `/api/admin/config` | GET | 获取站点配置 |
| `/api/admin/config` | PUT | 更新站点配置 |
| `/api/admin/audit-logs` | GET | 获取审计日志 |
| `/api/admin/dashboard/summary` | GET | 管理员统计摘要 |

## 数据模型

### ShortLink 短链接

```json
{
  "id": 1,
  "code": "abc123",
  "url": "https://example.com",
  "title": "示例链接",
  "domain_id": 1,
  "template_id": null,
  "user_id": 1,
  "click_count": 100,
  "status": "active",
  "expires_at": "2024-12-31T23:59:59Z",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### User 用户

```json
{
  "id": 1,
  "username": "user@example.com",
  "nickname": "张三",
  "picture": "https://example.com/avatar.jpg",
  "role": "user",
  "group_id": 1,
  "quota": 1000,
  "status": "active",
  "last_login_at": "2024-01-01T00:00:00Z",
  "last_login_ip": "127.0.0.1",
  "created_at": "2024-01-01T00:00:00Z"
}
```

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |
