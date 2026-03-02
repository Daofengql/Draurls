# 架构说明

## 技术栈

| 层级 | 技术选择 | 说明 |
|------|----------|------|
| 后端 | Go 1.23 + Gin | 高性能 HTTP 框架 |
| 前端 | React 18 + TypeScript + Vite | 现代化前端方案 |
| UI 框架 | TailwindCSS | 原子化 CSS |
| 数据库 | MySQL 8.0 | 主数据存储 |
| 缓存 | Redis 7 | 分布式缓存 |
| 认证 | Keycloak (OIDC) | 企业级认证 |

## 项目结构

```
Surls/
├── backend/               # 后端服务
│   ├── cmd/              # 主程序入口
│   │   └── server/       # 服务器启动代码
│   ├── internal/         # 内部代码（不对外暴露）
│   │   ├── api/         # HTTP 处理器
│   │   ├── config/      # 配置管理
│   │   ├── middleware/  # 中间件
│   │   ├── models/      # 数据模型
│   │   ├── repository/  # 数据访问层
│   │   └── service/     # 业务逻辑层
│   ├── pkg/             # 公共包（可被外部引用）
│   │   ├── cache/       # 缓存封装
│   │   ├── shortcode/   # 短码生成
│   │   ├── urlutil/     # URL 工具
│   │   └── worker/      # Worker Pool
│   └── migrations/      # 数据库迁移
├── frontend/            # 前端应用
│   └── src/
│       ├── components/  # 通用组件
│       ├── pages/       # 页面组件
│       ├── services/    # API 服务
│       ├── store/       # 状态管理
│       └── utils/       # 工具函数
└── docs/               # 文档
```

## 后端架构

### 分层设计

```
┌─────────────────────────────────────────────┐
│                  Handler                     │  HTTP 请求处理
├─────────────────────────────────────────────┤
│                  Service                     │  业务逻辑
├─────────────────────────────────────────────┤
│                 Repository                   │  数据访问
├─────────────────────────────────────────────┤
│              MySQL / Redis                   │  数据存储
└─────────────────────────────────────────────┘
```

### 核心模块

| 模块 | 职责 |
|------|------|
| `api/` | HTTP 请求处理，参数校验，响应封装 |
| `service/` | 业务逻辑，事务管理，缓存协调 |
| `repository/` | 数据库操作，查询封装 |
| `middleware/` | 认证，CORS，限流，日志 |
| `models/` | 数据模型定义，GORM 映射 |

### 认证流程

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  前端    │ ───> │ Keycloak │ ───> │  后端    │ ───> │  数据库  │
└──────────┘      └──────────┘      └──────────┘      └──────────┘
    │                                   │
    │  1. 获取登录 URL                   │
    │<───────────────────────────────────┤
    │                                   │
    │  2. 打开弹窗跳转到 Keycloak        │
    │  ───────────────────────────────> │
    │                                   │
    │  3. 回调返回 Code                  │
    │  <─────────────────────────────────│
    │                                   │
    │  4. 用 Code 换取 Token              │
    │  ───────────────────────────────> │
    │                                   │
    │  5. 设置 HttpOnly Cookie           │
    │  <─────────────────────────────────│
```

## 前端架构

### 目录结构

```
src/
├── components/       # 通用组件
│   ├── LinkCard.tsx
│   ├── LinkForm.tsx
│   └── StatsCard.tsx
├── pages/           # 页面组件
│   ├── admin/       # 管理员页面
│   ├── LinksPage.tsx
│   └── ProfilePage.tsx
├── services/        # API 服务
│   ├── auth.ts      # 认证相关
│   ├── links.ts     # 链接相关
│   └── api.ts       # 基础 API 封装
├── store/           # 状态管理
│   ├── auth.ts      # 认证状态
│   └── index.ts     # Store 配置
└── utils/           # 工具函数
    ├── format.ts    # 格式化工具
    └── validate.ts  # 验证工具
```

### 状态管理

使用 Zustand 进行轻量级状态管理：

```typescript
// 认证状态
interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
}
```

## 数据模型

### 核心表

| 表名 | 说明 |
|------|------|
| `users` | 用户表 |
| `user_groups` | 用户组表 |
| `short_links` | 短链接表 |
| `domains` | 域名表 |
| `templates` | 跳转模板表 |
| `access_logs` | 访问日志表 |
| `api_keys` | API 密钥表 |
| `audit_logs` | 审计日志表 |
| `site_configs` | 站点配置表 |

### 域名隔离

短链接支持多域名隔离，通过 `domain_id` 关联：

```
short_links.domain_id → domains.id
```

访问时根据请求的 `Host` 头查找对应域名，实现多租户隔离。

## 缓存设计

### 多级缓存

```
┌─────────────────────────────────────────────┐
│              L1: Memory (sync.Map)          │  本地缓存
├─────────────────────────────────────────────┤
│              L2: Redis                      │  分布式缓存
├─────────────────────────────────────────────┤
│              L3: MySQL                      │  持久化存储
└─────────────────────────────────────────────┘
```

### 冷热分离

| 温度 | TTL | 场景 |
|------|-----|------|
| 热 | 1h | 高频访问数据 |
| 温 | 1d | 中频访问数据 |
| 冷 | 7d | 低频访问数据 |

### 缓存击穿防护

- 使用 Redis 分布式锁
- 过期时间 + 随机偏移量
- 空值缓存（穿透防护）

## 并发处理

### Worker Pool

使用 Worker Pool 处理异步任务，避免无界 Goroutine：

```go
pool := worker.New(100, 1000)  // 100 workers, 1000 queue size

task := func() {
    // 异步任务
}

pool.Submit(task)  // 非阻塞提交
```

### 访问日志异步写入

访问日志和点击计数通过 Worker Pool 异步处理，不阻塞请求。

## 安全设计

### API 签名

HMAC-SHA256 签名机制，防重放攻击：

```
signature = HMAC-SHA256(secret, timestamp + nonce + body + path + method)
```

### 限流策略

- IP 限流：100 次/分钟
- 用户限流：200 次/分钟
- API 限流：500 次/分钟
- 全局限流：10000 次/秒

### CORS 动态配置

支持从数据库动态加载 CORS 配置，无需重启服务。

## 性能优化

1. **前端嵌入** - 前端静态文件嵌入 Go 二进制
2. **连接池** - 数据库和 Redis 连接复用
3. **批量操作** - 访问日志缓冲写入
4. **索引优化** - 数据库查询优化
