# Draurls 后端服务

基于 Golang + Gin 构建的短链接服务后端，支持 OIDC 认证、用户分组、跳转模板、审计日志等功能。

## 功能特性

### 核心功能
- 短链接创建与管理（随机短码、自定义短码）
- URL 去重与复用
- 时效控制（永久/限时链接）
- 跳转页面支持（可配置模板）
- 循环检测（防止本系统 URL 嵌套）

### 用户与权限
- OIDC 认证集成
- 角色管理（管理员/普通用户）
- 用户分组与配额管理
- 用户资料管理
- 登录追踪（最后登录时间/IP）

### 跳转模板
- 模板 CRUD 操作
- 默认模板设置
- 用户可选模板
- 自定义 HTML 模板

### 审计日志
- 操作行为记录
- 多维度查询筛选
- IP 与 User-Agent 追踪

### 性能优化
- Redis 多级缓存
- 冷热数据分离
- 分布式锁
- 接口限流

## 技术栈

| 组件 | 技术 |
|------|------|
| 框架 | Gin |
| ORM | GORM |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis |
| 认证 | OIDC / JWT |

## 目录结构

```
backend/
├── cmd/
│   └── server/
│       └── main.go          # 程序入口
├── internal/
│   ├── api/                 # API 处理器
│   │   ├── auth.go          # 认证相关
│   │   ├── config.go        # 配置管理
│   │   ├── link.go          # 短链接
│   │   ├── redirect.go      # 跳转处理
│   │   ├── template.go      # 模板管理
│   │   ├── user.go          # 用户管理
│   │   ├── group.go         # 用户组
│   │   ├── domain.go        # 域名管理
│   │   ├── audit.go         # 审计日志
│   │   └── dashboard.go     # 仪表盘
│   ├── middleware/          # 中间件
│   │   ├── auth.go          # 认证中间件
│   │   ├── admin.go         # 管理员权限
│   │   ├── ratelimit.go     # 限流
│   │   └── cors.go          # CORS
│   ├── models/              # 数据模型
│   │   └── models.go        # 模型定义
│   ├── repository/          # 数据访问层
│   │   ├── link.go
│   │   ├── user.go
│   │   ├── group.go
│   │   ├── domain.go
│   │   ├── template.go
│   │   ├── audit.go
│   │   └── config.go
│   ├── service/             # 业务逻辑层
│   │   ├── link.go
│   │   ├── user.go
│   │   ├── group.go
│   │   ├── domain.go
│   │   ├── template.go
│   │   ├── audit.go
│   │   └── config.go
│   ├── config/              # 配置加载
│   ├── errors/              # 错误定义
│   └── response/            # 响应封装
├── pkg/                     # 公共包
│   ├── cache/               # 缓存封装
│   ├── shortcode/           # 短码生成
│   └── signature/           # 签名验证
├── .env.example             # 环境变量示例
├── go.mod
└── go.sum
```

## 快速启动

### 1. 环境要求

- Go 1.21 或更高版本
- MySQL 5.7+ 或 8.0+
- Redis 5.0+

### 2. 配置环境变量

在 `backend` 目录下创建 `.env` 文件：

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 服务配置
SERVER_PORT=8080

# 数据库配置
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=draurls

# Redis 配置
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# OIDC 配置
OIDC_ISSUER=http://localhost:8081/realms/draurls
OIDC_CLIENT_ID=draurls
OIDC_CLIENT_SECRET=your_client_secret

# JWT 配置
JWT_SECRET=your_jwt_secret_key
```

### 3. 创建数据库

```sql
CREATE DATABASE IF NOT EXISTS draurls CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> 表结构会在服务启动时自动创建 (AutoMigrate)

### 4. 安装依赖并启动

```bash
# 安装依赖
go mod download

# 启动服务
go run cmd/server/main.go
```

服务启动后会在 `http://localhost:8080` 监听。

## Docker 启动

### 使用 Docker Compose

```bash
# 启动 MySQL 和 Redis
docker-compose up -d mysql redis

# 启动后端服务
docker-compose up backend
```

### 构建镜像

```bash
docker build -t draurls-backend .
docker run -p 8080:8080 --env-file .env draurls-backend
```

## API 文档

### 健康检查

```bash
curl http://localhost:8080/health
```

### 认证方式

#### OIDC 认证

1. 前端重定向到 OIDC 提供商登录
2. 登录成功后回调 `/api/auth/callback`
3. 后端验证并返回 JWT Token

#### API 签名认证

```bash
# 生成签名
TIMESTAMP=$(date +%s)
NONCE=$(uuidgen)
SECRET="your_api_secret"

SIGNATURE=$(echo -n "${TIMESTAMP}${NONCE}{\"url\":\"https://example.com\"}/linksPOST" | \
  openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')

# 发起请求
curl -X POST http://localhost:8080/api/links \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Nonce: $NONCE" \
  -H "X-Signature: $SIGNATURE" \
  -d '{"url":"https://example.com"}'
```

### 主要 API 端点

#### 公开端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/:code` | GET | 短链跳转 |
| `/api/config` | GET | 获取站点配置 |
| `/api/templates` | GET | 获取可用模板 |

#### 用户端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/user/profile` | GET | 获取个人信息 |
| `/api/user/profile` | PUT | 更新个人信息 |
| `/api/user/dashboard` | GET | 用户仪表盘统计 |
| `/api/links` | GET | 获取我的链接 |
| `/api/links` | POST | 创建短链接 |
| `/api/links/:id` | GET | 获取链接详情 |
| `/api/links/:id` | PUT | 更新链接 |
| `/api/links/:id` | DELETE | 删除链接 |
| `/api/links/:id/stats` | GET | 获取链接统计 |
| `/api/api-keys` | GET | 获取 API Key 列表 |
| `/api/api-keys` | POST | 创建 API Key |
| `/api/api-keys/:id` | DELETE | 删除 API Key |

#### 管理员端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/dashboard/summary` | GET | 统计摘要 |
| `/api/admin/dashboard/trends` | GET | 趋势数据 |
| `/api/admin/users` | GET | 用户列表 |
| `/api/admin/users/:id/quota` | PUT | 更新用户配额 |
| `/api/admin/users/:id/disable` | POST | 禁用用户 |
| `/api/admin/users/:id/enable` | POST | 启用用户 |
| `/api/admin/groups` | GET | 用户组列表 |
| `/api/admin/groups` | POST | 创建用户组 |
| `/api/admin/groups/:id` | PUT | 更新用户组 |
| `/api/admin/groups/:id` | DELETE | 删除用户组 |
| `/api/admin/domains` | GET | 域名列表 |
| `/api/admin/domains` | POST | 创建域名 |
| `/api/admin/domains/:id` | PUT | 更新域名 |
| `/api/admin/domains/:id` | DELETE | 删除域名 |
| `/api/admin/templates` | GET | 模板列表 |
| `/api/admin/templates` | POST | 创建模板 |
| `/api/admin/templates/:id` | PUT | 更新模板 |
| `/api/admin/templates/:id` | DELETE | 删除模板 |
| `/api/admin/templates/:id/default` | POST | 设置默认模板 |
| `/api/admin/config` | GET | 获取所有配置 |
| `/api/admin/config` | PUT | 更新单个配置 |
| `/api/admin/config/batch` | PUT | 批量更新配置 |
| `/api/admin/audit-logs` | GET | 审计日志 |

## 配置项说明

### 数据库配置

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| DB_HOST | MySQL 主机 | 127.0.0.1 |
| DB_PORT | MySQL 端口 | 3306 |
| DB_USER | MySQL 用户 | root |
| DB_PASSWORD | MySQL 密码 | - |
| DB_NAME | 数据库名 | draurls |

### Redis 配置

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| REDIS_HOST | Redis 主机 | 127.0.0.1 |
| REDIS_PORT | Redis 端口 | 6379 |
| REDIS_PASSWORD | Redis 密码 | - |

### 站点配置（数据库中可修改）

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| site_name | 站点名称 | - |
| logo_url | Logo URL | - |
| redirect_page_enabled | 启用跳转页 | false |
| allow_user_template | 允许用户选模板 | false |
| max_link_length | 最大短链长度 | 10 |
| shortcode_mode | 短码模式 | sequence |
| allow_custom_shortcode | 允许自定义短码 | false |
| enable_signup | 允许注册 | true |

## 缓存策略

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

## 开发说明

### 添加新的 API

1. 在 `internal/api/` 中创建或更新处理器
2. 在 `internal/service/` 中实现业务逻辑
3. 如需数据库操作，在 `internal/repository/` 中添加方法
4. 在 `cmd/server/main.go` 中注册路由

### 添加新的配置项

1. 在 `internal/models/models.go` 中添加常量
2. 在 `internal/service/config.go` 的 `predefinedConfigs` 中添加说明
3. 如需公开访问，在 `GetPublicConfig` 的 `publicKeys` 中添加

## 许可证

MIT License
