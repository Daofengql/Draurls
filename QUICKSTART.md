# Surls 后端服务启动指南

## 前置要求

1. **Go** 1.21+
2. **MySQL** 5.7+ 或 8.0+
3. **Redis** 5.0+
4. **Keycloak** 20.0+ (用于 OIDC 认证)

---

## 启动步骤

### 1. 创建数据库

```sql
CREATE DATABASE IF NOT EXISTS surls CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> 表结构会在服务启动时自动创建

### 2. 配置 Keycloak

#### 2.1 启动 Keycloak

```bash
# 使用 Docker 启动 Keycloak（推荐）
docker run -d \
  --name keycloak \
  -p 8081:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin123 \
  quay.io/keycloak/keycloak:24.0 \
  start-dev
```

#### 2.2 创建 Realm 和 Client

1. 访问 http://localhost:8081
2. 登录（admin / admin123）
3. 创建新的 Realm：`surls`
4. 在 Realm 中创建 Client：
   - Client ID: `surls`
   - Client Authentication: ON
   - Valid Redirect URIs: `http://localhost:3000/*`
   - Web Origins: `http://localhost:3000`

### 3. 配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `backend/.env`：

```env
# 数据库
DB_PASSWORD=你的MySQL密码

# Keycloak（保持默认即可）
KEYCLOAK_BASE_URL=http://localhost:8081
KEYCLOAK_REALM=surls
KEYCLOAK_CLIENT_ID=surls
```

### 4. 安装依赖并启动

```bash
cd backend
go mod download
go run cmd/server/main.go
```

启动成功输出：

```
Database connected successfully
Running database migrations...
Redis connected successfully
Keycloak OIDC configured: http://localhost:8081/realms/surls
Server starting on :8080
```

---

## 获取 Keycloak Token

### 1. 获取 Token

```bash
# 获取 admin 用户的 token
curl -X POST http://localhost:8081/realms/surls/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=surls" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "username=YOUR_USERNAME" \
  -d "password=YOUR_PASSWORD" \
  -d "grant_type=password"
```

返回：
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "...",
  "expires_in": 300,
  ...
}
```

### 2. 使用 Token 调用 API

```bash
curl http://localhost:8080/api/user/dashboard \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 首位用户自动为 Admin

- 第一个通过 Keycloak 登录的用户会自动成为系统管理员
- 后续用户默认为普通用户
- 管理员可在后台管理界面修改用户角色

---

## API 端点

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/health` | GET | 否 | 健康检查 |
| `/api/user/dashboard` | GET | 是 | 用户仪表盘 |
| `/api/links` | POST | 是 | 创建短链接 |
| `/api/admin/dashboard/summary` | GET | 是(管理员) | 管理员统计 |

完整 API 文档见 `Surls-API.postman.json`
