# Draurls - 麟云短链

一个功能完整的短链接服务系统，使用 Golang + React 构建，支持 Keycloak 认证、多租户用户分组、API 签名验证、冷热数据缓存等功能。

## 功能特性

### 核心功能
- **短链接生成** - 支持随机和自定义短码
- **URL 去重** - 相同 URL 自动复用已有短码
- **时效控制** - 支持永久和限时链接
- **跳转页面** - 可配置中间跳转提示页
- **循环检测** - 自动检测并阻止本系统 URL 嵌套

### 用户系统
- **Keycloak 集成** - OIDC 认证
- **角色管理** - 普通用户/管理员
- **用户分组** - 灵活的分组配额管理
- **独立配额** - 配额精确到用户

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
- **统一管理面板** - 用户和管理员共用
- **站点配置** - 名称、Logo、域名等
- **用户管理** - 用户分组、配额分配
- **统计报表** - 链接点击统计

## 技术栈

| 层级 | 技术选择 |
|------|----------|
| 后端 | Go 1.23 + Gin |
| 前端 | React 18 + TypeScript + Vite + TailwindCSS |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis 7 |
| 认证 | Keycloak 24 |
| 部署 | Docker + Docker Compose |

## 项目结构

```
Draurls/
├── backend/               # 后端服务
│   ├── cmd/              # 主程序入口
│   │   └── server/
│   ├── internal/         # 内部代码
│   │   ├── api/         # API 处理器
│   │   ├── auth/        # 认证模块
│   │   ├── config/      # 配置管理
│   │   ├── link/        # 短链接服务
│   │   ├── user/        # 用户服务
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
│   │   ├── services/    # API 服务
│   │   ├── store/       # 状态管理
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
git clone https://github.com/your/draurls.git
cd draurls

# 启动所有服务
docker-compose up -d

# 访问服务
# 后端 API: http://localhost:8080
# 前端页面: http://localhost:3000
# Keycloak: http://localhost:8081
```

### 本地开发

#### 后端开发

```bash
cd backend

# 安装依赖
go mod download

# 复制配置文件
cp .env.example .env

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

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `SERVER_PORT` | 服务端口 | 8080 |
| `DB_HOST` | 数据库地址 | 127.0.0.1 |
| `DB_PORT` | 数据库端口 | 3306 |
| `DB_USER` | 数据库用户 | root |
| `DB_PASSWORD` | 数据库密码 | - |
| `DB_NAME` | 数据库名称 | draurls |
| `REDIS_HOST` | Redis 地址 | 127.0.0.1 |
| `REDIS_PORT` | Redis 端口 | 6379 |
| `KEYCLOAK_BASE_URL` | Keycloak 地址 | http://localhost:8081 |
| `KEYCLOAK_REALM` | Keycloak 域名 | draurls |
| `JWT_SECRET` | JWT 密钥 | - |

## API 文档

### 认证方式

支持两种认证方式：
1. **OIDC 认证** - 通过 Keycloak 进行 OAuth2/OIDC 登录
2. **API 签名认证** - 使用 API Key + HMAC 签名

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

## 许可证

MIT License
