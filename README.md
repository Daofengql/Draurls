# Surls - 麟云短链

一个功能完整的短链接服务系统，使用 Golang + React 构建，支持用户认证、多租户用户分组、API 签名验证、跳转模板、审计日志等功能。

## 功能特性

### 核心功能
- **短链接生成** - 支持随机和自定义短码
- **URL 去重** - 相同 URL 自动复用已有短码
- **时效控制** - 支持永久和限时链接
- **跳转页面** - 可配置中间跳转提示页
- **循环检测** - 自动检测并阻止本系统 URL 嵌套
- **跳转模板** - 用户可自定义跳转页面模板

### 用户系统
- **OIDC 认证** - 支持 Keycloak 等标�� OIDC 提供商
- **角色管理** - 普通用户/管理员
- **用户分组** - 灵活的分组配额管理
- **独立配额** - 配额精确到用户
- **用户资料** - 完整的用户个人信息管理
- **登录追踪** - 记录用户最后登录时间和 IP

### 跳转模板
- **模板管理** - 管理员可创建/编辑/删除跳转模板
- **用户选择** - 用户创建链接时可选择模板
- **默认模板** - 支持设置系统默认模板
- **自定义 HTML** - 完全自定义的跳转页面样式

### 审计日志
- **操作记录** - 完整记录用户操作行为
- **多维度查询** - 按操作人、操作类型、资源类型筛选
- **详细追踪** - 记录 IP、User-Agent 等信息

### API 功能
- **RESTful API** - 完整的 API 接口
- **签名验证** - HMAC-SHA256 签名机制
- **防重放攻击** - 时间戳 + Nonce 校验
- **API Key 管理** - 用户自主管理密钥

### 性能优化
- **冷热数据分离** - 基于访问频率的缓存策略
- **Redis 缓存** - 多级缓存机制
- **分布式锁** - 防止缓存击穿
- **接口限流** - IP/用户/API 多维度限速

### 管理功能
- **统一管理面板** - 响应式设计，支持移动端
- **站点配置** - 分组配置（基本设置、跳转页面、短链、用户）
- **用户管理** - 用户分组、配额分配
- **统计报表** - 链接点击统计、趋势分析
- **域名管理** - 多域名支持，SSL 配置
- **模板管理** - 跳转模板 CRUD 操作

## 技术栈

| 层级 | 技术选择 |
|------|----------|
| 后端 | Go 1.23 + Gin |
| 前端 | React 18 + TypeScript + Vite + TailwindCSS |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis 7 |
| 认证 | OIDC (Keycloak) |
| 部署 | Docker + Docker Compose |

## 项目结构

```
Surls/
├��─ backend/               # 后端服务
│   ├── cmd/              # 主程序入口
│   │   └── server/
│   ├── internal/         # 内部代码
│   │   ├── api/         # API 处理器
│   │   ├── auth/        # 认证模块
│   │   ├── config/      # 配置管理
│   │   ├── middleware/  # 中间件
│   │   ├── models/      # 数据模型
│   │   ├── repository/  # 数据访问层
│   │   └── service/     # 业务逻辑层
│   ├── pkg/             # 公共包
│   │   ├── cache/       # 缓存封装
│   │   ├── shortcode/   # 短码生成
│   │   └── signature/   # 签名验证
│   ├── migrations/      # 数据库迁移
│   ├── go.mod
│   └── go.sum
├── frontend/            # 前端应用
│   ├── src/
│   │   ├── components/  # 组件
│   │   ├── pages/       # 页面
│   │   │   ├── admin/  # 管理员页面
│   │   │   │   ├── AdminConfigPage.tsx    # 站点配置
│   │   │   │   ├── AdminDomainsPage.tsx   # 域名管理
│   │   │   │   ├── AdminGroupsPage.tsx    # 用户组管理
│   │   │   │   ├── AdminTemplatesPage.tsx # 模板管理
│   │   │   │   ├── AdminUsersPage.tsx     # 用户管理
│   │   │   │   └── AuditLogsPage.tsx      # 审计日志
│   │   │   ├── LinksPage.tsx              # 链接管理
│   │   │   └── ProfilePage.tsx            # 个人资料
│   │   ├── services/    # API 服务
│   │   ├── types/       # 类型定义
│   │   ├── hooks/       # 自定义 Hooks
│   │   └── utils/       # 工具函数
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml   # Docker 编排
├── Dockerfile          # 镜像构建
└── README.md
```

## 快速开始

### 使用 Docker Compose（推荐）

```bash
# 克隆项目
git clone https://github.com/Daofengql/Surls.git
cd Surls

# 启动所有服务
docker-compose up -d

# 访问服务
# 后端 API: http://localhost:8080
# 前端页面: http://localhost:3000
# Keycloak: http://localhost:8081
```

### 本地开发

#### 后端开发（API 模式）

```bash
cd backend

# 安装依赖
go mod download

# 复制配置文件
cp .env.example .env

# 编辑 .env 文件，配置数据库和 Redis

# 运行
go run cmd/server/main.go
```

#### 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

### 统一构建（生产部署）

项目支持将前端静态文件嵌入后端，构建单个二进制文件：

```bash
# 一键构建（推荐）
./build.sh    # Linux/macOS
build.bat     # Windows

# 构建产物
# 所有平台文件输出到 dist/ 目录

# 运行
cd dist
./server      # 或 server.exe（Windows）
```

构建后，访问 `http://localhost:8080` 即可使用完整功能（前端+后端）。

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `SERVER_PORT` | 服务端口 | 8080 |
| `DB_HOST` | 数据库地址 | 127.0.0.1 |
| `DB_PORT` | 数据库端口 | 3306 |
| `DB_USER` | 数据库用户 | root |
| `DB_PASSWORD` | 数据库密码 | - |
| `DB_NAME` | 数据库名称 | surls |
| `REDIS_HOST` | Redis 地址 | 127.0.0.1 |
| `REDIS_PORT` | Redis 端口 | 6379 |
| `REDIS_PASSWORD` | Redis 密码 | - |
| `KEYCLOAK_BASE_URL` | Keycloak 地址 | - |
| `KEYCLOAK_REALM` | Keycloak Realm | - |
| `KEYCLOAK_CLIENT_ID` | Keycloak 客户端 ID | - |
| `KEYCLOAK_SECRET` | Keycloak 客户端密钥 | - |
| `JWT_SECRET` | JWT 密钥 | - |

## 站点配置

系统支持以下配置项，可在管理后台修改：

### 基本设置
- **站点名称** - 显示在页面标题和导航
- **Logo URL** - 站点 Logo 图片地址

### 跳转页面设置
- **启用跳转中间页** - 是否显示跳转提示页面
- **允许用户选择模板** - 用户创建链接时是否可选择跳转模板

### 短链设置
- **最大短链长度** - 自定义短码的最大长度
- **短码生成模式** - 随机字符串 / 数据库自增
- **允许普通用户使用自定义短码** - 是否开放自定义短码功能

### 用户设置
- **允许用户注册** - 是否开放新用户注册

## API 文档

### 认证方式

支持两种认证方式：
1. **OIDC 认证** - 通过 Keycloak 等标准 OIDC 提供商登录
2. **API 签名认证** - 使用 API Key + HMAC 签名

### 主要 API 端点

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/health` | GET | 健康检查 | - |
| `/api/links` | POST | 创建短链接 | 用户 |
| `/api/links` | GET | 获取我的链接列表 | 用户 |
| `/api/links/:id` | PUT | 更新链接 | 用户 |
| `/api/links/:id` | DELETE | 删除链接 | 用户 |
| `/api/user/profile` | GET | 获取个人信息 | 用户 |
| `/api/user/dashboard` | GET | 用户仪表盘统计 | 用户 |
| `/api/config` | GET | 获取站点配置 | - |
| `/api/templates` | GET | 获取可用模板 | - |
| `/api/admin/users` | GET | 获取用户列表 | 管理员 |
| `/api/admin/groups` | GET | 获取用户组列表 | 管理员 |
| `/api/admin/domains` | GET | 获取域名列表 | 管理员 |
| `/api/admin/templates` | GET | 获取模板列表 | 管理员 |
| `/api/admin/config` | GET | 获取站点配置 | 管理员 |
| `/api/admin/audit-logs` | GET | 获取审计日志 | 管理员 |
| `/api/admin/dashboard/summary` | GET | 管理员统计摘要 | 管理员 |
| `/:code` | GET | 短链跳转 | - |

### API 签名示例

```bash
# 生成签名
TIMESTAMP=$(date +%s)
NONCE=$(uuidgen)
SECRET="your_api_secret"

SIGNATURE=$(echo -n "${TIMESTAMP}${NONCE}{\"url\":\"https://example.com\"}/linksPOST" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')

# 发起请求
curl -X POST http://localhost:8080/api/links \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Nonce: $NONCE" \
  -H "X-Signature: $SIGNATURE" \
  -d '{"url":"https://example.com"}'
```

## 缓存策略

系统采用三级缓存策略：

| 温度 | TTL | 说明 |
|------|-----|------|
| 热 | 1 小时 | 高频访问数据 |
| 温 | 1 天 | 中频访问数据 |
| 冷 | 7 天 | 低频访问数据 |

数据会根据访问频率自动升级/降级温度。

## 限流策略

| 类型 | 限制 |
|------|------|
| IP 限流 | 100 次/分钟 |
| 用户限流 | 200 次/分钟 |
| API 限流 | 500 次/分钟 |
| 全局限流 | 10000 次/秒 |

## 移动端支持

前端采用响应式设计，完全支持移动端访问：
- 自适应布局
- 触摸优化
- 移动端专属交互体验

## 许可证

MIT License
